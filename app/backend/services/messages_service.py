"""
Messages service.
Contains business logic for managing user-to-user messaging.
"""

from typing import List, Optional, Dict, Any
from datetime import timedelta
from config.database import db
from helpers.college_helper import _attach_badges
import logging
from datetime import datetime, timezone

logger = logging.getLogger("unipool.messages")

# In-memory "is typing" state: {(from_user_id, to_user_id): last_ping_at}.
# Ephemeral by design — a restart clearing it is harmless, and it avoids
# writing throwaway data to Mongo on every keystroke.
TYPING_STATE: Dict[tuple, datetime] = {}
TYPING_TTL_SECONDS = 4  # seconds

def _ensure_aware(dt: datetime) -> datetime:
    """Ensure datetime is timezone aware."""
    if dt.tzinfo is None or dt.tzinfo.utcoffset(dt) is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt

def _now_utc() -> datetime:
    """Get current UTC datetime."""
    return datetime.now(timezone.utc)

def _is_online(last_seen: Optional[datetime]) -> bool:
    """Check if user is online based on last seen timestamp."""
    if not last_seen:
        return False
    return (_now_utc() - _ensure_aware(last_seen)).total_seconds() < TYPING_TTL_SECONDS * 15  # 4*15 = 60 seconds default

async def send_message(user: Dict[str, Any], body: Dict[str, Any]) -> Dict[str, Any]:
    """
    Send a message from one user to another.

    Args:
        user: Authenticated user sending the message
        body: Message data containing recipient ID and text

    Returns:
        Sent message data

    Raises:
        Exception: If message is empty, user sending too fast, recipient not found, or users blocked
    """
    # Validate message content
    if not body.get("text", "").strip():
        raise Exception("Message cannot be empty")

    # Rate limiting: prevent spamming
    recent_msgs = await db.messages.count_documents(
        {
            "from_user_id": user["user_id"],
            "created_at": {"$gte": _now_utc() - timedelta(minutes=1)}
        }
    )
    if recent_msgs >= 30:
        raise Exception("You're sending messages too fast. Slow down a bit.")

    # Validate recipient exists
    to_user = await db.users.find_one(
        {"user_id": body["to_user_id"]},
        {"_id": 0, "password_hash": 0}
    )
    if not to_user:
        raise Exception("Recipient not found")

    # Check if users are blocked from communicating
    from services.pool_service import _is_blocked_pair
    if await _is_blocked_pair(user["user_id"], body["to_user_id"]):
        raise Exception("You can't message this user")

    # Create message document
    message_id = f"msg_{__import__('uuid').uuid4().hex[:12]}"
    message_doc = {
        "message_id": message_id,
        "from_user_id": user["user_id"],
        "to_user_id": body["to_user_id"],
        "pool_id": body.get("pool_id"),
        "text": body["text"].strip(),
        "created_at": _now_utc(),
        "read": False,
    }

    # Save to database
    await db.messages.insert_one(message_doc)

    # Return cleaned message data
    return _clean(dict(message_doc))

async def get_conversations(user: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Get list of message conversations for the user.

    Args:
        user: Authenticated user dictionary

    Returns:
        List of conversation dictionaries with other user info and last message
    """
    uid = user["user_id"]

    # Get unique conversation partners from both sent and received messages
    pipeline = [
        {
            "$match": {
                "$or": [
                    {"from_user_id": uid},
                    {"to_user_id": uid}
                ]
            }
        },
        {
            "$group": {
                "_id": {
                    "$cond": [
                        {"$eq": ["$from_user_id", uid]},
                        "$to_user_id",
                        "$from_user_id"
                    ]
                },
                "last_message": {
                    "$last": "$$ROOT"
                },
                "count": {"$sum": 1}
            }
        },
        {"$sort": {"last_message.created_at": -1}}
    ]

    conversations = await db.messages.aggregate(pipeline).to_list(100)

    # Enrich with user information and unread counts
    other_ids = [c["_id"] for c in conversations]
    if not other_ids:
        return []
    
    if other_ids:
        users = await db.users.find(
            {"user_id": {"$in": other_ids}},
            {"_id": 0, "password_hash": 0}
        ).to_list(len(other_ids))
        user_map = {u["user_id"]: u for u in users}

        # Process each conversation
        for conv in conversations:
            other_user_id = conv["_id"]
            other_user = user_map.get(other_user_id, {})
            last_message = conv["last_message"]

            # Count unread messages from this user
            unread_count = await db.messages.count_documents({
                "from_user_id": other_user_id,
                "to_user_id": uid,
                "read": False
            })

            conv.update({
                "other_user_id": other_user_id,
                "name": other_user.get("name", "Unknown"),
                "picture": other_user.get("picture"),
                "last_message": last_message["text"],
                "last_at": last_message["created_at"],
                "unread": unread_count,
                "online": _is_online(other_user.get("last_seen"))
            })
            # Remove internal fields
            conv.pop("_id", None)
            conv.pop("count", None)

    return conversations

async def get_messages_with_user(user: Dict[str, Any], other_user_id: str, limit: int = 50) -> List[Dict[str, Any]]:
    """
    Get message history between the current user and another user.

    Args:
        user: Authenticated user dictionary
        other_user_id: ID of the other user in the conversation
        limit: Maximum number of messages to return

    Returns:
        List of message dictionaries sorted by creation time (oldest first)
    """
    uid = user["user_id"]

    # Validate that other user exists
    other_user = await db.users.find_one(
        {"user_id": other_user_id},
        {"_id": 0, "password_hash": 0}
    )
    if not other_user:
        raise Exception("User not found")

    # Check if users are blocked from communicating
    from services.pool_service import _is_blocked_pair
    if await _is_blocked_pair(user["user_id"], other_user_id):
        raise Exception("You can't message this user")

    # Fetch messages between users
    cursor = db.messages.find(
        {
            "$or": [
                {"from_user_id": uid, "to_user_id": other_user_id},
                {"from_user_id": other_user_id, "to_user_id": uid}
            ]
        },
        {"_id": 0}
    ).sort("created_at", 1).limit(limit)

    messages = await cursor.to_list(limit)

    # Clean and return messages
    return [_clean(dict(msg)) for msg in messages]

async def send_typing_indicator(user_id: str, other_user_id: str) -> bool:
    """
    Indicate that a user is typing to another user.

    Args:
        user_id: ID of the user typing
        other_user_id: ID of the user being typed to

    Returns:
        True if typing indicator was set, False otherwise
    """
    # Prevent self-typing indicators
    if user_id == other_user_id:
        return False

    # Set typing timestamp
    TYPING_STATE[(user_id, other_user_id)] = _now_utc()
    return True

async def get_typing_status(user_id: str, other_user_id: str) -> bool:
    """
    Check if a user is typing to another user.

    Args:
        user_id: ID of the potential typer
        other_user_id: ID of the potential recipient

    Returns:
        True if user is typing to other user, False otherwise
    """
    # Prevent self-check
    if user_id == other_user_id:
        return False

    # Check typing state
    ts = TYPING_STATE.get((other_user_id, user_id))  # Note: reversed for checking if other is typing to user
    typing = bool(ts and (_now_utc() - ts).total_seconds() < TYPING_TTL_SECONDS)
    return typing

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