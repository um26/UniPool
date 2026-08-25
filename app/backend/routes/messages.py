"""
Messages routes.
Handles 1:1 messaging and shared trip group chats.
"""

import sys
from pathlib import Path
from datetime import datetime, timezone
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from fastapi import APIRouter, HTTPException, Header
from typing import List, Optional
from services.messages_service import (
    send_message,
    get_conversations,
    get_messages_with_user,
    send_typing_indicator,
    get_typing_status,
    send_group_message,
    get_group_messages,
    ensure_trip_conversation,
)
from models.auth import MessageCreate, MessageOut
from models.response import BaseResponse
from config.database import db
import logging

logger = logging.getLogger("unipool.routes.messages")
router = APIRouter(prefix="/messages", tags=["messages"])


@router.post("", response_model=MessageOut)
async def send_message_endpoint(body: MessageCreate, authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    try:
        user = await get_current_user(authorization)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired session")
        return await send_message(user, body.dict())
    except Exception as e:
        logger.warning(f"Send message failed: {e}")
        if "Message cannot be empty" in str(e):
            raise HTTPException(status_code=400, detail=str(e))
        if "You're sending messages too fast" in str(e):
            raise HTTPException(status_code=429, detail=str(e))
        if "Recipient not found" in str(e):
            raise HTTPException(status_code=404, detail=str(e))
        if "can't message" in str(e):
            raise HTTPException(status_code=403, detail=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/conversations", response_model=List[dict])
async def get_conversations_endpoint(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    try:
        user = await get_current_user(authorization)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired session")
        return await get_conversations(user)
    except Exception as e:
        logger.warning(f"Get conversations failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/trip/ensure/{pool_id}", response_model=dict)
async def ensure_trip_chat_endpoint(pool_id: str, authorization: Optional[str] = Header(None)):
    """Ensure a matched/confirmed user is a member of a route trip chat."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    try:
        user = await get_current_user(authorization)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired session")

        pool = await db.pools.find_one({"pool_id": pool_id}, {"_id": 0})
        if not pool:
            raise HTTPException(status_code=404, detail="Pool not found")

        uid = user["user_id"]
        allowed = pool.get("user_id") == uid or any(t.get("user_id") == uid for t in pool.get("confirmed_travelers", []))

        if not allowed:
            # Algorithmic matches are based on the same route and a ±1 hour
            # travel window. Confirm that the current user owns such a pool.
            own_pools = await db.pools.find(
                {"user_id": uid, "status": "open", "from_location": {"$regex": f"^{pool['from_location']}$", "$options": "i"}, "to_location": {"$regex": f"^{pool['to_location']}$", "$options": "i"}},
                {"_id": 0, "travel_datetime": 1},
            ).to_list(50)
            target_dt = pool.get("travel_datetime")
            if target_dt:
                if target_dt.tzinfo is None:
                    target_dt = target_dt.replace(tzinfo=timezone.utc)
                allowed = any(
                    abs(((own.get("travel_datetime") or target_dt).replace(tzinfo=timezone.utc) if getattr(own.get("travel_datetime"), "tzinfo", None) is None else own.get("travel_datetime")) - target_dt).total_seconds()) <= 3600
                    for own in own_pools
                    if own.get("travel_datetime")
                )

        if not allowed:
            raise HTTPException(status_code=403, detail="You are not matched to this trip")

        conversation = await ensure_trip_conversation(pool_id, [uid])
        return {
            "conversation_id": conversation["conversation_id"],
            "name": conversation["name"],
            "members_count": len(conversation.get("member_ids", [])),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Ensure trip chat failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/group/{conversation_id}", response_model=dict)
async def get_group_messages_endpoint(conversation_id: str, authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    try:
        user = await get_current_user(authorization)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired session")
        return await get_group_messages(user, conversation_id)
    except Exception as e:
        logger.warning(f"Get group messages failed: {e}")
        if "not a member" in str(e).lower():
            raise HTTPException(status_code=403, detail=str(e))
        if "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/group/{conversation_id}", response_model=dict)
async def send_group_message_endpoint(conversation_id: str, body: dict, authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    try:
        user = await get_current_user(authorization)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired session")
        return await send_group_message(user, conversation_id, body.get("text", ""))
    except Exception as e:
        logger.warning(f"Send group message failed: {e}")
        if "Message cannot be empty" in str(e):
            raise HTTPException(status_code=400, detail=str(e))
        if "too fast" in str(e):
            raise HTTPException(status_code=429, detail=str(e))
        if "not a member" in str(e).lower():
            raise HTTPException(status_code=403, detail=str(e))
        if "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{other_user_id}", response_model=List[MessageOut])
async def get_messages_with_user_endpoint(other_user_id: str, authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    try:
        user = await get_current_user(authorization)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired session")
        return await get_messages_with_user(user, other_user_id)
    except Exception as e:
        logger.warning(f"Get messages with user failed: {e}")
        if "User not found" in str(e):
            raise HTTPException(status_code=404, detail=str(e))
        if "can't message" in str(e):
            raise HTTPException(status_code=403, detail=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/typing", response_model=BaseResponse)
async def send_typing_endpoint(body: dict, authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    try:
        user = await get_current_user(authorization)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired session")
        success = await send_typing_indicator(user["user_id"], body.get("to_user_id"))
        if not success:
            raise HTTPException(status_code=400, detail="Cannot send typing indicator to self")
        return BaseResponse()
    except Exception as e:
        logger.warning(f"Send typing indicator failed: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/typing/{other_user_id}", response_model=dict)
async def get_typing_endpoint(other_user_id: str, authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    try:
        user = await get_current_user(authorization)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired session")
        return {"typing": await get_typing_status(user["user_id"], other_user_id)}
    except Exception as e:
        logger.warning(f"Get typing status failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    from services.auth_service import get_current_user as get_user_from_session
    return await get_user_from_session(authorization)


__all__ = ["router"]
