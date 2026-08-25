"""Profile, ratings, safety and university-verification routes."""

import logging
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Header, HTTPException

from config.database import db
from helpers.college_helper import sync_user_college_profile
from models.auth import RatingCreate
from models.response import BaseResponse
from models.user import CollegeVerifyConfirm, CollegeVerifyStart, UserProfileUpdate
from services.auth_service import get_current_user as get_user_from_session
from services.user_service import (
    block_user,
    can_rate,
    confirm_college_verification,
    get_user_ratings,
    list_blocked,
    start_college_verification,
    submit_rating,
    unblock_user,
    update_profile,
)

logger = logging.getLogger("unipool.routes.profile")
router = APIRouter(tags=["profile"])


async def current_user(authorization: Optional[str]) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    return await get_user_from_session(authorization)


def _aware(dt: datetime) -> datetime:
    if dt.tzinfo is None or dt.tzinfo.utcoffset(dt) is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


async def _assert_rating_eligible(rater_user_id: str, rated_user_id: str, pool_id: Optional[str]) -> dict:
    if rater_user_id == rated_user_id:
        raise HTTPException(status_code=400, detail="You can't rate yourself")
    if not pool_id:
        raise HTTPException(status_code=400, detail="Choose the completed UniPool ride you shared with this traveller")
    pool = await db.pools.find_one({"pool_id": pool_id}, {"_id": 0})
    if not pool:
        raise HTTPException(status_code=404, detail="Trip not found")
    participants = {pool.get("user_id")}
    participants.update(t.get("user_id") for t in pool.get("confirmed_travelers", []) if t.get("user_id"))
    if rater_user_id not in participants or rated_user_id not in participants:
        raise HTTPException(status_code=403, detail="You can only rate someone you travelled with on this trip")
    if _aware(pool["travel_datetime"]) > datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="You can rate this traveller after the trip has happened")
    return pool


@router.patch("/profile", response_model=dict)
async def update_profile_endpoint(body: UserProfileUpdate, authorization: Optional[str] = Header(None)):
    user = await current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    try:
        updated = await update_profile(user["user_id"], body)
        if not updated:
            raise HTTPException(status_code=404, detail="User not found")
        return await sync_user_college_profile(updated)
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("Update profile failed: %s", e)
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/ratings", response_model=dict)
async def submit_rating_endpoint(body: RatingCreate, authorization: Optional[str] = Header(None)):
    user = await current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    try:
        await _assert_rating_eligible(user["user_id"], body.rated_user_id, body.pool_id)
        return await submit_rating(user["user_id"], body)
    except HTTPException:
        raise
    except Exception as e:
        message = str(e)
        if "rate yourself" in message.lower() or "between" in message.lower() or "not found" in message.lower():
            raise HTTPException(status_code=400, detail=message)
        logger.exception("Submit rating failed")
        raise HTTPException(status_code=500, detail="Could not submit rating")


@router.get("/ratings/user/{user_id}", response_model=dict)
async def get_user_ratings_endpoint(user_id: str, authorization: Optional[str] = Header(None)):
    if not await current_user(authorization):
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    try:
        return await get_user_ratings(user_id)
    except Exception as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ratings/can-rate/{user_id}", response_model=dict)
async def can_rate_endpoint(user_id: str, authorization: Optional[str] = Header(None)):
    user = await current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    try:
        return await can_rate(user["user_id"], user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/users/{user_id}/block", response_model=BaseResponse)
async def block_user_endpoint(user_id: str, authorization: Optional[str] = Header(None)):
    user = await current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    try:
        if not await block_user(user["user_id"], user_id):
            raise HTTPException(status_code=400, detail="Cannot block this user")
        return BaseResponse()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/users/{user_id}/block", response_model=BaseResponse)
async def unblock_user_endpoint(user_id: str, authorization: Optional[str] = Header(None)):
    user = await current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    await unblock_user(user["user_id"], user_id)
    return BaseResponse()


@router.get("/users/me/blocked", response_model=List[dict])
async def list_blocked_endpoint(authorization: Optional[str] = Header(None)):
    user = await current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    return await list_blocked(user["user_id"])


@router.post("/profile/verify-college-id/start", response_model=BaseResponse)
async def verify_college_start(body: CollegeVerifyStart, authorization: Optional[str] = Header(None)):
    user = await current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    try:
        if not await start_college_verification(user["user_id"], body):
            raise HTTPException(status_code=500, detail="Failed to send verification email")
        return BaseResponse()
    except HTTPException:
        raise
    except Exception as e:
        message = str(e)
        if "Please enter your" in message or "Couldn't recognize" in message or "already verified" in message:
            raise HTTPException(status_code=400, detail=message)
        raise HTTPException(status_code=500, detail=message)


@router.post("/profile/verify-college-id/confirm", response_model=dict)
async def verify_college_confirm(body: CollegeVerifyConfirm, authorization: Optional[str] = Header(None)):
    user = await current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    try:
        result = await confirm_college_verification(user["user_id"], body)
        refreshed = await current_user(authorization)
        if refreshed:
            result["user"] = await sync_user_college_profile(refreshed)
        return result
    except Exception as e:
        message = str(e)
        if any(text in message for text in ("No verification request found", "expired", "Too many attempts", "Invalid verification code")):
            raise HTTPException(status_code=400, detail=message)
        raise HTTPException(status_code=500, detail=message)


__all__ = ["router"]
