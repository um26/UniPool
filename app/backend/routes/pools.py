"""
Pool routes.
Handles pool creation, listing, and management.
"""

import sys
from pathlib import Path

# Add the backend directory to the Python path so we can import from it
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from fastapi import APIRouter, HTTPException, Header
from typing import List, Optional
from services.pool_service import (
    create_pool, get_pool, list_pools, my_pools,
    close_pool, reopen_pool, delete_pool, get_my_matches, get_confirmed_matches
)
from models.pool import PoolRequestCreate, PoolRequestUpdate, PoolResponse
from models.response import BaseResponse
import logging

logger = logging.getLogger("unipool.routes.pools")

# Create router
router = APIRouter(prefix="/pools", tags=["pools"])


@router.post("", response_model=PoolResponse)
async def create_pool_endpoint(
    body: PoolRequestCreate,
    authorization: Optional[str] = Header(None)
):
    """Create a new travel pool request."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    try:
        user = await get_current_user(authorization)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired session")

        pool_data = await create_pool(user, body)
        return pool_data
    except Exception as e:
        logger.warning(f"Create pool failed: {e}")
        if "You already have" in str(e) or "You're posting too fast" in str(e):
            raise HTTPException(status_code=429, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))


@router.get("", response_model=List[PoolResponse])
async def list_pools_endpoint(authorization: Optional[str] = Header(None)):
    """List all open pools (feed)."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    try:
        user = await get_current_user(authorization)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired session")

        pools = await list_pools(user)
        return pools
    except Exception as e:
        logger.warning(f"List pools failed: {e}")
        raise HTTPException(status_code=401, detail=str(e))


@router.get("/mine", response_model=List[PoolResponse])
async def my_pools_endpoint(authorization: Optional[str] = Header(None)):
    """Get current user's pools."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    try:
        user = await get_current_user(authorization)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired session")

        pools = await my_pools(user)
        return pools
    except Exception as e:
        logger.warning(f"My pools failed: {e}")
        raise HTTPException(status_code=401, detail=str(e))


@router.get("/matches")
async def get_matches_endpoint(authorization: Optional[str] = Header(None)):
    """Get pools that overlap ±1h with user's own pools on the same route."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    try:
        user = await get_current_user(authorization)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired session")

        matches = await get_my_matches(user["user_id"])
        logger.info(f"[GET_MATCHES] Retrieved {len(matches)} matches for user {user['user_id']}")
        return matches
    except Exception as e:
        logger.warning(f"Get matches failed: {e}")
        raise HTTPException(status_code=401, detail=str(e))


@router.get("/{pool_id}", response_model=PoolResponse)
async def get_pool_endpoint(
    pool_id: str,
    authorization: Optional[str] = Header(None)
):
    """Get a specific pool by ID."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    try:
        user = await get_current_user(authorization)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired session")

        pool = await get_pool(pool_id, user["user_id"])
        if not pool:
            logger.info(f"[GET_POOL_ENDPOINT] Pool returned None: pool_id={pool_id}, user_id={user['user_id']}")
            raise HTTPException(status_code=404, detail="Pool not found")

        return pool
    except Exception as e:
        logger.error(f"[GET_POOL_ENDPOINT] Unexpected error for pool_id={pool_id}, user_id={user.get('user_id') if user else 'unknown'}: {type(e).__name__}: {e}")
        logger.warning(f"Get pool failed: {e}")
        if "Not found" in str(e):
            raise HTTPException(status_code=404, detail=str(e))
        raise HTTPException(status_code=401, detail=str(e))


@router.patch("/{pool_id}/close", response_model=PoolResponse)
async def close_pool_endpoint(
    pool_id: str,
    authorization: Optional[str] = Header(None)
):
    """Close a pool (owner only)."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    try:
        user = await get_current_user(authorization)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired session")

        pool = await close_pool(pool_id, user["user_id"])
        if not pool:
            raise HTTPException(status_code=404, detail="Pool not found or not authorized")

        return pool
    except Exception as e:
        logger.warning(f"Close pool failed: {e}")
        if "not authorized" in str(e).lower() or "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{pool_id}/reopen", response_model=PoolResponse)
async def reopen_pool_endpoint(
    pool_id: str,
    authorization: Optional[str] = Header(None)
):
    """Reopen a closed pool (owner only)."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    try:
        user = await get_current_user(authorization)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired session")

        pool = await reopen_pool(pool_id, user["user_id"])
        if not pool:
            raise HTTPException(status_code=404, detail="Pool not found or not authorized")

        return pool
    except Exception as e:
        logger.warning(f"Reopen pool failed: {e}")
        if "not authorized" in str(e).lower() or "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{pool_id}", response_model=BaseResponse)
async def delete_pool_endpoint(
    pool_id: str,
    authorization: Optional[str] = Header(None)
):
    """Delete a pool (owner only)."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    try:
        user = await get_current_user(authorization)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired session")

        success = await delete_pool(pool_id, user["user_id"])
        if not success:
            raise HTTPException(status_code=404, detail="Pool not found or not authorized")

        return BaseResponse()
    except Exception as e:
        logger.warning(f"Delete pool failed: {e}")
        if "not authorized" in str(e).lower() or "not found" in str(e).lower():
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