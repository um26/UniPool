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
    if not pool or pool.get("status") != "open":
        return False
    from services.auth_service import _ensure_aware, _now_utc
    return _ensure_aware(pool["travel_datetime"]) > _now_utc()


async def create_join_request(user: Dict[str, Any], pool_id: str) -> Dict[str, Any]:
    pool = await db.pools.find_one({"pool_id": pool_id}, {"_id": 0})
    if not pool:
        raise Exception("Pool not found")
    if pool["user_id"] == user["user_id"]:
        raise Exception("You can't request to join your own pool")
    if not _pool_is_joinable(pool):
        raise Exception("This pool is no longer accepting requests")
    if any(t["user_id"] == user["user_id"] for t in pool.get("confirmed_travelers", [])):
        raise Exception("You're already confirmed on this pool")

    from services.pool_service import _is_blocked_pair
    if await _is_blocked_pair(user["user_id"], pool["user_id"]):
        raise Exception("You can't request to join this pool")

    existing = await db.join_requests.find_one(
        {"pool_id": pool_id, "requester_id": user["user_id"], "status": {"$in": ["pending", "accepted"]}},
        {"_id": 0},
    )
    if existing:
        raise Exception("You already have a request on this pool")

    request_doc = {
        "request_id": f"req_{__import__('uuid').uuid4().hex[:12]}",
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
    await db.join_requests.insert_one(request_doc)

    try:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"temp_requester_name": request_doc["requester_name"]}})
        await send_push(
            pool["user_id"],
            "New ride request",
            f"{request_doc['requester_name']} wants to travel with you: {pool['from_location']} → {pool['to_location']}",
            "/(tabs)/matches",
        )
        await send_email(pool["user_email"], "UniPool: New ride request", join_request_email_html(pool["user_name"], request_doc["requester_name"], pool, "received"))
    except Exception as e:
        logger.warning(f"Failed to send join request notifications: {e}")

    return _clean(dict(request_doc))


async def list_pool_requests(pool_id: str, user_id: str) -> List[Dict[str, Any]]:
    pool = await db.pools.find_one({"pool_id": pool_id}, {"_id": 0})
    if not pool:
        raise Exception("Pool not found")
    if pool["user_id"] != user_id:
        raise Exception("Not your pool")
    cursor = db.join_requests.find({"pool_id": pool_id}, {"_id": 0}).sort("created_at", -1)
    return await cursor.to_list(200)


async def incoming_requests(user: Dict[str, Any]) -> List[Dict[str, Any]]:
    cursor = db.join_requests.find({"pool_owner_id": user["user_id"], "status": "pending"}, {"_id": 0}).sort("created_at", -1)
    results = await cursor.to_list(200)
    results = await _attach_requester_ratings(results)
    results = await _attach_badges(results, "requester_id", "requester_email", "requester_rating_avg", "requester_rating_count", "requester_badges", "requester_college_id")
    return results


async def my_requests(user: Dict[str, Any]) -> List[Dict[str, Any]]:
    cursor = db.join_requests.find({"requester_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1)
    return await cursor.to_list(200)


async def accept_request(request_id: str, user_id: str) -> Optional[Dict[str, Any]]:
    req_doc = await db.join_requests.find_one({"request_id": request_id}, {"_id": 0})
    if not req_doc:
        raise Exception("Request not found")
    if req_doc["pool_owner_id"] != user_id:
        raise Exception("Not your pool")
    if req_doc["status"] != "pending":
        raise Exception("This request was already responded to")

    await db.join_requests.update_one({"request_id": request_id}, {"$set": {"status": "accepted", "responded_at": _now_utc()}})
    pool = await db.pools.find_one({"pool_id": req_doc["pool_id"]}, {"_id": 0})
    conversation = None
    if pool:
        await db.pools.update_one(
            {"pool_id": req_doc["pool_id"]},
            {"$addToSet": {"confirmed_travelers": {"user_id": req_doc["requester_id"], "name": req_doc["requester_name"], "email": req_doc["requester_email"]}}},
        )
        try:
            from services.messages_service import ensure_trip_conversation
            conversation = await ensure_trip_conversation(req_doc["pool_id"], [req_doc["requester_id"]])
        except Exception as e:
            logger.warning(f"Could not create trip conversation: {e}")

        try:
            chat_route = f"/chat/group/{conversation['conversation_id']}" if conversation else "/(tabs)/matches"
            await send_push(
                req_doc["requester_id"],
                "Request accepted!",
                f"{pool['user_name']} accepted your request to travel together: {pool['from_location']} → {pool['to_location']}",
                chat_route,
            )
            await send_email(req_doc["requester_email"], "UniPool: Request accepted!", join_request_email_html(pool["user_name"], req_doc["requester_name"], pool, "accepted"))
        except Exception as e:
            logger.warning(f"Failed to send acceptance notifications: {e}")

    updated = await db.join_requests.find_one({"request_id": request_id}, {"_id": 0})
    if conversation:
        updated["conversation_id"] = conversation["conversation_id"]
        updated["conversation_name"] = conversation["name"]
    return updated


async def decline_request(request_id: str, user_id: str) -> Optional[Dict[str, Any]]:
    req_doc = await db.join_requests.find_one({"request_id": request_id}, {"_id": 0})
    if not req_doc:
        raise Exception("Request not found")
    if req_doc["pool_owner_id"] != user_id:
        raise Exception("Not your pool")
    if req_doc["status"] != "pending":
        raise Exception("This request was already responded to")
    await db.join_requests.update_one({"request_id": request_id}, {"$set": {"status": "declined", "responded_at": _now_utc()}})
    return await db.join_requests.find_one({"request_id": request_id}, {"_id": 0})


async def cancel_request(user_id: str, request_id: str) -> bool:
    result = await db.join_requests.delete_one({"request_id": request_id, "requester_id": user_id, "status": "pending"})
    return result.deleted_count > 0


def _clean(item: Dict[str, Any]) -> Dict[str, Any]:
    item.pop("_id", None)
    return item


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)
