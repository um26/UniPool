"""
Pool routes.
Handles pool creation, listing, and management.
"""

import sys
from pathlib import Path
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
router = APIRouter(prefix="/pools", tags=["pools"])


@router.post("", response_model=PoolResponse)
async def create_pool_endpoint(body: PoolRequestCreate, authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    try:
        user = await get_current_user(authorization)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired session")
        return await create_pool(user, body)
    except Exception as e:
        logger.warning(f"Create pool failed: {e}")
        if "You already have" in str(e) or "You're posting too fast" in str(e):
            raise HTTPException(status_code=429, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))


@router.get("", response_model=List[PoolResponse])
async def list_pools_endpoint(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    try:
        user = await get_current_user(authorization)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired session")
        return await list_pools(user)
    except Exception as e:
        logger.warning(f"List pools failed: {e}")
        raise HTTPException(status_code=401, detail=str(e))


@router.get("/mine", response_model=List[PoolResponse])
async def my_pools_endpoint(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    try:
        user = await get_current_user(authorization)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired session")
        return await my_pools(user)
    except Exception as e:
        logger.warning(f"My pools failed: {e}")
        raise HTTPException(status_code=401, detail=str(e))


@router.get("/matches")
async def get_matches_endpoint(authorization: Optional[str] = Header(None)):
    """Get route/time matches. A bad historical pool must not break the entire page."""
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
        logger.warning(f"Get matches failed: {type(e).__name__}: {e}")
        # A matching query should return an empty state when a legacy/stale
        # record is malformed, rather than surfacing "Pool not found" as a
        # page-level failure. Authentication errors remain explicit.
        if "Invalid or expired session" in str(e):
            raise HTTPException(status_code=401, detail=str(e))
        return []


@router.get("/{pool_id}", response_model=PoolResponse)
async def get_pool_endpoint(pool_id: str, authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    try:
        user = await get_current_user(authorization)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired session")
        pool = await get_pool(pool_id, user["user_id"])
        if not pool:
            raise HTTPException(status_code=404, detail="Pool not found")
        return pool
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get pool failed: pool_id={pool_id}: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail="Unable to load this pool right now")


@router.patch("/{pool_id}/close", response_model=PoolResponse)
async def close_pool_endpoint(pool_id: str, authorization: Optional[str] = Header(None)):
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
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Close pool failed: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{pool_id}/reopen", response_model=PoolResponse)
async def reopen_pool_endpoint(pool_id: str, authorization: Optional[str] = Header(None)):
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
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Reopen pool failed: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{pool_id}", response_model=BaseResponse)
async def delete_pool_endpoint(pool_id: str, authorization: Optional[str] = Header(None)):
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
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Delete pool failed: {e}")
        raise HTTPException(status_code=400, detail=str(e))


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    from services.auth_service import get_current_user as get_user_from_session
    return await get_user_from_session(authorization)


__all__ = ["router"]
