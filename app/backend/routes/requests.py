"""Join-request routes kept compatible with the UniPool client API."""

import logging
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Header, HTTPException

from config.database import db
from models.auth import JoinRequestOut
from models.response import BaseResponse
from services.request_service import (
    accept_request,
    cancel_request,
    create_join_request,
    decline_request,
    incoming_requests,
    list_pool_requests,
    my_requests,
)

logger = logging.getLogger("unipool.routes.requests")
router = APIRouter(tags=["requests"])


async def get_current_user(authorization: Optional[str]) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    from services.auth_service import get_current_user as get_user_from_session
    return await get_user_from_session(authorization)


def _aware(dt: datetime) -> datetime:
    if dt.tzinfo is None or dt.tzinfo.utcoffset(dt) is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


@router.post("/pools/{pool_id}/requests", response_model=JoinRequestOut)
async def create_join_request_endpoint(pool_id: str, authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    try:
        user = await get_current_user(authorization)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired session")
        return await create_join_request(user, pool_id)
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("Create join request failed: %s", e)
        message = str(e)
        if "Pool not found" in message:
            raise HTTPException(status_code=404, detail=message)
        if any(text in message for text in ("own pool", "no longer accepting", "already confirmed", "can't request", "already have a request")):
            raise HTTPException(status_code=400, detail=message)
        raise HTTPException(status_code=500, detail=message)


@router.get("/pools/{pool_id}/requests", response_model=List[JoinRequestOut])
async def list_pool_requests_endpoint(pool_id: str, authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    try:
        user = await get_current_user(authorization)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired session")
        return await list_pool_requests(pool_id, user["user_id"])
    except HTTPException:
        raise
    except Exception as e:
        message = str(e)
        if "Pool not found" in message:
            raise HTTPException(status_code=404, detail=message)
        if "Not your pool" in message:
            raise HTTPException(status_code=403, detail=message)
        raise HTTPException(status_code=500, detail=message)


@router.get("/requests/incoming", response_model=List[JoinRequestOut])
async def incoming_requests_endpoint(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    user = await get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    return await incoming_requests(user)


@router.get("/requests/mine", response_model=List[JoinRequestOut])
async def my_requests_endpoint(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    user = await get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    return await my_requests(user)


@router.patch("/requests/{request_id}/accept", response_model=JoinRequestOut)
async def accept_request_endpoint(request_id: str, authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    user = await get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    request_doc = await db.join_requests.find_one({"request_id": request_id}, {"_id": 0})
    if not request_doc:
        raise HTTPException(status_code=404, detail="Request not found")
    if request_doc.get("pool_owner_id") != user["user_id"]:
        raise HTTPException(status_code=403, detail="Not your pool")
    pool = await db.pools.find_one({"pool_id": request_doc["pool_id"]}, {"_id": 0})
    if not pool:
        raise HTTPException(status_code=404, detail="This trip no longer exists")
    if pool.get("status") != "open" or _aware(pool["travel_datetime"]) <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="This trip is no longer accepting travellers")
    try:
        result = await accept_request(request_id, user["user_id"])
        if not result:
            raise HTTPException(status_code=404, detail="Request not found")
        return result
    except HTTPException:
        raise
    except Exception as e:
        message = str(e)
        if any(text in message for text in ("Request not found", "Not your pool", "already responded", "trip no longer exists")):
            raise HTTPException(status_code=404, detail=message)
        raise HTTPException(status_code=400, detail=message)


@router.patch("/requests/{request_id}/decline", response_model=JoinRequestOut)
async def decline_request_endpoint(request_id: str, authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    user = await get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    try:
        result = await decline_request(request_id, user["user_id"])
        if not result:
            raise HTTPException(status_code=404, detail="Request not found")
        return result
    except HTTPException:
        raise
    except Exception as e:
        message = str(e)
        if any(text in message for text in ("Request not found", "Not your pool", "already responded")):
            raise HTTPException(status_code=404, detail=message)
        raise HTTPException(status_code=400, detail=message)


@router.delete("/requests/{request_id}", response_model=BaseResponse)
async def cancel_request_endpoint(request_id: str, authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    user = await get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    if not await cancel_request(user["user_id"], request_id):
        raise HTTPException(status_code=404, detail="Request not found, not pending, or not yours")
    return BaseResponse()


__all__ = ["router"]
