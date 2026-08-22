"""
Profile routes.
Handles user profile management and related operations.
"""

import sys
from pathlib import Path

# Add the backend directory to the Python path so we can import from it
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from fastapi import APIRouter, HTTPException, Header
from typing import List, Optional
from services.user_service import (
    update_profile, submit_rating, get_user_ratings, can_rate,
    block_user, unblock_user, list_blocked
)
from models.user import UserProfileUpdate
from models.auth import RatingCreate
from models.response import BaseResponse
import logging

logger = logging.getLogger("unipool.routes.profile")

# Create router
router = APIRouter(prefix="/profile", tags=["profile"])


@router.patch("", response_model=dict)
async def update_profile_endpoint(
    body: UserProfileUpdate,
    authorization: Optional[str] = Header(None)
):
    """Update user profile information."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    try:
        user = await get_current_user(authorization)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired session")

        updated_user = await update_profile(user["user_id"], body)
        if not updated_user:
            raise HTTPException(status_code=404, detail="User not found")

        return updated_user
    except Exception as e:
        logger.warning(f"Update profile failed: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/ratings", response_model=dict)
async def submit_rating_endpoint(
    body: RatingCreate,
    authorization: Optional[str] = Header(None)
):
    """Submit a rating for another user."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    try:
        user = await get_current_user(authorization)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired session")

        result = await submit_rating(user["user_id"], body)
        return result
    except Exception as e:
        logger.warning(f"Submit rating failed: {e}")
        if "You can't rate yourself" in str(e) or "Rating must be between" in str(e) or "User not found" in str(e):
            raise HTTPException(status_code=400, detail=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ratings/{user_id}", response_model=dict)
async def get_user_ratings_endpoint(
    user_id: str,
    authorization: Optional[str] = Header(None)
):
    """Get rating information for a specific user."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    try:
        # Note: In a real implementation, we might want to check if the requesting user
        # is allowed to see this user's ratings (e.g., not blocked, etc.)
        user = await get_current_user(authorization)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired session")

        result = await get_user_ratings(user_id)
        return result
    except Exception as e:
        logger.warning(f"Get user ratings failed: {e}")
        if "User not found" in str(e):
            raise HTTPException(status_code=404, detail=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ratings/can-rate/{user_id}", response_model=dict)
async def can_rate_endpoint(
    user_id: str,
    authorization: Optional[str] = Header(None)
):
    """Check if current user can rate the specified user."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    try:
        user = await get_current_user(authorization)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired session")

        result = await can_rate(user["user_id"], user_id)
        return result
    except Exception as e:
        logger.warning(f"Can rate check failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Blocking routes
@router.post("/users/{user_id}/block", response_model=BaseResponse)
async def block_user_endpoint(
    user_id: str,
    authorization: Optional[str] = Header(None)
):
    """Block a user."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    try:
        user = await get_current_user(authorization)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired session")

        success = await block_user(user["user_id"], user_id)
        if not success:
            raise HTTPException(status_code=400, detail="Cannot block user (may be self or non-existent)")

        return BaseResponse()
    except Exception as e:
        logger.warning(f"Block user failed: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/users/{user_id}/block", response_model=BaseResponse)
async def unblock_user_endpoint(
    user_id: str,
    authorization: Optional[str] = Header(None)
):
    """Unblock a previously blocked user."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    try:
        user = await get_current_user(authorization)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired session")

        success = await unblock_user(user["user_id"], user_id)
        return BaseResponse()
    except Exception as e:
        logger.warning(f"Unblock user failed: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/users/me/blocked", response_model=List[dict])
async def list_blocked_endpoint(
    authorization: Optional[str] = Header(None)
):
    """Get list of users blocked by the current user."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    try:
        user = await get_current_user(authorization)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired session")

        blocked_users = await list_blocked(user["user_id"])
        return blocked_users
    except Exception as e:
        logger.warning(f"List blocked users failed: {e}")
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