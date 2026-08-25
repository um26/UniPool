"""
Messaging service.
Supports both legacy 1:1 conversations and shared trip group chats.
"""

from typing import List, Optional, Dict, Any
from datetime import timedelta, datetime, timezone
import uuid

from config.database import db
import logging

logger = logging.getLogger("unipool.messages")

TYPING_STATE: Dict[tuple, datetime] = {}
TYPING_TTL_SECONDS = 4


def _ensure_aware(dt: datetime) -> datetime:
    if dt.tzinfo is None or dt.tzinfo.utcoffset(dt) is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _is_online(last_seen: Optional[datetime]) -> bool:
    if not last_seen:
        return False
    return (_now_utc() - _ensure_aware(last_seen)).total_seconds() < TYPING_TTL_SECONDS * 15


def _route_key(from_location: str, to_location: str) -> str:
    return f"{from_location.strip().casefold()}::{to_location.strip().casefold()}"


async def ensure_trip_conversation(
    pool_id: str,
    extra_member_ids: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Create/reuse the shared trip chat for a route/time window and add members."""
    pool = await db.pools.find_one({"pool_id": pool_id}, {"_id": 0})
    if not pool:
        raise Exception("Pool not found")

    member_ids: List[str] = [pool["user_id"]]
    member_ids.extend(t.get("user_id") for t in pool.get("confirmed_travelers", []) if t.get("user_id"))
    member_ids.extend(extra_member_ids or [])
    member_ids = list(dict.fromkeys(member_ids))

    route_key = _route_key(pool["from_location"], pool["to_location"])
    travel_dt = _ensure_aware(pool["travel_datetime"])

    # Reuse an existing trip chat when it represents the same route and is
    # within the same ±1 hour matching window. This lets A+B become a group,
    # then automatically pulls C into that same group when C matches later.
    candidates = await db.conversations.find(
        {"type": "trip", "route_key": route_key},
        {"_id": 0},
    ).to_list(100)
    for conversation in candidates:
        existing_dt = conversation.get("travel_datetime")
        if existing_dt is None:
            continue
        if abs((_ensure_aware(existing_dt) - travel_dt).total_seconds()) <= 3600:
            await db.conversations.update_one(
                {"conversation_id": conversation["conversation_id"]},
                {
                    "$addToSet": {"member_ids": {"$each": member_ids}},
                    "$set": {
                        "name": f"{pool['from_location']} → {pool['to_location']}",
                        "updated_at": _now_utc(),
                        "last_pool_id": pool_id,
                    },
                },
            )
            return await db.conversations.find_one(
                {"conversation_id": conversation["conversation_id"]}, {"_id": 0}
            )

    conversation_id = f"trip_{uuid.uuid4().hex[:12]}"
    doc = {
        "conversation_id": conversation_id,
        "type": "trip",
        "name": f"{pool['from_location']} → {pool['to_location']}",
        "route_key": route_key,
        "from_location": pool["from_location"],
        "to_location": pool["to_location"],
        "travel_datetime": travel_dt,
        "last_pool_id": pool_id,
        "member_ids": member_ids,
        "created_at": _now_utc(),
        "updated_at": _now_utc(),
    }
    await db.conversations.insert_one(doc)
    return doc


async def send_message(user: Dict[str, Any], body: Dict[str, Any]) -> Dict[str, Any]:
    if not body.get("text", "").strip():
        raise Exception("Message cannot be empty")

    recent_msgs = await db.messages.count_documents({
        "from_user_id": user["user_id"],
        "created_at": {"$gte": _now_utc() - timedelta(minutes=1)},
    })
    if recent_msgs >= 30:
        raise Exception("You're sending messages too fast. Slow down a bit.")

    to_user = await db.users.find_one(
        {"user_id": body["to_user_id"]}, {"_id": 0, "password_hash": 0}
    )
    if not to_user:
        raise Exception("Recipient not found")

    from services.pool_service import _is_blocked_pair
    if await _is_blocked_pair(user["user_id"], body["to_user_id"]):
        raise Exception("You can't message this user")

    message_doc = {
        "message_id": f"msg_{uuid.uuid4().hex[:12]}",
        "from_user_id": user["user_id"],
        "to_user_id": body["to_user_id"],
        "pool_id": body.get("pool_id"),
        "text": body["text"].strip(),
        "created_at": _now_utc(),
        "read": False,
    }
    await db.messages.insert_one(message_doc)
    return _clean(dict(message_doc))


async def send_group_message(user: Dict[str, Any], conversation_id: str, text: str) -> Dict[str, Any]:
    if not text.strip():
        raise Exception("Message cannot be empty")

    conversation = await db.conversations.find_one(
        {"conversation_id": conversation_id, "type": "trip"}, {"_id": 0}
    )
    if not conversation:
        raise Exception("Conversation not found")
    if user["user_id"] not in conversation.get("member_ids", []):
        raise Exception("You are not a member of this trip chat")

    recent_msgs = await db.messages.count_documents({
        "from_user_id": user["user_id"],
        "created_at": {"$gte": _now_utc() - timedelta(minutes=1)},
    })
    if recent_msgs >= 30:
        raise Exception("You're sending messages too fast. Slow down a bit.")

    message_doc = {
        "message_id": f"msg_{uuid.uuid4().hex[:12]}",
        "conversation_id": conversation_id,
        "conversation_type": "trip",
        "from_user_id": user["user_id"],
        "to_user_id": None,
        "pool_id": conversation.get("last_pool_id"),
        "text": text.strip(),
        "created_at": _now_utc(),
        "read_by": [user["user_id"]],
    }
    await db.messages.insert_one(message_doc)
    await db.conversations.update_one(
        {"conversation_id": conversation_id},
        {"$set": {"updated_at": message_doc["created_at"]}},
    )
    return _clean(dict(message_doc))


async def get_conversations(user: Dict[str, Any]) -> List[Dict[str, Any]]:
    uid = user["user_id"]
    conversations: List[Dict[str, Any]] = []

    # Legacy 1:1 conversations.
    direct_pipeline = [
        {"$match": {"$or": [{"from_user_id": uid}, {"to_user_id": uid}]}},
        {"$sort": {"created_at": 1}},
        {
            "$group": {
                "_id": {
                    "$cond": [
                        {"$eq": ["$from_user_id", uid]},
                        "$to_user_id",
                        "$from_user_id",
                    ]
                },
                "last_message": {"$last": "$$ROOT"},
                "count": {"$sum": 1},
            }
        },
        {"$sort": {"last_message.created_at": -1}},
    ]
    direct = await db.messages.aggregate(direct_pipeline).to_list(100)
    other_ids = [c["_id"] for c in direct]
    if other_ids:
        users = await db.users.find(
            {"user_id": {"$in": other_ids}}, {"_id": 0, "password_hash": 0}
        ).to_list(len(other_ids))
        user_map = {u["user_id"]: u for u in users}
        for conv in direct:
            other_id = conv["_id"]
            other = user_map.get(other_id, {})
            last = conv["last_message"]
            unread = await db.messages.count_documents({
                "from_user_id": other_id,
                "to_user_id": uid,
                "read": False,
            })
            conversations.append({
                "kind": "direct",
                "other_user_id": other_id,
                "name": other.get("name", "Unknown"),
                "picture": other.get("picture"),
                "last_message": last.get("text", ""),
                "last_at": last.get("created_at"),
                "unread": unread,
                "online": _is_online(other.get("last_seen")),
            })

    # Shared trip conversations.
    groups = await db.conversations.find(
        {"type": "trip", "member_ids": uid}, {"_id": 0}
    ).sort("updated_at", -1).to_list(100)
    for group in groups:
        last = await db.messages.find_one(
            {"conversation_id": group["conversation_id"]},
            {"_id": 0},
            sort=[("created_at", -1)],
        )
        if last:
            last_text = last.get("text", "")
            last_at = last.get("created_at")
            unread = await db.messages.count_documents({
                "conversation_id": group["conversation_id"],
                "from_user_id": {"$ne": uid},
                "read_by": {"$ne": uid},
            })
        else:
            last_text = "Trip chat created — coordinate your ride here."
            last_at = group.get("updated_at") or group.get("created_at")
            unread = 0
        conversations.append({
            "kind": "group",
            "conversation_id": group["conversation_id"],
            "name": group["name"],
            "group_name": group["name"],
            "members_count": len(group.get("member_ids", [])),
            "last_message": last_text,
            "last_at": last_at,
            "unread": unread,
            "online": False,
        })

    conversations.sort(key=lambda c: _ensure_aware(c["last_at"]) if c.get("last_at") else datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    return conversations


async def get_messages_with_user(user: Dict[str, Any], other_user_id: str, limit: int = 50) -> List[Dict[str, Any]]:
    uid = user["user_id"]
    other_user = await db.users.find_one(
        {"user_id": other_user_id}, {"_id": 0, "password_hash": 0}
    )
    if not other_user:
        raise Exception("User not found")

    from services.pool_service import _is_blocked_pair
    if await _is_blocked_pair(uid, other_user_id):
        raise Exception("You can't message this user")

    cursor = db.messages.find(
        {"$or": [
            {"from_user_id": uid, "to_user_id": other_user_id},
            {"from_user_id": other_user_id, "to_user_id": uid},
        ]},
        {"_id": 0},
    ).sort("created_at", 1).limit(limit)
    messages = await cursor.to_list(limit)

    await db.messages.update_many(
        {"from_user_id": other_user_id, "to_user_id": uid, "read": False},
        {"$set": {"read": True}},
    )
    return [_clean(dict(msg)) for msg in messages]


async def get_group_messages(user: Dict[str, Any], conversation_id: str, limit: int = 100) -> Dict[str, Any]:
    conversation = await db.conversations.find_one(
        {"conversation_id": conversation_id, "type": "trip"}, {"_id": 0}
    )
    if not conversation:
        raise Exception("Conversation not found")
    if user["user_id"] not in conversation.get("member_ids", []):
        raise Exception("You are not a member of this trip chat")

    cursor = db.messages.find(
        {"conversation_id": conversation_id}, {"_id": 0}
    ).sort("created_at", 1).limit(limit)
    messages = await cursor.to_list(limit)

    await db.messages.update_many(
        {"conversation_id": conversation_id, "from_user_id": {"$ne": user["user_id"]}, "read_by": {"$ne": user["user_id"]}},
        {"$addToSet": {"read_by": user["user_id"]}},
    )

    member_ids = conversation.get("member_ids", [])
    members = await db.users.find(
        {"user_id": {"$in": member_ids}},
        {"_id": 0, "password_hash": 0},
    ).to_list(len(member_ids))
    member_map = {m["user_id"]: m for m in members}
    return {
        "conversation_id": conversation_id,
        "name": conversation["name"],
        "members": [
            {"user_id": mid, "name": member_map.get(mid, {}).get("name", "Traveller")}
            for mid in member_ids
        ],
        "messages": [_clean(dict(msg)) for msg in messages],
    }


async def send_typing_indicator(user_id: str, other_user_id: str) -> bool:
    if user_id == other_user_id:
        return False
    TYPING_STATE[(user_id, other_user_id)] = _now_utc()
    return True


async def get_typing_status(user_id: str, other_user_id: str) -> bool:
    if user_id == other_user_id:
        return False
    ts = TYPING_STATE.get((other_user_id, user_id))
    return bool(ts and (_now_utc() - ts).total_seconds() < TYPING_TTL_SECONDS)


def _clean(item: Dict[str, Any]) -> Dict[str, Any]:
    item.pop("_id", None)
    return item
