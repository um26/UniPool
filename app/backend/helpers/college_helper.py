"""College ID verification helper functions."""

import secrets
from datetime import datetime, timezone
from typing import Optional
from config.settings import DEFAULT_VERIFIED_SUFFIXES, VERIFIED_EMAIL_DOMAINS
from config.database import db
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


async def _college_info_map(user_ids: list) -> dict:
    if not user_ids:
        return {}
    cursor = db.users.find(
        {"user_id": {"$in": user_ids}, "college_verified": True},
        {"_id": 0, "user_id": 1, "roll_number": 1, "school_code": 1,
         "school_name": 1, "degree_level_code": 1, "degree_level_name": 1,
         "branch_code": 1, "branch_name": 1, "program_name": 1,
         "batch_year": 1, "serial": 1}
    )
    return {u["user_id"]: u async for u in cursor}


def _compute_badges(college_verified: bool, rating_avg: Optional[float],
                    rating_count: int, rides_completed: int) -> list:
    badges = []
    if college_verified:
        badges.append({"id": "verified", "label": "Verified Student", "icon": "shield-checkmark"})
    if rating_avg is not None and rating_avg >= 8.5 and rating_count >= 3:
        badges.append({"id": "top_rated", "label": "Top Rated", "icon": "trophy"})
    if rides_completed >= 5:
        badges.append({"id": "frequent", "label": "Frequent Traveller", "icon": "flame"})
    return badges


async def _rides_completed_map(user_ids: list) -> dict:
    if not user_ids:
        return {}
    as_requester = await db.join_requests.aggregate([
        {"$match": {"requester_id": {"$in": user_ids}, "status": "accepted"}},
        {"$group": {"_id": "$requester_id", "c": {"$sum": 1}}},
    ]).to_list(len(user_ids))
    as_owner = await db.pools.aggregate([
        {"$match": {"user_id": {"$in": user_ids}, "confirmed_travelers.0": {"$exists": True}}},
        {"$project": {"user_id": 1, "n": {"$size": "$confirmed_travelers"}}},
        {"$group": {"_id": "$user_id", "c": {"$sum": "$n"}}},
    ]).to_list(len(user_ids))
    counts: dict = {}
    for row in as_requester + as_owner:
        counts[row["_id"]] = counts.get(row["_id"], 0) + row["c"]
    return counts


async def _attach_badges(items: list, id_field: str, email_field: str,
                         avg_field: str, count_field: str, out_field: str,
                         roll_field: Optional[str] = None) -> list:
    if not items:
        return items
    user_ids = [item[id_field] for item in items]
    emails = [item[email_field] for item in items]
    college_map = await _college_info_map(user_ids)
    rides_map = await _rides_completed_map(user_ids)
    for item, email in zip(items, emails):
        college_verified = (
            item.get("college_verified", False)
            or _is_verified_domain(email)
            or (roll_field and item.get(roll_field) and
                _decode_roll_number(item[roll_field].split("@")[0].lower()) is not None)
        )
        item[out_field] = _compute_badges(
            college_verified, item.get(avg_field), item.get(count_field, 0),
            rides_map.get(item[id_field], 0)
        )
        if college_verified and roll_field and item.get(roll_field):
            decoded = _decode_roll_number(item[roll_field].split("@")[0].lower())
            if decoded:
                item.update({k: v for k, v in decoded.items() if k != "roll_number"})
    return items
