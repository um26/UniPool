"""
Pool routes.
Handles pool creation, listing, matching, editing, and management.
"""

import asyncio
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from fastapi import APIRouter, Header, HTTPException

from config.database import db
from models.pool import PoolRequestCreate, PoolRequestUpdate, PoolResponse
from models.response import BaseResponse
from services.match_service import materialize_matches_for_pool, smart_matches
from services.pool_service import close_pool, create_pool, delete_pool, get_pool, list_pools, my_pools, reopen_pool

logger = logging.getLogger("unipool.routes.pools")
router = APIRouter(prefix="/pools", tags=["pools"])


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    from services.auth_service import get_current_user as get_user_from_session
    return await get_user_from_session(authorization)


def _aware(dt: datetime) -> datetime:
    if dt.tzinfo is None or dt.tzinfo.utcoffset(dt) is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _validate_patch(existing: dict, updates: dict) -> dict:
    clean = dict(updates)
    for key in ("from_location", "to_location"):
        if key in clean:
            clean[key] = " ".join(str(clean[key]).split()).strip()
            if len(clean[key]) < 2 or len(clean[key]) > 120:
                raise ValueError(f"{key.replace('_', ' ').title()} must be 2–120 characters")
    origin = clean.get("from_location", existing.get("from_location", "")).casefold()
    destination = clean.get("to_location", existing.get("to_location", "")).casefold()
    if origin and origin == destination:
        raise ValueError("Pickup and drop cannot be the same")
    if "gender_preference" in clean and clean["gender_preference"] not in {"any", "same"}:
        raise ValueError("Invalid gender preference")
    if "companions" in clean:
        try:
            companions = int(clean["companions"])
        except (TypeError, ValueError):
            raise ValueError("Companions must be a number")
        if not 0 <= companions <= 6:
            raise ValueError("Companions must be between 0 and 6")
        clean["companions"] = companions
    if "notes" in clean and clean["notes"] is not None:
        clean["notes"] = str(clean["notes"]).strip()[:240] or None
    if "luggage" in clean and clean["luggage"] is not None:
        clean["luggage"] = str(clean["luggage"]).strip()[:80] or None
    if "travel_datetime" in clean:
        travel = _aware(clean["travel_datetime"])
        if travel <= datetime.now(timezone.utc):
            raise ValueError("Departure time must be in the future")
        clean["travel_datetime"] = travel
    clean["updated_at"] = datetime.now(timezone.utc)
    return clean


@router.post("", response_model=PoolResponse)
async def create_pool_endpoint(body: PoolRequestCreate, authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    try:
        user = await get_current_user(authorization)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired session")
        if _aware(body.travel_datetime) <= datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="Departure time must be in the future")
        created = await create_pool(user, body)
        asyncio.create_task(materialize_matches_for_pool(created))
        return created
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("Create pool failed: %s", e)
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
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("List pools failed: %s", e)
        raise HTTPException(status_code=500, detail="Unable to load journeys right now")


@router.get("/mine", response_model=List[PoolResponse])
async def my_pools_endpoint(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    try:
        user = await get_current_user(authorization)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired session")
        return await my_pools(user)
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("My pools failed: %s", e)
        raise HTTPException(status_code=500, detail="Unable to load your journeys right now")


@router.get("/matches")
async def get_matches_endpoint(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    try:
        user = await get_current_user(authorization)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired session")
        matches = await smart_matches(user["user_id"])
        logger.info("[GET_MATCHES] Retrieved %s matches for user %s", len(matches), user["user_id"])
        return matches
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("Get matches failed: %s: %s", type(e).__name__, e)
        return []


@router.patch("/{pool_id}", response_model=PoolResponse)
async def update_pool_endpoint(pool_id: str, body: PoolRequestUpdate, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    existing = await db.pools.find_one({"pool_id": pool_id, "user_id": user["user_id"]}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Pool not found or not authorized")
    if existing.get("status") != "open":
        raise HTTPException(status_code=400, detail="Only open journeys can be edited")
    raw = body.model_dump(exclude_none=True)
    if not raw:
        return await get_pool(pool_id, user["user_id"])
    try:
        updates = _validate_patch(existing, raw)
        await db.pools.update_one({"pool_id": pool_id, "user_id": user["user_id"]}, {"$set": updates})
        updated = await get_pool(pool_id, user["user_id"])
        if not updated:
            raise HTTPException(status_code=404, detail="Pool not found")
        asyncio.create_task(materialize_matches_for_pool(updated))
        return updated
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.exception("Update pool failed: %s", exc)
        raise HTTPException(status_code=500, detail="Could not update this journey")


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
        logger.error("Get pool failed: pool_id=%s: %s: %s", pool_id, type(e).__name__, e)
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
        logger.warning("Close pool failed: %s", e)
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
        if _aware(pool["travel_datetime"]) <= datetime.now(timezone.utc):
            await close_pool(pool_id, user["user_id"])
            raise HTTPException(status_code=400, detail="Past journeys cannot be reopened")
        return pool
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("Reopen pool failed: %s", e)
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
        await db.join_requests.delete_many({"pool_id": pool_id})
        return BaseResponse()
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("Delete pool failed: %s", e)
        raise HTTPException(status_code=400, detail=str(e))


__all__ = ["router"]
