"""Compatibility routes for long-lived UniPool client contracts.

These endpoints used to live in the legacy monolithic server. Keeping them in
one small router lets the canonical modular FastAPI app remain the only backend
entry point without breaking existing web/mobile clients.
"""

from collections import Counter
from datetime import datetime, timezone
from typing import Optional
import uuid

from fastapi import APIRouter, Header, HTTPException

from config.database import db
from config.settings import IST, VAPID_PUBLIC_KEY
from models.auth import PushSubscribe, ReportCreate
from models.response import BaseResponse
from services.trivia_service import get_trivia_questions
from services.auth_service import get_current_user

router = APIRouter(tags=["compatibility"])


async def _user(authorization: Optional[str]) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization header")
    user = await get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    return user


@router.get("/trivia", response_model=list[dict])
async def trivia_compat(authorization: Optional[str] = Header(None)):
    await _user(authorization)
    return await get_trivia_questions()


@router.get("/analytics/route-heatmap", response_model=dict)
async def route_heatmap(authorization: Optional[str] = Header(None)):
    await _user(authorization)
    pools = await db.pools.find(
        {}, {"_id": 0, "from_location": 1, "to_location": 1, "travel_datetime": 1}
    ).sort("travel_datetime", -1).limit(10000).to_list(10000)

    route_counts: Counter[tuple[str, str]] = Counter()
    route_labels: dict[tuple[str, str], tuple[str, str]] = {}
    hourly = [0] * 24
    for pool in pools:
        from_location = " ".join(str(pool.get("from_location") or "").split()).strip()
        to_location = " ".join(str(pool.get("to_location") or "").split()).strip()
        if from_location and to_location:
            key = (from_location.casefold(), to_location.casefold())
            route_counts[key] += 1
            route_labels.setdefault(key, (from_location, to_location))
        travel_dt = pool.get("travel_datetime")
        if isinstance(travel_dt, datetime):
            if travel_dt.tzinfo is None or travel_dt.tzinfo.utcoffset(travel_dt) is None:
                travel_dt = travel_dt.replace(tzinfo=timezone.utc)
            hourly[travel_dt.astimezone(IST).hour] += 1

    routes = [{"from": route_labels[key][0], "to": route_labels[key][1], "count": count} for key, count in route_counts.most_common(40)]
    return {"routes": routes, "hourly": [{"hour": hour, "count": count} for hour, count in enumerate(hourly)], "total_pools": len(pools)}


@router.get("/push/vapid-public-key", response_model=dict)
async def vapid_public_key(authorization: Optional[str] = Header(None)):
    await _user(authorization)
    return {"key": VAPID_PUBLIC_KEY}


@router.post("/push/subscribe", response_model=BaseResponse)
async def push_subscribe(body: PushSubscribe, authorization: Optional[str] = Header(None)):
    user = await _user(authorization)
    if not body.endpoint or not body.keys:
        raise HTTPException(status_code=400, detail="Invalid push subscription")
    now = datetime.now(timezone.utc)
    await db.push_subscriptions.update_one(
        {"endpoint": body.endpoint},
        {"$set": {"user_id": user["user_id"], "endpoint": body.endpoint, "keys": body.keys, "updated_at": now}, "$setOnInsert": {"created_at": now}},
        upsert=True,
    )
    return BaseResponse()


@router.post("/push/unsubscribe", response_model=BaseResponse)
async def push_unsubscribe(body: dict, authorization: Optional[str] = Header(None)):
    user = await _user(authorization)
    endpoint = str(body.get("endpoint") or "").strip()
    if not endpoint:
        raise HTTPException(status_code=400, detail="Missing push endpoint")
    await db.push_subscriptions.delete_one({"endpoint": endpoint, "user_id": user["user_id"]})
    return BaseResponse()


@router.post("/reports", response_model=dict)
async def submit_report(body: ReportCreate, authorization: Optional[str] = Header(None)):
    user = await _user(authorization)
    if body.reported_user_id == user["user_id"]:
        raise HTTPException(status_code=400, detail="You can't report yourself")
    reported = await db.users.find_one({"user_id": body.reported_user_id}, {"_id": 0, "user_id": 1, "name": 1})
    if not reported:
        raise HTTPException(status_code=404, detail="User not found")
    allowed_reasons = {"no-show", "unsafe", "harassment", "spam", "other"}
    if body.reason not in allowed_reasons:
        raise HTTPException(status_code=400, detail="Invalid report reason")
    doc = {
        "report_id": f"rep_{uuid.uuid4().hex[:12]}", "reporter_id": user["user_id"], "reporter_name": user.get("name") or "Traveller",
        "reported_user_id": body.reported_user_id, "reported_user_name": reported.get("name") or "Traveller", "reason": body.reason,
        "details": (body.details or "").strip() or None, "pool_id": body.pool_id, "status": "open", "created_at": datetime.now(timezone.utc),
    }
    await db.reports.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.delete("/pools/{pool_id}/travelers/{traveler_user_id}", response_model=BaseResponse)
async def remove_confirmed_traveler(pool_id: str, traveler_user_id: str, authorization: Optional[str] = Header(None)):
    user = await _user(authorization)
    pool = await db.pools.find_one({"pool_id": pool_id}, {"_id": 0})
    if not pool:
        raise HTTPException(status_code=404, detail="Pool not found")
    uid = user["user_id"]
    is_owner = pool.get("user_id") == uid
    is_self_leave = traveler_user_id == uid and any(traveler.get("user_id") == uid for traveler in pool.get("confirmed_travelers", []))
    if not is_owner and not is_self_leave:
        raise HTTPException(status_code=403, detail="Not authorized to change this trip")
    if traveler_user_id == pool.get("user_id"):
        raise HTTPException(status_code=400, detail="The pool owner can't be removed from their own trip")

    result = await db.pools.update_one(
        {"pool_id": pool_id, "confirmed_travelers.user_id": traveler_user_id},
        {"$pull": {"confirmed_travelers": {"user_id": traveler_user_id}}, "$set": {"updated_at": datetime.now(timezone.utc)}},
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Traveller is not confirmed on this trip")
    await db.join_requests.update_many(
        {"pool_id": pool_id, "requester_id": traveler_user_id, "status": "accepted"},
        {"$set": {"status": "cancelled", "responded_at": datetime.now(timezone.utc)}},
    )
    conversation_id = pool.get("trip_conversation_id")
    if conversation_id:
        await db.conversations.update_one(
            {"conversation_id": conversation_id},
            {"$pull": {"member_ids": traveler_user_id}, "$set": {"updated_at": datetime.now(timezone.utc)}},
        )

    from services.request_service import promote_waitlist
    await promote_waitlist(pool_id)
    return BaseResponse()


__all__ = ["router"]
