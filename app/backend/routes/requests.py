"""
Join request routes.
Handles creating, listing, and managing join requests to pools.
"""

import sys
from pathlib import Path

# Add the backend directory to the Python path so we can import from it
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from fastapi import APIRouter, HTTPException, Header
from typing import List, Optional
from services.request_service import (
    create_join_request, list_pool_requests, incoming_requests,
    my_requests, accept_request, decline_request, cancel_request
)
from models.auth import JoinRequestOut
from models.response import BaseResponse
import logging

logger = logging.getLogger("unipool.routes.requests")

# Create router
router = APIRouter(prefix="/requests", tags=["requests"])


@router.post("/pools/{pool_id}/requests", response_model=JoinRequestOut)
async def create_join_request_endpoint(
    pool_id: str,
    authorization: Optional[str] = Header(None)
):
    """Create a join request for a pool."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    try:
        user = await get_current_user(authorization)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired session")

        request_data = await create_join_request(user, pool_id)
        return request_data
    except Exception as e:
        logger.warning(f"Create join request failed: {e}")
        if "Pool not found" in str(e):
            raise HTTPException(status_code=404, detail=str(e))
        if "You can't request to join your own pool" in str(e) or \
           "This pool is no longer accepting requests" in str(e) or \
           "You're already confirmed on this pool" in str(e) or \
           "You can't request to join this pool" in str(e) or \
           "You already have a request on this pool" in str(e):
            raise HTTPException(status_code=400, detail=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/pools/{pool_id}/requests", response_model=List[JoinRequestOut])
async def list_pool_requests_endpoint(
    pool_id: str,
    authorization: Optional[str] = Header(None)
):
    """Get all join requests for a specific pool (owner only)."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    try:
        user = await get_current_user(authorization)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired session")

        requests_list = await list_pool_requests(pool_id, user["user_id"])
        return requests_list
    except Exception as e:
        logger.warning(f"List pool requests failed: {e}")
        if "Pool not found" in str(e) or "Not your pool" in str(e):
            raise HTTPException(status_code=404, detail=str(e))
        raise HTTPException(status_code=401, detail=str(e))


@router.get("/incoming", response_model=List[JoinRequestOut])
async def incoming_requests_endpoint(authorization: Optional[str] = Header(None)):
    """Get pending join requests on pools owned by the current user."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    try:
        user = await get_current_user(authorization)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired session")

        requests_list = await incoming_requests(user)
        return requests_list
    except Exception as e:
        logger.warning(f"Incoming requests failed: {e}")
        raise HTTPException(status_code=401, detail=str(e))


@router.get("/mine", response_model=List[JoinRequestOut])
async def my_requests_endpoint(authorization: Optional[str] = Header(None)):
    """Get all join requests made by the current user (any status)."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    try:
        user = await get_current_user(authorization)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired session")

        requests_list = await my_requests(user)
        return requests_list
    except Exception as e:
        logger.warning(f"My requests failed: {e}")
        raise HTTPException(status_code=401, detail=str(e))


@router.patch("/{request_id}/accept", response_model=JoinRequestOut)
async def accept_request_endpoint(
    request_id: str,
    authorization: Optional[str] = Header(None)
):
    """Accept a join request (pool owner only)."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    try:
        user = await get_current_user(authorization)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired session")

        request_data = await accept_request(request_id, user["user_id"])
        if not request_data:
            raise HTTPException(status_code=404, detail="Request not found or not authorized")

        return request_data
    except Exception as e:
        logger.warning(f"Accept request failed: {e}")
        if "Request not found" in str(e) or "Not your pool" in str(e) or \
           "This request was already responded to" in str(e):
            raise HTTPException(status_code=404, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{request_id}/decline", response_model=JoinRequestOut)
async def decline_request_endpoint(
    request_id: str,
    authorization: Optional[str] = Header(None)
):
    """Decline a join request (pool owner only)."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    try:
        user = await get_current_user(authorization)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired session")

        request_data = await decline_request(request_id, user["user_id"])
        if not request_data:
            raise HTTPException(status_code=404, detail="Request not found or not authorized")

        return request_data
    except Exception as e:
        logger.warning(f"Decline request failed: {e}")
        if "Request not found" in str(e) or "Not your pool" in str(e) or \
           "This request was already responded to" in str(e):
            raise HTTPException(status_code=404, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{request_id}", response_model=BaseResponse)
async def cancel_request_endpoint(
    request_id: str,
    authorization: Optional[str] = Header(None)
):
    """Cancel user's own pending join request."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    try:
        user = await get_current_user(authorization)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired session")

        success = await cancel_request(user["user_id"], request_id)
        if not success:
            raise HTTPException(status_code=404, detail="Request not found or not pending or not yours")

        return BaseResponse()
    except Exception as e:
        logger.warning(f"Cancel request failed: {e}")
        if "Request not found" in str(e) or "not pending" in str(e).lower() or "not yours" in str(e).lower():
            raise HTTPException(status_code=404, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))


# Helper function to get current user (imported from auth service)
async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """Get current user from authorization header."""
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    from services.auth_service import get_current_user as get_user_from_session
    return await get_user_from_session(authorization)


# Export the router
__all__ = ["router"]