"""
Pool service.
Contains business logic for pool creation, management, and matching.
"""

import sys
from pathlib import Path

# Add the backend directory to the Python path so we can import from it
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from config.database import db
from helpers.college_helper import _compute_badges, _attach_badges
from helpers.email_helper import send_email, match_email_html, join_request_email_html
from helpers.push_helper import send_push
from models.pool import PoolRequestCreate, PoolRequestUpdate, PoolResponse, ConfirmedTraveler
from models.auth import JoinRequestOut
import logging
import uuid

logger = logging.getLogger("unipool.pool")

# Import configuration values
from config.settings import (
    MAX_OPEN_POOLS_PER_USER, MAX_POOLS_PER_HOUR, IST
)

def _fmt_ist(dt: datetime) -> str:
    """Format a stored (UTC) datetime as an IST wall-clock string for emails."""
    return _ensure_aware(dt).astimezone(IST).strftime("%d %b %Y, %I:%M %p IST")

def _ensure_aware(dt: datetime) -> datetime:
    """Ensure datetime is timezone aware."""
    if dt.tzinfo is None or dt.tzinfo.utcoffset(dt) is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt

def _now_utc() -> datetime:
    """Get current UTC datetime."""
    return datetime.now(timezone.utc)

async def _get_max_open_pools_per_user() -> int:
    """Get maximum open pools allowed per user."""
    return MAX_OPEN_POOLS_PER_USER

async def _get_max_pools_per_hour() -> int:
    """Get maximum pools allowed per hour per user."""
    return MAX_POOLS_PER_HOUR

async def create_pool(user: Dict[str, Any], body: PoolRequestCreate) -> Dict[str, Any]:
    """
    Create a new travel pool request.

    Args:
        user: Authenticated user dictionary
        body: Pool creation request data

    Returns:
        Created pool data with computed fields

    Raises:
        Exception: If user has too many open pools or is posting too frequently
    """
    # Check user's open pool count
    open_count = await db.pools.count_documents({
        "user_id": user["user_id"],
        "status": "open"
    })
    max_open = await _get_max_open_pools_per_user()
    if open_count >= max_open:
        raise Exception(f"You already have {max_open} open queries. Close one before posting a new one.")

    # Check user's recent posting frequency
    recent_count = await db.pools.count_documents({
        "user_id": user["user_id"],
        "created_at": {"$gte": _now_utc() - timedelta(hours=1)}
    })
    max_per_hour = await _get_max_pools_per_hour()
    if recent_count >= max_per_hour:
        raise Exception("You're posting too fast. Please wait a bit before posting again.")

    # Create pool document
    pool_id = f"pool_{uuid.uuid4().hex[:12]}"
    pool_doc = {
        "pool_id": pool_id,
        "user_id": user["user_id"],
        "user_name": user.get("name") or "Traveller",
        "user_email": user["email"],
        "user_gender": user.get("gender"),
        "from_location": body.from_location.strip(),
        "to_location": body.to_location.strip(),
        "travel_datetime": _ensure_aware(body.travel_datetime),
        "gender_preference": body.gender_preference,
        "companions": body.companions,
        "luggage": body.luggage,
        "notes": body.notes,
        "trip_mode": body.trip_mode,
        "status": "open",
        "created_at": _now_utc(),
        "confirmed_travelers": [],
    }

    # Save to database
    await db.pools.insert_one(pool_doc)

    # Fire-and-forget notify matching users
    # Note: In a real implementation, this would be a background task
    # For now, we'll just note that matching should happen

    # Return cleaned response
    return _clean(dict(pool_doc))

async def get_pool(pool_id: str, user_id: str) -> Optional[Dict[str, Any]]:
    """
    Get a specific pool by ID.

    Args:
        pool_id: Pool ID to retrieve
        user_id: Current user ID (for access control and personalization)

    Returns:
        Pool data if found and accessible, None otherwise
    """
    pool = await db.pools.find_one({"pool_id": pool_id}, {"_id": 0})
    if not pool:
        logger.info(f"Pool not found in database: pool_id={pool_id}")
        return None

    # Check if user is blocked from viewing this pool
    if await _is_blocked_pair(user_id, pool["user_id"]):
        logger.info(f"User {user_id} is blocked from viewing pool {pool_id} (pool owner: {pool['user_id']})")
        return None

    # Enrich with ratings and badges
    enriched = await _enrich_with_ratings([pool])
    enriched = await _attach_badges(
        enriched, "user_id", "user_email", "user_rating_avg", "user_rating_count", "user_badges", "user_college_id"
    )
    result = enriched[0] if enriched else pool

    # Add user's request status if applicable
    result = await _enrich_with_my_request_status([result], user_id)
    return result[0] if result else None

async def list_pools(user: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    List all open pools (feed) for a user.

    Args:
        user: Authenticated user dictionary

    Returns:
        List of pool dictionaries with computed fields
    """
    now = _now_utc()
    blocked_ids = await _blocked_user_ids(user["user_id"])

    # Build query for open pools from last 2 hours
    query = {"travel_datetime": {"$gte": now - timedelta(hours=2)}, "status": "open"}
    if blocked_ids:
        query["user_id"] = {"$nin": list(blocked_ids)}

    # Fetch candidates, then rank them by route/time/preferences/trust.
    cursor = db.pools.find(query, {"_id": 0})
    results = await cursor.to_list(200)
    from services.match_service import rank_pool_feed
    results = await rank_pool_feed(user, results)

    # Enrich with ratings and badges
    results = await _enrich_with_ratings(results)
    results = await _attach_badges(
        results, "user_id", "user_email", "user_rating_avg", "user_rating_count", "user_badges", "user_college_id"
    )

    # Add user's request status for each pool
    return await _enrich_with_my_request_status(results, user["user_id"])

async def my_pools(user: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Get all pools created by the current user.

    Args:
        user: Authenticated user dictionary

    Returns:
        List of pool dictionaries sorted by creation date (newest first)
    """
    cursor = db.pools.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).sort("travel_datetime", -1)
    results = await cursor.to_list(200)

    # Enrich with ratings and badges
    results = await _enrich_with_ratings(results)
    results = await _attach_badges(
        results, "user_id", "user_email", "user_rating_avg", "user_rating_count", "user_badges", "user_college_id"
    )

    # Add user's request status for each pool
    return await _enrich_with_my_request_status(results, user["user_id"])

async def close_pool(pool_id: str, user_id: str) -> Optional[Dict[str, Any]]:
    """
    Close a pool (only by the pool owner).

    Args:
        pool_id: Pool ID to close
        user_id: Current user ID (must be pool owner)

    Returns:
        Updated pool data if successful, None otherwise
    """
    # Update pool status
    result = await db.pools.update_one(
        {"pool_id": pool_id, "user_id": user_id},
        {"$set": {"status": "closed"}}
    )

    if result.matched_count == 0:
        return None

    # Auto-decline pending join requests
    await db.join_requests.update_many(
        {"pool_id": pool_id, "status": "pending"},
        {"$set": {"status": "declined", "responded_at": _now_utc()}}
    )

    # Return updated pool
    return await db.pools.find_one({"pool_id": pool_id}, {"_id": 0})

async def reopen_pool(pool_id: str, user_id: str) -> Optional[Dict[str, Any]]:
    """
    Reopen a closed pool (only by the pool owner).

    Args:
        pool_id: Pool ID to reopen
        user_id: Current user ID (must be pool owner)

    Returns:
        Updated pool data if successful, None otherwise
    """
    result = await db.pools.update_one(
        {"pool_id": pool_id, "user_id": user_id},
        {"$set": {"status": "open"}}
    )

    if result.matched_count == 0:
        return None

    return await db.pools.find_one({"pool_id": pool_id}, {"_id": 0})

async def delete_pool(pool_id: str, user_id: str) -> bool:
    """
    Delete a pool (only by the pool owner).

    Args:
        pool_id: Pool ID to delete
        user_id: Current user ID (must be pool owner)

    Returns:
        True if pool was deleted, False otherwise
    """
    result = await db.pools.delete_one(
        {"pool_id": pool_id, "user_id": user_id}
    )
    return result.deleted_count > 0

# Helper functions for pool operations

async def _blocked_user_ids(user_id: str) -> set:
    """
    Get set of user IDs blocked by or blocking the given user.

    Args:
        user_id: User ID to check blocks for

    Returns:
        Set of blocked user IDs
    """
    cursor = db.blocks.find(
        {"$or": [{"blocker_id": user_id}, {"blocked_id": user_id}]},
        {"_id": 0}
    )
    pairs = await cursor.to_list(2000)
    ids = set()
    for p in pairs:
        ids.add(p["blocked_id"] if p["blocker_id"] == user_id else p["blocker_id"])
    return ids

async def _is_blocked_pair(user_a: str, user_b: str) -> bool:
    """
    Check if two users have blocked each other.

    Args:
        user_a: First user ID
        user_b: Second user ID

    Returns:
        True if users have blocked each other, False otherwise
    """
    doc = await db.blocks.find_one(
        {"$or": [
            {"blocker_id": user_a, "blocked_id": user_b},
            {"blocker_id": user_b, "blocked_id": user_a},
        ]},
        {"_id": 0},
    )
    return doc is not None

async def _enrich_with_ratings(pools: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Batch-attach user rating average and count to pool dictionaries.

    Args:
        pools: List of pool dictionaries to enrich

    Returns:
        List of enriched pool dictionaries
    """
    if not pools:
        return pools

    user_ids = list({p["user_id"] for p in pools})
    pipeline = [
        {"$match": {"rated_user_id": {"$in": user_ids}}},
        {"$group": {"_id": "$rated_user_id", "avg": {"$avg": "$stars"}, "count": {"$sum": 1}}},
    ]
    stats = await db.ratings.aggregate(pipeline).to_list(len(user_ids))
    stat_map = {s["_id"]: s for s in stats}

    for p in pools:
        s = stat_map.get(p["user_id"])
        p["user_rating_avg"] = round(s["avg"], 1) if s else None
        p["user_rating_count"] = s["count"] if s else 0

    return pools

async def _attach_requester_ratings(requests: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Batch-attach requester rating average and count to join request dictionaries.

    Args:
        requests: List of join request dictionaries to enrich

    Returns:
        List of enriched join request dictionaries
    """
    if not requests:
        return requests

    user_ids = list({r["requester_id"] for r in requests})
    pipeline = [
        {"$match": {"rated_user_id": {"$in": user_ids}}},
        {"$group": {"_id": "$rated_user_id", "avg": {"$avg": "$stars"}, "count": {"$sum": 1}}},
    ]
    stats = await db.ratings.aggregate(pipeline).to_list(len(user_ids))
    stat_map = {s["_id"]: s for s in stats}

    for r in requests:
        s = stat_map.get(r["requester_id"])
        r["requester_rating_avg"] = round(s["avg"], 1) if s else None
        r["requester_rating_count"] = s["count"] if s else 0

    return requests

async def _enrich_with_my_request_status(pools: List[Dict[str, Any]], user_id: str) -> List[Dict[str, Any]]:
    """
    Attach user's request status to each pool dictionary.

    Args:
        pools: List of pool dictionaries to enrich
        user_id: Current user ID

    Returns:
        List of enriched pool dictionaries
    """
    if not pools:
        return pools

    pool_ids = [p["pool_id"] for p in pools]
    cursor = db.join_requests.find(
        {"pool_id": {"$in": pool_ids}, "requester_id": user_id},
        {"_id": 0}
    )
    status_map = {r["pool_id"]: r["status"] async for r in cursor}

    for p in pools:
        p["my_request_status"] = status_map.get(p["pool_id"])
        p.setdefault("confirmed_travelers", [])

    return pools

def _clean(item: Dict[str, Any]) -> Dict[str, Any]:
    """
    Remove internal MongoDB fields from item.

    Args:
        item: Dictionary potentially containing MongoDB fields

    Returns:
        Dictionary with internal fields removed
    """
    # Remove MongoDB _id field if present
    item.pop("_id", None)
    return item

async def get_my_matches(user_id: str) -> List[Dict[str, Any]]:
    """
    Get all pools that overlap ±1h with any of the user's own pools on the same route.

    Args:
        user_id: Current user ID

    Returns:
        List of matching pool dictionaries with request status
    """
    my = await db.pools.find({"user_id": user_id}, {"_id": 0}).to_list(100)
    if not my:
        return []
    
    results: dict = {}
    for own in my:
        if own.get("status") != "open":
            continue
        dt = _ensure_aware(own["travel_datetime"])
        cursor = db.pools.find(
            {
                "user_id": {"$ne": user_id},
                "status": "open",
                "from_location": {"$regex": f"^{own['from_location']}$", "$options": "i"},
                "to_location": {"$regex": f"^{own['to_location']}$", "$options": "i"},
                "travel_datetime": {
                    "$gte": dt - timedelta(hours=1),
                    "$lte": dt + timedelta(hours=1),
                },
            },
            {"_id": 0},
        )
        for m in await cursor.to_list(100):
            results[m["pool_id"]] = m
    
    enriched = await _enrich_with_ratings(list(results.values()))
    return await _enrich_with_my_request_status(enriched, user_id)

async def get_confirmed_matches(user_id: str) -> List[Dict[str, Any]]:
    """
    Get every 'traveling together' pairing involving the user — whether they're the pool
    owner or a confirmed traveler on someone else's pool.

    Args:
        user_id: Current user ID

    Returns:
        List of confirmed match dictionaries with ratings and badges
    """
    results = []

    # Owner pools with confirmed travelers
    owner_pools = await db.pools.find(
        {"user_id": user_id, "confirmed_travelers.0": {"$exists": True}}, {"_id": 0}
    ).to_list(200)
    for p in owner_pools:
        for t in p.get("confirmed_travelers", []):
            results.append({
                "pool_id": p["pool_id"],
                "from_location": p["from_location"],
                "to_location": p["to_location"],
                "travel_datetime": p["travel_datetime"],
                "pool_status": p.get("status", "open"),
                "other_user_id": t["user_id"],
                "other_user_name": t["name"],
                "other_user_email": t["email"],
                "my_role": "owner",
            })

    # Pools where user is a confirmed traveler
    traveler_pools = await db.pools.find(
        {"confirmed_travelers.user_id": user_id}, {"_id": 0}
    ).to_list(200)
    for p in traveler_pools:
        results.append({
            "pool_id": p["pool_id"],
            "from_location": p["from_location"],
            "to_location": p["to_location"],
            "travel_datetime": p["travel_datetime"],
            "pool_status": p.get("status", "open"),
            "other_user_id": p["user_id"],
            "other_user_name": p["user_name"],
            "other_user_email": p["user_email"],
            "my_role": "traveler",
        })

    if not results:
        return []
    
    # Attach ratings
    other_ids = list({r["other_user_id"] for r in results})
    pipeline = [
        {"$match": {"rated_user_id": {"$in": other_ids}}},
        {"$group": {"_id": "$rated_user_id", "avg": {"$avg": "$stars"}, "count": {"$sum": 1}}},
    ]
    stats = await db.ratings.aggregate(pipeline).to_list(len(other_ids))
    stat_map = {s["_id"]: s for s in stats}
    for r in results:
        s = stat_map.get(r["other_user_id"])
        r["other_user_rating_avg"] = round(s["avg"], 1) if s else None
        r["other_user_rating_count"] = s["count"] if s else 0
    
    # Attach badges
    results = await _attach_badges(
        results, "other_user_id", "other_user_email", 
        "other_user_rating_avg", "other_user_rating_count", 
        "other_user_badges", "other_user_college_id"
    )
    
    # Sort by travel datetime (newest first)
    results.sort(key=lambda r: r["travel_datetime"], reverse=True)
    return results