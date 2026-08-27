"""UniPool v2 mobility APIs.

These endpoints turn recurring travel, saved-route alerts and confirmed trips into
first-class product state instead of local UI conveniences.
"""

from __future__ import annotations

import time
import uuid
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel, Field, model_validator

from config.database import db
from config.locations import canonical_location, route_key, search_locations
from config.settings import IST
from services.auth_service import get_current_user
from services.mobility_service import (
    aware,
    canonical_pool_fields,
    materialize_due_recurring_routes,
    materialize_recurring_template,
    notify_trip_members,
    now_utc,
    seats_summary,
    trip_phase,
)

router = APIRouter(tags=["mobility-v2"])


class SavedRouteInput(BaseModel):
    from_location: str = Field(min_length=2, max_length=120)
    to_location: str = Field(min_length=2, max_length=120)
    label: Optional[str] = Field(default=None, max_length=80)
    alerts_enabled: bool = True
    preferred_hour: Optional[int] = Field(default=None, ge=0, le=23)
    preferred_minute: int = Field(default=0, ge=0, le=59)
    time_window_minutes: int = Field(default=180, ge=30, le=720)

    @model_validator(mode="after")
    def validate_route(self):
        if route_key(self.from_location, self.to_location).split("::")[0] == route_key(self.from_location, self.to_location).split("::")[1]:
            raise ValueError("Pickup and drop cannot be the same")
        return self


class RecurringRouteInput(BaseModel):
    from_location: str = Field(min_length=2, max_length=120)
    to_location: str = Field(min_length=2, max_length=120)
    weekday: int = Field(ge=0, le=6)  # Monday=0
    hour: int = Field(ge=0, le=23)
    minute: int = Field(default=0, ge=0, le=59)
    total_seats: int = Field(default=4, ge=1, le=8)
    companions: int = Field(default=0, ge=0, le=6)
    gender_preference: str = "any"
    luggage: Optional[str] = Field(default=None, max_length=80)
    notes: Optional[str] = Field(default=None, max_length=240)
    active: bool = True

    @model_validator(mode="after")
    def validate_recurring(self):
        if self.gender_preference not in {"any", "same"}:
            raise ValueError("Invalid gender preference")
        if self.companions + 1 > self.total_seats:
            raise ValueError("Seats must cover you and your companions")
        return self


class RecurringRoutePatch(BaseModel):
    weekday: Optional[int] = Field(default=None, ge=0, le=6)
    hour: Optional[int] = Field(default=None, ge=0, le=23)
    minute: Optional[int] = Field(default=None, ge=0, le=59)
    total_seats: Optional[int] = Field(default=None, ge=1, le=8)
    companions: Optional[int] = Field(default=None, ge=0, le=6)
    gender_preference: Optional[str] = None
    luggage: Optional[str] = Field(default=None, max_length=80)
    notes: Optional[str] = Field(default=None, max_length=240)
    active: Optional[bool] = None


class TripStatusInput(BaseModel):
    status: str


class MeetingPointInput(BaseModel):
    label: str = Field(min_length=2, max_length=120)
    notes: Optional[str] = Field(default=None, max_length=180)
    lat: Optional[float] = Field(default=None, ge=-90, le=90)
    lng: Optional[float] = Field(default=None, ge=-180, le=180)


class FareInput(BaseModel):
    amount: float = Field(ge=0, le=100000)
    currency: str = Field(default="INR", min_length=3, max_length=3)


class RepeatJourneyInput(BaseModel):
    travel_datetime: datetime


async def _user(authorization: Optional[str]) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization header")
    user = await get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    return user


def _clean(item: Dict[str, Any]) -> Dict[str, Any]:
    item.pop("_id", None)
    return item


def _journey_view(pool: Dict[str, Any], user_id: str) -> Dict[str, Any]:
    seats = seats_summary(pool)
    departure = aware(pool["travel_datetime"])
    participant_count = seats["occupied"]
    fare = pool.get("fare") or None
    if fare:
        fare = dict(fare)
        fare["per_person"] = round(float(fare.get("amount") or 0) / max(1, participant_count), 2)
    return {
        **_clean(dict(pool)),
        "phase": trip_phase(pool),
        "seats": seats,
        "fare": fare,
        "countdown_minutes": round((departure - now_utc()).total_seconds() / 60),
        "is_owner": pool.get("user_id") == user_id,
        "my_member_status": (pool.get("member_statuses") or {}).get(user_id),
    }


async def _participant_pool(pool_id: str, user_id: str) -> Dict[str, Any]:
    pool = await db.pools.find_one({"pool_id": pool_id}, {"_id": 0})
    if not pool:
        raise HTTPException(status_code=404, detail="Journey not found")
    is_owner = pool.get("user_id") == user_id
    is_member = any(item.get("user_id") == user_id for item in pool.get("confirmed_travelers") or [])
    if not is_owner and not is_member:
        raise HTTPException(status_code=403, detail="You are not part of this journey")
    return pool


@router.get("/locations")
async def locations(q: str = Query(default="", max_length=80), limit: int = Query(default=12, ge=1, le=30)):
    return search_locations(q, limit)


@router.get("/saved-routes")
async def list_saved_routes(authorization: Optional[str] = Header(None)):
    user = await _user(authorization)
    routes = await db.saved_routes.find({"user_id": user["user_id"]}, {"_id": 0}).sort("updated_at", -1).to_list(100)
    now = now_utc()
    for item in routes:
        count = await db.pools.count_documents({
            "route_key": item["route_key"], "status": "open", "travel_datetime": {"$gte": now}, "user_id": {"$ne": user["user_id"]}
        })
        item["active_rides"] = count
    return routes


@router.post("/saved-routes")
async def save_route(body: SavedRouteInput, authorization: Optional[str] = Header(None)):
    user = await _user(authorization)
    now = now_utc()
    key = route_key(body.from_location, body.to_location)
    origin = canonical_location(body.from_location)
    destination = canonical_location(body.to_location)
    doc = {
        "saved_route_id": f"route_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "route_key": key,
        "from_location": origin["name"],
        "to_location": destination["name"],
        "from_location_id": origin.get("id"),
        "to_location_id": destination.get("id"),
        "label": body.label or f"{origin['short_name']} → {destination['short_name']}",
        "alerts_enabled": body.alerts_enabled,
        "preferred_hour": body.preferred_hour,
        "preferred_minute": body.preferred_minute,
        "time_window_minutes": body.time_window_minutes,
        "created_at": now,
        "updated_at": now,
    }
    existing = await db.saved_routes.find_one({"user_id": user["user_id"], "route_key": key}, {"_id": 0})
    if existing:
        doc["saved_route_id"] = existing["saved_route_id"]
        doc["created_at"] = existing.get("created_at", now)
    await db.saved_routes.update_one({"user_id": user["user_id"], "route_key": key}, {"$set": doc}, upsert=True)
    return doc


@router.delete("/saved-routes/{saved_route_id}")
async def delete_saved_route(saved_route_id: str, authorization: Optional[str] = Header(None)):
    user = await _user(authorization)
    result = await db.saved_routes.delete_one({"saved_route_id": saved_route_id, "user_id": user["user_id"]})
    if not result.deleted_count:
        raise HTTPException(status_code=404, detail="Saved route not found")
    return {"ok": True}


@router.get("/recurring-routes")
async def list_recurring_routes(authorization: Optional[str] = Header(None)):
    user = await _user(authorization)
    await materialize_due_recurring_routes(user["user_id"])
    return await db.recurring_routes.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)


@router.post("/recurring-routes")
async def create_recurring_route(body: RecurringRouteInput, authorization: Optional[str] = Header(None)):
    user = await _user(authorization)
    canonical = canonical_pool_fields(body.from_location, body.to_location)
    doc = {
        "template_id": f"repeat_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "from_location": canonical["from_location_canonical"],
        "to_location": canonical["to_location_canonical"],
        "route_key": canonical["route_key"],
        "weekday": body.weekday,
        "hour": body.hour,
        "minute": body.minute,
        "total_seats": body.total_seats,
        "companions": body.companions,
        "gender_preference": body.gender_preference,
        "luggage": body.luggage,
        "notes": body.notes,
        "active": body.active,
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }
    await db.recurring_routes.insert_one(doc)
    doc.pop("_id", None)
    await materialize_recurring_template(doc)
    return doc


@router.patch("/recurring-routes/{template_id}")
async def update_recurring_route(template_id: str, body: RecurringRoutePatch, authorization: Optional[str] = Header(None)):
    user = await _user(authorization)
    existing = await db.recurring_routes.find_one({"template_id": template_id, "user_id": user["user_id"]}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Recurring route not found")
    patch = body.model_dump(exclude_none=True)
    if "gender_preference" in patch and patch["gender_preference"] not in {"any", "same"}:
        raise HTTPException(status_code=400, detail="Invalid gender preference")
    total = int(patch.get("total_seats", existing.get("total_seats", 4)))
    companions = int(patch.get("companions", existing.get("companions", 0)))
    if companions + 1 > total:
        raise HTTPException(status_code=400, detail="Seats must cover you and your companions")
    patch["updated_at"] = now_utc()
    await db.recurring_routes.update_one({"template_id": template_id, "user_id": user["user_id"]}, {"$set": patch})
    updated = await db.recurring_routes.find_one({"template_id": template_id}, {"_id": 0})
    if updated and updated.get("active", True):
        await materialize_recurring_template(updated)
    return updated


@router.delete("/recurring-routes/{template_id}")
async def delete_recurring_route(template_id: str, authorization: Optional[str] = Header(None)):
    user = await _user(authorization)
    result = await db.recurring_routes.delete_one({"template_id": template_id, "user_id": user["user_id"]})
    if not result.deleted_count:
        raise HTTPException(status_code=404, detail="Recurring route not found")
    return {"ok": True}


@router.get("/journeys/upcoming")
async def upcoming_journeys(authorization: Optional[str] = Header(None)):
    user = await _user(authorization)
    await materialize_due_recurring_routes(user["user_id"])
    now = now_utc()
    pools = await db.pools.find(
        {
            "$or": [{"user_id": user["user_id"]}, {"confirmed_travelers.user_id": user["user_id"]}],
            "travel_datetime": {"$gte": now - timedelta(hours=12)},
            "trip_status": {"$ne": "cancelled"},
        },
        {"_id": 0},
    ).sort("travel_datetime", 1).to_list(100)
    return [_journey_view(pool, user["user_id"]) for pool in pools]


@router.patch("/journeys/{pool_id}/status")
async def set_journey_status(pool_id: str, body: TripStatusInput, authorization: Optional[str] = Header(None)):
    user = await _user(authorization)
    pool = await _participant_pool(pool_id, user["user_id"])
    status = body.status.strip().lower()
    member_states = {"getting_ready", "on_the_way", "at_pickup", "running_late"}
    global_states = {"in_progress", "completed", "cancelled"}
    if status not in member_states | global_states:
        raise HTTPException(status_code=400, detail="Invalid trip status")

    if status in global_states:
        if pool.get("user_id") != user["user_id"]:
            raise HTTPException(status_code=403, detail="Only the trip owner can change the overall journey state")
        updates: Dict[str, Any] = {"trip_status": status, "updated_at": now_utc()}
        if status in {"completed", "cancelled"}:
            updates["status"] = "closed"
            updates["completed_at" if status == "completed" else "cancelled_at"] = now_utc()
        await db.pools.update_one({"pool_id": pool_id}, {"$set": updates})
        pool.update(updates)
        label = status.replace("_", " ").title()
        await notify_trip_members(pool, f"Trip {label}", f"{pool['from_location']} → {pool['to_location']} is now {label.lower()}.", exclude=[user["user_id"]])
    else:
        await db.pools.update_one(
            {"pool_id": pool_id},
            {"$set": {f"member_statuses.{user['user_id']}": status, "updated_at": now_utc()}},
        )
        member_statuses = dict(pool.get("member_statuses") or {})
        member_statuses[user["user_id"]] = status
        pool["member_statuses"] = member_statuses
        await notify_trip_members(pool, f"{user.get('name') or 'A traveller'} · {status.replace('_', ' ')}", f"Update for {pool['from_location']} → {pool['to_location']}", exclude=[user["user_id"]])
    return _journey_view(pool, user["user_id"])


@router.patch("/journeys/{pool_id}/meeting-point")
async def set_meeting_point(pool_id: str, body: MeetingPointInput, authorization: Optional[str] = Header(None)):
    user = await _user(authorization)
    pool = await _participant_pool(pool_id, user["user_id"])
    if pool.get("user_id") != user["user_id"]:
        raise HTTPException(status_code=403, detail="Only the trip owner can set the shared meeting point")
    resolved = canonical_location(body.label)
    point = {
        "label": resolved["name"] if resolved.get("id") else body.label.strip(),
        "location_id": resolved.get("id"),
        "lat": body.lat if body.lat is not None else resolved.get("lat"),
        "lng": body.lng if body.lng is not None else resolved.get("lng"),
        "notes": body.notes.strip() if body.notes else None,
        "updated_at": now_utc(),
    }
    await db.pools.update_one({"pool_id": pool_id}, {"$set": {"meeting_point": point, "updated_at": now_utc()}})
    pool["meeting_point"] = point
    await notify_trip_members(pool, "Meeting point updated", point["label"], exclude=[user["user_id"]])
    return _journey_view(pool, user["user_id"])


@router.patch("/journeys/{pool_id}/fare")
async def set_fare(pool_id: str, body: FareInput, authorization: Optional[str] = Header(None)):
    user = await _user(authorization)
    pool = await _participant_pool(pool_id, user["user_id"])
    if pool.get("user_id") != user["user_id"]:
        raise HTTPException(status_code=403, detail="Only the trip owner can update the shared fare")
    fare = {"amount": round(body.amount, 2), "currency": body.currency.upper(), "updated_at": now_utc()}
    await db.pools.update_one({"pool_id": pool_id}, {"$set": {"fare": fare, "updated_at": now_utc()}})
    pool["fare"] = fare
    return _journey_view(pool, user["user_id"])


@router.post("/journeys/{pool_id}/repeat")
async def repeat_journey(pool_id: str, body: RepeatJourneyInput, authorization: Optional[str] = Header(None)):
    user = await _user(authorization)
    source = await db.pools.find_one({"pool_id": pool_id, "user_id": user["user_id"]}, {"_id": 0})
    if not source:
        raise HTTPException(status_code=404, detail="Journey not found")
    departure = aware(body.travel_datetime)
    if departure <= now_utc():
        raise HTTPException(status_code=400, detail="Departure must be in the future")
    canonical = canonical_pool_fields(source["from_location"], source["to_location"])
    clone = {
        **{k: source.get(k) for k in ("user_id", "user_name", "user_email", "user_gender", "from_location", "to_location", "gender_preference", "companions", "total_seats", "luggage", "notes")},
        "pool_id": f"pool_{uuid.uuid4().hex[:12]}",
        "travel_datetime": departure,
        "trip_mode": False,
        "trip_status": "planning",
        "status": "open",
        "created_at": now_utc(),
        "confirmed_travelers": [],
        **canonical,
    }
    await db.pools.insert_one(clone)
    clone.pop("_id", None)
    return clone


@router.get("/journeys/duplicates")
async def duplicate_journeys(
    from_location: str,
    to_location: str,
    travel_datetime: datetime,
    authorization: Optional[str] = Header(None),
):
    user = await _user(authorization)
    departure = aware(travel_datetime)
    target_key = route_key(from_location, to_location)
    candidates = await db.pools.find(
        {
            "user_id": {"$ne": user["user_id"]},
            "status": "open",
            "travel_datetime": {"$gte": departure - timedelta(hours=3), "$lte": departure + timedelta(hours=3)},
        },
        {"_id": 0},
    ).to_list(100)
    results = []
    for pool in candidates:
        if (pool.get("route_key") or route_key(pool.get("from_location", ""), pool.get("to_location", ""))) != target_key:
            continue
        results.append({**pool, "time_delta_minutes": round(abs((aware(pool["travel_datetime"]) - departure).total_seconds()) / 60)})
    results.sort(key=lambda item: item["time_delta_minutes"])
    return results[:12]


@router.get("/route-insights")
async def route_insights(authorization: Optional[str] = Header(None)):
    user = await _user(authorization)
    since = now_utc() - timedelta(days=120)
    pools = await db.pools.find({"travel_datetime": {"$gte": since}}, {"_id": 0, "from_location": 1, "to_location": 1, "route_key": 1, "travel_datetime": 1}).to_list(5000)
    counts: Counter[str] = Counter()
    labels: Dict[str, tuple[str, str]] = {}
    hours: Dict[str, Counter[int]] = defaultdict(Counter)
    for pool in pools:
        key = pool.get("route_key") or route_key(pool.get("from_location", ""), pool.get("to_location", ""))
        counts[key] += 1
        labels.setdefault(key, (pool.get("from_location") or "", pool.get("to_location") or ""))
        hours[key][aware(pool["travel_datetime"]).astimezone(IST).hour] += 1
    saved_keys = {item["route_key"] async for item in db.saved_routes.find({"user_id": user["user_id"]}, {"route_key": 1, "_id": 0})}
    results = []
    for key, count in counts.most_common(20):
        peak_hour = hours[key].most_common(1)[0][0] if hours[key] else None
        origin, destination = labels[key]
        results.append({"route_key": key, "from_location": origin, "to_location": destination, "trips_120d": count, "peak_hour": peak_hour, "saved": key in saved_keys})
    return results


@router.get("/travel-digest")
async def travel_digest(authorization: Optional[str] = Header(None)):
    user = await _user(authorization)
    await materialize_due_recurring_routes(user["user_id"])
    now = now_utc()
    upcoming = await db.pools.find(
        {"$or": [{"user_id": user["user_id"]}, {"confirmed_travelers.user_id": user["user_id"]}], "travel_datetime": {"$gte": now}},
        {"_id": 0},
    ).sort("travel_datetime", 1).limit(5).to_list(5)
    saved = await db.saved_routes.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(100)
    saved_activity = []
    for route in saved:
        rides = await db.pools.find({"route_key": route["route_key"], "status": "open", "travel_datetime": {"$gte": now}, "user_id": {"$ne": user["user_id"]}}, {"_id": 0}).sort("travel_datetime", 1).limit(3).to_list(3)
        saved_activity.append({"route": route, "rides": rides})
    weekend_end = now + timedelta(days=7)
    weekend_count = await db.pools.count_documents({"status": "open", "travel_datetime": {"$gte": now, "$lte": weekend_end}})
    return {
        "generated_at": now,
        "upcoming": [_journey_view(pool, user["user_id"]) for pool in upcoming],
        "saved_route_activity": saved_activity,
        "open_trips_next_7d": weekend_count,
    }


@router.get("/diagnostics")
async def diagnostics(authorization: Optional[str] = Header(None)):
    user = await _user(authorization)
    started = time.perf_counter()
    database = "ok"
    try:
        await db.command("ping")
    except Exception:
        database = "degraded"
    latency_ms = round((time.perf_counter() - started) * 1000, 1)
    now = now_utc()
    return {
        "status": "ok" if database == "ok" else "degraded",
        "database": database,
        "database_latency_ms": latency_ms,
        "mobility_version": "2.0",
        "server_time": now,
        "open_pools": await db.pools.count_documents({"status": "open", "travel_datetime": {"$gte": now - timedelta(hours=2)}}),
        "my_saved_routes": await db.saved_routes.count_documents({"user_id": user["user_id"]}),
        "my_recurring_routes": await db.recurring_routes.count_documents({"user_id": user["user_id"], "active": True}),
        "my_upcoming": await db.pools.count_documents({"$or": [{"user_id": user["user_id"]}, {"confirmed_travelers.user_id": user["user_id"]}], "travel_datetime": {"$gte": now}}),
    }


__all__ = ["router"]
