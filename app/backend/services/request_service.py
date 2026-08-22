"""
Request service.
Contains business logic for managing join requests to pools.
"""

from typing import List, Optional, Dict, Any
from config.database import db
from helpers.college_helper import _attach_badges
from services.pool_service import _attach_requester_ratings
from helpers.email_helper import send_email, join_request_email_html
from helpers.push_helper import send_push
from models.auth import JoinRequestOut
from models.user import UserOut
import logging
from datetime import datetime, timezone

logger = logging.getLogger("unipool.request")

def _pool_is_joinable(pool: Dict[str, Any]) -> bool:
    """
    Check if a pool is open and accepting join requests.

    Args:
        pool: Pool dictionary to check

    Returns:
        True if pool is joinable, False otherwise
    """
    if not pool or pool.get("status") != "open":
        return False
    from services.auth_service import _ensure_aware, _now_utc
    return _ensure_aware(pool["travel_datetime"]) > _now_utc()

async def create_join_request(user: Dict[str, Any], pool_id: str) -> Dict[str, Any]:
    """
    Create a join request for a pool.

    Args:
        user: Authenticated user making the request
        pool_id: ID of the pool to join

    Returns:
        Created join request data

    Raises:
        Exception: If pool not found, user trying to join own pool, pool not joinable,
                  user already confirmed, users blocked, or existing request
    """
    # Fetch pool information
    pool = await db.pools.find_one({"pool_id": pool_id}, {"_id": 0})
    if not pool:
        raise Exception("Pool not found")

    # Prevent users from joining their own pools
    if pool["user_id"] == user["user_id"]:
        raise Exception("You can't request to join your own pool")

    # Check if pool is still open and accepting requests
    if not _pool_is_joinable(pool):
        raise Exception("This pool is no longer accepting requests")

    # Check if user is already confirmed on this pool
    if any(t["user_id"] == user["user_id"] for t in pool.get("confirmed_travelers", [])):
        raise Exception("You're already confirmed on this pool")

    # Check if users are blocked from interacting
    from services.pool_service import _is_blocked_pair
    if await _is_blocked_pair(user["user_id"], pool["user_id"]):
        raise Exception("You can't request to join this pool")

    # Check for existing pending/accepted request
    existing = await db.join_requests.find_one(
        {"pool_id": pool_id, "requester_id": user["user_id"], "status": {"$in": ["pending", "accepted"]}},
        {"_id": 0}
    )
    if existing:
        raise Exception("You already have a request on this pool")

    # Create join request document
    request_id = f"req_{__import__('uuid').uuid4().hex[:12]}"
    request_doc = {
        "request_id": request_id,
        "pool_id": pool_id,
        "pool_owner_id": pool["user_id"],
        "from_location": pool["from_location"],
        "to_location": pool["to_location"],
        "travel_datetime": pool["travel_datetime"],
        "requester_id": user["user_id"],
        "requester_name": user.get("name") or "Traveller",
        "requester_email": user["email"],
        "requester_gender": user.get("gender"),
        "status": "pending",
        "created_at": _now_utc(),
        "responded_at": None,
    }

    # Save to database
    await db.join_requests.insert_one(request_doc)

    # Send notifications to pool owner
    try:
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": {"temp_requester_name": request_doc["requester_name"]}}  # Temp for email
        )
        await send_push(
            pool["user_id"],
            "New ride request",
            f"{request_doc['requester_name']} wants to travel with you: {pool['from_location']} → {pool['to_location']}",
            "/(tabs)/matches"
        )
        await send_email(
            pool["user_email"],
            "UniPool: New ride request",
            join_request_email_html(pool["user_name"], request_doc["requester_name"], pool, "received")
        )
    except Exception as e:
        logger.warning(f"Failed to send join request notifications: {e}")

    return _clean(dict(request_doc))

async def list_pool_requests(pool_id: str, user_id: str) -> List[Dict[str, Any]]:
    """
    Get all join requests for a specific pool (pool owner only).

    Args:
        pool_id: ID of the pool
        user_id: ID of the user requesting (must be pool owner)

    Returns:
        List of join request dictionaries

    Raises:
        Exception: If pool not found or user is not the pool owner
    """
    # Verify pool exists and user is owner
    pool = await db.pools.find_one({"pool_id": pool_id}, {"_id": 0})
    if not pool:
        raise Exception("Pool not found")
    if pool["user_id"] != user_id:
        raise Exception("Not your pool")

    # Fetch all requests for this pool
    cursor = db.join_requests.find(
        {"pool_id": pool_id},
        {"_id": 0}
    ).sort("created_at", -1)
    return await cursor.to_list(200)

async def incoming_requests(user: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Get pending join requests on pools owned by the user.

    Args:
        user: Authenticated user dictionary

    Returns:
        List of pending join request dictionaries with requester info
    """
    # Fetch pending requests on user's pools
    cursor = db.join_requests.find(
        {"pool_owner_id": user["user_id"], "status": "pending"},
        {"_id": 0}
    ).sort("created_at", -1)
    results = await cursor.to_list(200)

    # Enrich with requester ratings and badges
    results = await _attach_requester_ratings(results)
    results = await _attach_badges(
        results, "requester_id", "requester_email", "requester_rating_avg",
        "requester_rating_count", "requester_badges", "requester_college_id"
    )
    return results

async def my_requests(user: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Get all join requests made by the user (any status).

    Args:
        user: Authenticated user dictionary

    Returns:
        List of join request dictionaries with pool info
    """
    # Fetch user's requests
    cursor = db.join_requests.find(
        {"requester_id": user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1)
    results = await cursor.to_list(200)

    # Enrich with pool information would happen in route handlers
    return results

async def accept_request(request_id: str, user_id: str) -> Optional[Dict[str, Any]]:
    """
    Accept a join request (pool owner only).

    Args:
        request_id: ID of the join request to accept
        user_id: ID of the user accepting (must be pool owner)

    Returns:
        Updated join request data if successful, None otherwise

    Raises:
        Exception: If request not found, not pending, or user not pool owner
    """
    # Fetch request
    req_doc = await db.join_requests.find_one(
        {"request_id": request_id},
        {"_id": 0}
    )
    if not req_doc:
        raise Exception("Request not found")

    # Verify user is pool owner
    if req_doc["pool_owner_id"] != user_id:
        raise Exception("Not your pool")

    # Verify request is still pending
    if req_doc["status"] != "pending":
        raise Exception("This request was already responded to")

    # Update request status
    await db.join_requests.update_one(
        {"request_id": request_id},
        {"$set": {"status": "accepted", "responded_at": _now_utc()}}
    )

    # Add requester to pool's confirmed travelers
    pool = await db.pools.find_one(
        {"pool_id": req_doc["pool_id"]},
        {"_id": 0}
    )
    if pool:
        await db.pools.update_one(
            {"pool_id": req_doc["pool_id"]},
            {"$push": {
                "confirmed_travelers": {
                    "user_id": req_doc["requester_id"],
                    "name": req_doc["requester_name"],
                    "email": req_doc["requester_email"]
                }
            }}
        )

        # Send notifications to requester
        try:
            await send_push(
                req_doc["requester_id"],
                "Request accepted!",
                f"{pool['user_name']} accepted your request to travel together: {pool['from_location']} → {pool['to_location']}",
                "/(tabs)/matches"
            )
            await send_email(
                req_doc["requester_email"],
                "UniPool: Request accepted!",
                join_request_email_html(pool["user_name"], req_doc["requester_name"], pool, "accepted")
            )
        except Exception as e:
            logger.warning(f"Failed to send acceptance notifications: {e}")

    # Return updated request
    return await db.join_requests.find_one({"request_id": request_id}, {"_id": 0})

async def decline_request(request_id: str, user_id: str) -> Optional[Dict[str, Any]]:
    """
    Decline a join request (pool owner only).

    Args:
        request_id: ID of the join request to decline
        user_id: ID of the user declining (must be pool owner)

    Returns:
        Updated join request data if successful, None otherwise

    Raises:
        Exception: If request not found, not pending, or user not pool owner
    """
    # Fetch request
    req_doc = await db.join_requests.find_one(
        {"request_id": request_id},
        {"_id": 0}
    )
    if not req_doc:
        raise Exception("Request not found")

    # Verify user is pool owner
    if req_doc["pool_owner_id"] != user_id:
        raise Exception("Not your pool")

    # Verify request is still pending
    if req_doc["status"] != "pending":
        raise Exception("This request was already responded to")

    # Update request status
    await db.join_requests.update_one(
        {"request_id": request_id},
        {"$set": {"status": "declined", "responded_at": _now_utc()}}
    )

    # Return updated request
    return await db.join_requests.find_one({"request_id": request_id}, {"_id": 0})

async def cancel_request(user_id: str, request_id: str) -> bool:
    """
    Cancel a user's own pending join request.

    Args:
        user_id: ID of the user cancelling the request
        request_id: ID of the request to cancel

    Returns:
        True if request was cancelled, False otherwise
    """
    # Delete only if it's the user's own pending request
    result = await db.join_requests.delete_one(
        {
            "request_id": request_id,
            "requester_id": user_id,
            "status": "pending"
        }
    )
    return result.deleted_count > 0

def _clean(item: Dict[str, Any]) -> Dict[str, Any]:
    """
    Remove internal MongoDB fields from item.

    Args:
        item: Dictionary potentially containing MongoDB fields

    Returns:
        Dictionary with internal fields removed
    """
    item.pop("_id", None)
    return item

def _now_utc() -> datetime:
    """Get current UTC datetime."""
    return datetime.now(timezone.utc)