"""
College ID verification helper functions.
Contains utilities for college email verification and roll number decoding.
"""

import re
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional
from config.settings import (
    COLLEGE_EMAIL_DOMAIN, ROLL_NUMBER_RE, SCHOOL_CODES,
    DEGREE_LEVEL_NAMES, BRANCH_CODES, DEFAULT_VERIFIED_SUFFIXES, VERIFIED_EMAIL_DOMAINS
)
from config.database import db

def _is_verified_domain(email: str) -> bool:
    """
    Check if email domain is verified for automatic student badge.

    Args:
        email: Email address to check

    Returns:
        True if domain is verified, False otherwise
    """
    email = (email or "").lower()
    if "@" not in email:
        return False
    domain = email.split("@", 1)[1]
    if domain in VERIFIED_EMAIL_DOMAINS:
        return True
    return any(email.endswith(suffix) for suffix in DEFAULT_VERIFIED_SUFFIXES)

def _decode_roll_number(local_part: str) -> Optional[dict]:
    """
    Decode Mahindra University roll number from email local part.

    Expected format: se22ucam015 (school + year + degree + branch + serial)
    Example: se22ucam015@mahindrauniversity.edu.in

    Args:
        local_part: Email local part (before @)

    Returns:
        Dictionary with decoded information or None if invalid format
    """
    m = ROLL_NUMBER_RE.match(local_part.lower())
    if not m:
        return None

    school_code, yy, degree_code, branch_code, serial = m.groups()
    return {
        "roll_number": local_part.upper(),
        "school_code": school_code.upper(),
        "school_name": SCHOOL_CODES.get(school_code, school_code.upper()),
        "batch_year": 2000 + int(yy),
        "degree_level_code": degree_code.upper(),
        "degree_level_name": DEGREE_LEVEL_NAMES.get(degree_code, degree_code.upper()),
        "branch_code": branch_code.upper(),
        "branch_name": BRANCH_CODES.get(branch_code, branch_code.upper()),
        "serial": serial,
    }

async def _college_info_map(user_ids: list) -> dict:
    """
    Batch-fetch verified college-ID info for a set of user_ids.

    Args:
        user_ids: List of user IDs to fetch college info for

    Returns:
        Dictionary mapping user_id to college info dict
    """
    if not user_ids:
        return {}

    cursor = db.users.find(
        {"user_id": {"$in": user_ids}, "college_verified": True},
        {"_id": 0, "user_id": 1, "roll_number": 1, "school_name": 1,
         "degree_level_name": 1, "branch_name": 1, "batch_year": 1}
    )
    return {u["user_id"]: u async for u in cursor}

def _compute_badges(college_verified: bool, rating_avg: Optional[float],
                   rating_count: int, rides_completed: int) -> list:
    """
    Compute user badges based on verification status, ratings, and ride history.

    Args:
        college_verified: Whether user has verified college ID
        rating_avg: Average rating score (1-10)
        rating_count: Number of ratings received
        rides_completed: Number of completed rides

    Returns:
        List of badge dictionaries
    """
    badges = []
    if college_verified:
        badges.append({"id": "verified", "label": "Verified Student", "icon": "shield-checkmark"})
    if rating_avg is not None and rating_avg >= 8.5 and rating_count >= 3:
        badges.append({"id": "top_rated", "label": "Top Rated", "icon": "trophy"})
    if rides_completed >= 5:
        badges.append({"id": "frequent", "label": "Frequent Traveller", "icon": "flame"})
    return badges

async def _rides_completed_map(user_ids: list) -> dict:
    """
    Calculate how many confirmed ride-pairings each user has been part of.

    Args:
        user_ids: List of user IDs to calculate rides for

    Returns:
        Dictionary mapping user_id to ride completion count
    """
    if not user_ids:
        return {}

    # Count rides where user is requester and request was accepted
    as_requester = await db.join_requests.aggregate([
        {"$match": {"requester_id": {"$in": user_ids}, "status": "accepted"}},
        {"$group": {"_id": "$requester_id", "c": {"$sum": 1}}},
    ]).to_list(len(user_ids))

    # Count rides where user is pool owner and has confirmed travelers
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
    """
    Batch-attach a 'badges' list (and optionally verified college-ID info)
    to each dict in items, using rating stats already present on that dict
    plus a fresh rides-completed + college-verification lookup.

    Args:
        items: List of dictionaries to attach badges to
        id_field: Field name containing user ID
        email_field: Field name containing user email
        avg_field: Field name containing rating average
        count_field: Field name containing rating count
        out_field: Field name to store the badges list
        roll_field: Optional field name containing roll number

    Returns:
        List of items with badges attached
    """
    if not items:
        return items

    user_ids = [item[id_field] for item in items]
    emails = [item[email_field] for item in items]
    roll_numbers = [item.get(roll_field) for item in items] if roll_field else None

    # Fetch college verification info in batch
    college_map = await _college_info_map(user_ids)

    # Fetch ride completion counts in batch
    rides_map = await _rides_completed_map(user_ids)

    # Process each item
    for item, email in zip(items, emails):
        college_verified = (
            item.get("college_verified", False) or
            _is_verified_domain(email) or
            (roll_field and item.get(roll_field) and
             _decode_roll_number(item[roll_field].split("@")[0].lower()) is not None)
        )

        item[out_field] = _compute_badges(
            college_verified,
            item.get(avg_field),
            item.get(count_field, 0),
            rides_map.get(item[id_field], 0)
        )

        # Add college ID info if verified and roll field exists
        if college_verified and roll_field and item.get(roll_field):
            local_part = item[roll_field].split("@")[0]
            decoded = _decode_roll_number(local_part.lower())
            if decoded:
                item.update({k: v for k, v in decoded.items()
                           if k not in ["roll_number"]})  # Avoid overwriting existing

    return items