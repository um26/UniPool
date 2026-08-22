"""
Messages routes.
Handles user-to-user messaging functionality.
"""

import sys
from pathlib import Path

# Add the backend directory to the Python path so we can import from it
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from fastapi import APIRouter, HTTPException, Header
from typing import List, Optional
from services.messages_service import (
    send_message, get_conversations, get_messages_with_user,
    send_typing_indicator, get_typing_status
)
from models.auth import MessageCreate, MessageOut
from models.response import BaseResponse
import logging

logger = logging.getLogger("unipool.routes.messages")

# Create router
router = APIRouter(prefix="/messages", tags=["messages"])


@router.post("", response_model=MessageOut)
async def send_message_endpoint(
    body: MessageCreate,
    authorization: Optional[str] = Header(None)
):
    """Send a message to another user."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    try:
        user = await get_current_user(authorization)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired session")

        message_data = await send_message(user, body.dict())
        return message_data
    except Exception as e:
        logger.warning(f"Send message failed: {e}")
        if "Message cannot be empty" in str(e) or \
           "You're sending messages too fast" in str(e) or \
           "Recipient not found" in str(e) or \
           "You can't message this user" in str(e):
            if "Message cannot be empty" in str(e):
                raise HTTPException(status_code=400, detail=str(e))
            elif "You're sending messages too fast" in str(e):
                raise HTTPException(status_code=429, detail=str(e))
            else:
                raise HTTPException(status_code=404 if "not found" in str(e).lower() else 403, detail=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/conversations", response_model=List[dict])
async def get_conversations_endpoint(authorization: Optional[str] = Header(None)):
    """Get list of message conversations for the current user."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    try:
        user = await get_current_user(authorization)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired session")

        conversations = await get_conversations(user)
        return conversations
    except Exception as e:
        logger.warning(f"Get conversations failed: {e}")
        raise HTTPException(status_code=401, detail=str(e))


@router.get("/{other_user_id}", response_model=List[MessageOut])
async def get_messages_with_user_endpoint(
    other_user_id: str,
    authorization: Optional[str] = Header(None)
):
    """Get message history with a specific user."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    try:
        user = await get_current_user(authorization)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired session")

        messages = await get_messages_with_user(user, other_user_id)
        return messages
    except Exception as e:
        logger.warning(f"Get messages with user failed: {e}")
        if "User not found" in str(e):
            raise HTTPException(status_code=404, detail=str(e))
        if "You can't message this user" in str(e):
            raise HTTPException(status_code=403, detail=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/typing", response_model=BaseResponse)
async def send_typing_endpoint(
    body: dict,
    authorization: Optional[str] = Header(None)
):
    """Indicate that the user is typing to another user."""
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
async def get_typing_endpoint(
    other_user_id: str,
    authorization: Optional[str] = Header(None)
):
    """Check if a user is typing to the current user."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    try:
        user = await get_current_user(authorization)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired session")

        is_typing = await get_typing_status(user["user_id"], other_user_id)
        return {"typing": is_typing}
    except Exception as e:
        logger.warning(f"Get typing status failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Helper function to get current user (imported from auth service)
async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """Get current user from authorization header."""
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    from services.auth_service import get_current_user as get_user_from_session
    return await get_user_from_session(authorization)


# Export the router
__all__ = ["router"]