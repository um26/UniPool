"""College ID verification and trust-badge helpers."""

from datetime import datetime, timezone
from typing import Optional

from config.database import db
from config.settings import DEFAULT_VERIFIED_SUFFIXES, VERIFIED_EMAIL_DOMAINS
from helpers.roll_number_decoder import decode_roll_number


def _is_verified_domain(email: str) -> bool:
    email = (email or "").lower()
    if "@" not in email:
        return False
    domain = email.split("@", 1)[1]
    if domain in VERIFIED_EMAIL_DOMAINS:
        return True
    return any(email.endswith(suffix) for suffix in DEFAULT_VERIFIED_SUFFIXES)


def _decode_roll_number(local_part: str) -> Optional[dict]:
    return decode_roll_number(local_part)


async def sync_user_college_profile(user: dict) -> dict:
    """Repair verified academic identity from the authoritative roll mapping."""
    if not user or not user.get("college_verified"):
        return user

    roll = (user.get("roll_number") or "").strip()
    if not roll:
        college_email = (user.get("college_email") or "").strip()
        if "@" in college_email:
            roll = college_email.split("@", 1)[0]
    if not roll:
        return user

    decoded = decode_roll_number(roll)
    if not decoded:
        return user

    fields = {
        "roll_number": decoded["roll_number"],
        "school_code": decoded.get("school_code"),
        "school_name": decoded.get("school_name"),
        "batch_year": decoded.get("batch_year"),
        "degree_level_code": decoded.get("degree_level_code"),
        "degree_level_name": decoded.get("degree_level_name"),
        "branch_code": decoded.get("branch_code"),
        "branch_name": decoded.get("branch_name"),
        "program_name": decoded.get("program_name"),
        "serial": decoded.get("serial"),
    }
    changed = any(user.get(key) != value for key, value in fields.items())
    if changed and user.get("user_id"):
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": fields})
    return {**user, **fields}


async def _college_info_map(user_ids: list) -> dict:
    if not user_ids:
        return {}
    users = await db.users.find(
        {"user_id": {"$in": user_ids}, "college_verified": True},
        {
            "_id": 0,
            "user_id": 1,
            "roll_number": 1,
            "college_email": 1,
            "school_code": 1,
            "school_name": 1,
            "degree_level_code": 1,
            "degree_level_name": 1,
            "branch_code": 1,
            "branch_name": 1,
            "program_name": 1,
            "batch_year": 1,
            "serial": 1,
            "college_verified": 1,
        },
    ).to_list(len(user_ids))
    result = {}
    for user in users:
        synced = await sync_user_college_profile(user)
        result[user["user_id"]] = synced
    return result


def _compute_badges(
    college_verified: bool,
    rating_avg: Optional[float],
    rating_count: int,
    rides_completed: int,
) -> list:
    badges = []
    if college_verified:
        badges.append(
            {"id": "verified", "label": "Verified Student", "icon": "shield-checkmark"}
        )
    if rating_avg is not None and rating_avg >= 8.5 and rating_count >= 3:
        badges.append({"id": "top_rated", "label": "Top Rated", "icon": "trophy"})
    if rides_completed >= 5:
        badges.append(
            {"id": "frequent", "label": "Frequent Traveller", "icon": "flame"}
        )
    return badges


async def _rides_completed_map(user_ids: list) -> dict:
    """Count shared rides whose departure time has actually passed."""
    if not user_ids:
        return {}

    now = datetime.now(timezone.utc)
    pools = await db.pools.find(
        {
            "travel_datetime": {"$lt": now},
            "confirmed_travelers.0": {"$exists": True},
            "$or": [
                {"user_id": {"$in": user_ids}},
                {"confirmed_travelers.user_id": {"$in": user_ids}},
            ],
        },
        {"_id": 0, "pool_id": 1, "user_id": 1, "confirmed_travelers": 1},
    ).to_list(5000)

    counts = {uid: 0 for uid in user_ids}
    for pool in pools:
        participants = {pool.get("user_id")}
        participants.update(
            t.get("user_id")
            for t in pool.get("confirmed_travelers", [])
            if t.get("user_id")
        )
        for uid in participants:
            if uid in counts:
                counts[uid] += 1
    return {uid: count for uid, count in counts.items() if count}


async def _attach_badges(
    items: list,
    id_field: str,
    email_field: str,
    avg_field: str,
    count_field: str,
    out_field: str,
    roll_field: Optional[str] = None,
) -> list:
    if not items:
        return items
    user_ids = [item[id_field] for item in items if item.get(id_field)]
    college_map = await _college_info_map(user_ids)
    rides_map = await _rides_completed_map(user_ids)
    for item in items:
        uid = item.get(id_field)
        college_info = college_map.get(uid)
        college_verified = bool(college_info) or item.get("college_verified", False)
        item[out_field] = _compute_badges(
            college_verified,
            item.get(avg_field),
            item.get(count_field, 0),
            rides_map.get(uid, 0),
        )
        if roll_field and college_info:
            item[roll_field] = college_info
    return items
