"""Shared mobility intelligence for UniPool v2."""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Iterable, List, Optional

from config.database import db
from config.locations import canonical_location, route_key
from helpers.push_helper import send_push


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def aware(value: datetime) -> datetime:
    if value.tzinfo is None or value.tzinfo.utcoffset(value) is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def canonical_pool_fields(from_location: str, to_location: str) -> Dict[str, Any]:
    origin = canonical_location(from_location)
    destination = canonical_location(to_location)
    return {
        "from_location_id": origin.get("id"),
        "to_location_id": destination.get("id"),
        "from_location_canonical": origin.get("name") or from_location,
        "to_location_canonical": destination.get("name") or to_location,
        "from_coords": {"lat": origin.get("lat"), "lng": origin.get("lng")} if origin.get("lat") is not None else None,
        "to_coords": {"lat": destination.get("lat"), "lng": destination.get("lng")} if destination.get("lat") is not None else None,
        "route_key": route_key(from_location, to_location),
    }


def trip_phase(pool: Dict[str, Any], now: Optional[datetime] = None) -> str:
    now = now or now_utc()
    explicit = pool.get("trip_status")
    if explicit in {"on_the_way", "at_pickup", "in_progress", "completed", "cancelled"}:
        return explicit
    if pool.get("status") == "closed" and explicit != "completed":
        return "cancelled" if explicit == "cancelled" else "closed"
    departure = aware(pool["travel_datetime"])
    delta = departure - now
    travellers = len(pool.get("confirmed_travelers") or [])
    if delta.total_seconds() < -6 * 3600:
        return "awaiting_completion"
    if delta.total_seconds() < 0:
        return "departing"
    if delta <= timedelta(minutes=30):
        return "leaving_soon"
    if travellers > 0:
        return "confirmed"
    return "planning"


def seats_summary(pool: Dict[str, Any]) -> Dict[str, int]:
    total = max(1, int(pool.get("total_seats") or 4))
    occupied = 1 + int(pool.get("companions") or 0) + len(pool.get("confirmed_travelers") or [])
    return {"total": total, "occupied": occupied, "available": max(0, total - occupied)}


async def notify_saved_route_watchers(pool: Dict[str, Any]) -> None:
    """Notify users who explicitly subscribed to this route.

    The owner is excluded. Alerts can optionally include a time-of-day window.
    """
    key = pool.get("route_key") or route_key(pool.get("from_location", ""), pool.get("to_location", ""))
    watchers = await db.saved_routes.find(
        {"route_key": key, "alerts_enabled": True, "user_id": {"$ne": pool.get("user_id")}},
        {"_id": 0},
    ).to_list(500)
    if not watchers:
        return

    departure = aware(pool["travel_datetime"])
    tasks = []
    for watcher in watchers:
        preferred_hour = watcher.get("preferred_hour")
        window = int(watcher.get("time_window_minutes") or 180)
        if preferred_hour is not None:
            target = departure.replace(hour=int(preferred_hour), minute=int(watcher.get("preferred_minute") or 0))
            if abs((departure - target).total_seconds()) > window * 60:
                continue
        uid = watcher.get("user_id")
        if not uid:
            continue
        title = "New ride on a saved route"
        body = f"{pool.get('from_location_canonical') or pool.get('from_location')} → {pool.get('to_location_canonical') or pool.get('to_location')} · {departure.astimezone().strftime('%d %b, %I:%M %p')}"
        tasks.append(send_push(uid, title, body, f"/pool/{pool['pool_id']}"))
    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)


async def notify_trip_members(pool: Dict[str, Any], title: str, body: str, url: Optional[str] = None, exclude: Optional[Iterable[str]] = None) -> None:
    excluded = set(exclude or [])
    ids = [pool.get("user_id"), *[t.get("user_id") for t in pool.get("confirmed_travelers") or []]]
    ids = [uid for uid in dict.fromkeys(ids) if uid and uid not in excluded]
    if not ids:
        return
    await asyncio.gather(*(send_push(uid, title, body, url or f"/pool/{pool['pool_id']}") for uid in ids), return_exceptions=True)


async def materialize_recurring_template(template: Dict[str, Any], force: bool = False) -> Optional[Dict[str, Any]]:
    """Create the next pool for a recurring template if it has not been materialized."""
    if not template.get("active", True):
        return None
    now = now_utc()
    day = int(template.get("weekday", 0)) % 7
    days_ahead = (day - now.weekday()) % 7
    target = (now + timedelta(days=days_ahead)).replace(
        hour=int(template.get("hour", 9)),
        minute=int(template.get("minute", 0)),
        second=0,
        microsecond=0,
    )
    if target <= now + timedelta(minutes=10):
        target += timedelta(days=7)

    template_id = template["template_id"]
    exists = await db.pools.find_one(
        {"recurring_template_id": template_id, "travel_datetime": {"$gte": target - timedelta(minutes=1), "$lte": target + timedelta(minutes=1)}},
        {"_id": 0, "pool_id": 1},
    )
    if exists and not force:
        return None

    owner = await db.users.find_one({"user_id": template["user_id"]}, {"_id": 0})
    if not owner:
        return None
    canonical = canonical_pool_fields(template["from_location"], template["to_location"])
    pool = {
        "pool_id": f"pool_{uuid.uuid4().hex[:12]}",
        "user_id": owner["user_id"],
        "user_name": owner.get("name") or "Traveller",
        "user_email": owner["email"],
        "user_gender": owner.get("gender"),
        "from_location": template["from_location"],
        "to_location": template["to_location"],
        "travel_datetime": target,
        "gender_preference": template.get("gender_preference", "any"),
        "companions": int(template.get("companions") or 0),
        "total_seats": int(template.get("total_seats") or 4),
        "luggage": template.get("luggage"),
        "notes": template.get("notes"),
        "trip_mode": False,
        "trip_status": "planning",
        "status": "open",
        "created_at": now,
        "confirmed_travelers": [],
        "recurring_template_id": template_id,
        **canonical,
    }
    await db.pools.insert_one(pool)
    pool.pop("_id", None)
    await db.recurring_routes.update_one({"template_id": template_id}, {"$set": {"last_materialized_at": now, "next_departure": target}})
    try:
        from services.match_service import materialize_matches_for_pool
        asyncio.create_task(materialize_matches_for_pool(pool))
    except Exception:
        pass
    asyncio.create_task(notify_saved_route_watchers(pool))
    return pool


async def materialize_due_recurring_routes(user_id: Optional[str] = None) -> int:
    query: Dict[str, Any] = {"active": True}
    if user_id:
        query["user_id"] = user_id
    templates = await db.recurring_routes.find(query, {"_id": 0}).to_list(1000)
    created = 0
    for template in templates:
        if await materialize_recurring_template(template):
            created += 1
    return created
