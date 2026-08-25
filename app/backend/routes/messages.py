"""Direct messaging and automatic shared-trip chat routes."""

from fastapi import APIRouter, HTTPException, Header
from typing import Optional
import logging

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

logger = logging.getLogger("unipool.routes.messages")
router = APIRouter(prefix="/messages", tags=["messages"])


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    from services.auth_service import get_current_user as get_user_from_session
    return await get_user_from_session(authorization)


@router.post("", response_model=MessageOut)
async def send_message_endpoint(body: MessageCreate, authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    try:
        user = await get_current_user(authorization)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired session")
        return await send_message(user, body.dict())
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("Send message failed: %s", e)
        if "empty" in str(e).lower(): raise HTTPException(status_code=400, detail=str(e))
        if "too fast" in str(e).lower(): raise HTTPException(status_code=429, detail=str(e))
        if "not found" in str(e).lower(): raise HTTPException(status_code=404, detail=str(e))
        if "can't message" in str(e).lower(): raise HTTPException(status_code=403, detail=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/conversations", response_model=list[dict])
async def get_conversations_endpoint(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    try:
        user = await get_current_user(authorization)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired session")
        return await get_conversations(user)
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("Get conversations failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/trip/ensure/{pool_id}", response_model=dict)
async def ensure_trip_chat_endpoint(pool_id: str, authorization: Optional[str] = Header(None)):
    """Return the group chat for a confirmed OR backend-calculated match."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    user = await get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    pool = await db.pools.find_one({"pool_id": pool_id}, {"_id": 0})
    if not pool:
        raise HTTPException(status_code=404, detail="Pool not found")

    uid = user["user_id"]
    allowed = pool.get("user_id") == uid or any(
        traveler.get("user_id") == uid for traveler in pool.get("confirmed_travelers", [])
    )

    if not allowed:
        # Use exactly the same backend matcher that produced the percentage in
        # the Matches screen. This removes the old exact-string/±1h mismatch
        # that rejected valid route aliases and stronger compatibility matches.
        try:
            from services.match_service import smart_matches
            matches = await smart_matches(uid)
            allowed = any(match.get("pool_id") == pool_id for match in matches)
        except Exception as e:
            logger.warning("Could not verify algorithmic match for chat: %s", e)
            allowed = False

    if not allowed:
        raise HTTPException(status_code=403, detail="You are not matched to this trip")

    try:
        conversation = await ensure_trip_conversation(pool_id, [uid])
        await db.pools.update_one(
            {"pool_id": pool_id},
            {"$set": {"trip_conversation_id": conversation["conversation_id"]}},
        )
        return {
            "conversation_id": conversation["conversation_id"],
            "name": conversation["name"],
            "members_count": len(conversation.get("member_ids", [])),
        }
    except Exception as e:
        logger.exception("Ensure trip chat failed: %s", e)
        raise HTTPException(status_code=500, detail="Could not create the trip chat")


@router.get("/group/{conversation_id}", response_model=dict)
async def get_group_messages_endpoint(conversation_id: str, authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    try:
        user = await get_current_user(authorization)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired session")
        return await get_group_messages(user, conversation_id)
    except HTTPException:
        raise
    except Exception as e:
        if "not a member" in str(e).lower(): raise HTTPException(status_code=403, detail=str(e))
        if "not found" in str(e).lower(): raise HTTPException(status_code=404, detail=str(e))
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
    except HTTPException:
        raise
    except Exception as e:
        if "empty" in str(e).lower(): raise HTTPException(status_code=400, detail=str(e))
        if "too fast" in str(e).lower(): raise HTTPException(status_code=429, detail=str(e))
        if "not a member" in str(e).lower(): raise HTTPException(status_code=403, detail=str(e))
        if "not found" in str(e).lower(): raise HTTPException(status_code=404, detail=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/typing", response_model=BaseResponse)
async def send_typing_endpoint(body: dict, authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    user = await get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    if not await send_typing_indicator(user["user_id"], body.get("to_user_id")):
        raise HTTPException(status_code=400, detail="Cannot send typing indicator to self")
    return BaseResponse()


@router.get("/typing/{other_user_id}", response_model=dict)
async def get_typing_endpoint(other_user_id: str, authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    user = await get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    return {"typing": await get_typing_status(user["user_id"], other_user_id)}


@router.get("/{other_user_id}", response_model=list[MessageOut])
async def get_messages_with_user_endpoint(other_user_id: str, authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    try:
        user = await get_current_user(authorization)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired session")
        return await get_messages_with_user(user, other_user_id)
    except HTTPException:
        raise
    except Exception as e:
        if "not found" in str(e).lower(): raise HTTPException(status_code=404, detail=str(e))
        if "can't message" in str(e).lower(): raise HTTPException(status_code=403, detail=str(e))
        raise HTTPException(status_code=500, detail=str(e))


__all__ = ["router"]
