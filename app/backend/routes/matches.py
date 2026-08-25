"""
Matches routes.
Handles confirmed travel matches and related operations.
"""

import sys
from pathlib import Path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from fastapi import APIRouter, HTTPException, Header
from typing import Optional
from services.pool_service import get_confirmed_matches
from services.messages_service import ensure_trip_conversation
import logging

logger = logging.getLogger("unipool.routes.matches")
router = APIRouter(prefix="/matches", tags=["matches"])


@router.get("/confirmed")
async def get_confirmed_matches_endpoint(authorization: Optional[str] = Header(None)):
    """Return confirmed trips and make sure each has a shared group chat."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    try:
        user = await get_current_user(authorization)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired session")

        matches = await get_confirmed_matches(user["user_id"])
        for match in matches:
            try:
                conversation = await ensure_trip_conversation(match["pool_id"], [match["other_user_id"]])
                match["conversation_id"] = conversation["conversation_id"]
                match["conversation_name"] = conversation["name"]
            except Exception as chat_error:
                logger.warning(f"Could not attach trip chat to {match.get('pool_id')}: {chat_error}")
        return matches
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Get confirmed matches failed: {type(e).__name__}: {e}")
        # A historical/deleted pool should not blank the whole Matches tab.
        # Authentication failures are still surfaced above.
        return []


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    from services.auth_service import get_current_user as get_user_from_session
    return await get_user_from_session(authorization)
