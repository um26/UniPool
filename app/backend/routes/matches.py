"""
Matches routes.
Handles confirmed travel matches and related operations.
"""

import sys
from pathlib import Path

# Add the backend directory to the Python path so we can import from it
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from fastapi import APIRouter, HTTPException, Header
from typing import Optional
from services.pool_service import get_confirmed_matches
import logging

logger = logging.getLogger("unipool.routes.matches")

# Create router
router = APIRouter(prefix="/matches", tags=["matches"])


@router.get("/confirmed")
async def get_confirmed_matches_endpoint(authorization: Optional[str] = Header(None)):
    """Get all confirmed travel matches for the current user."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    try:
        user = await get_current_user(authorization)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired session")

        matches = await get_confirmed_matches(user["user_id"])
        return matches
    except Exception as e:
        logger.warning(f"Get confirmed matches failed: {e}")
        raise HTTPException(status_code=401, detail=str(e))


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """Get current user from authorization header."""
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    from services.auth_service import get_current_user as get_user_from_session
    return await get_user_from_session(authorization)
