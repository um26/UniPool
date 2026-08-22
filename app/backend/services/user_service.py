"""
User service.
Contains business logic for user profile management, college verification, and related operations.
"""

import sys
from pathlib import Path

# Add the backend directory to the Python path so we can import from it
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from typing import Optional, Dict, Any, List
from datetime import timedelta
from config.database import db
from helpers.auth_helper import _with_admin_flag
from helpers.college_helper import _is_verified_domain, _decode_roll_number, _college_info_map, _compute_badges, _attach_badges
from helpers.email_helper import send_email, college_verification_email_html
from models.user import UserProfileUpdate, CollegeVerifyStart, CollegeVerifyConfirm
from models.auth import RatingCreate
import secrets
import logging
from datetime import datetime, timezone

logger = logging.getLogger("unipool.user")

async def update_profile(user_id: str, body: UserProfileUpdate) -> Optional[Dict[str, Any]]:
    """
    Update user profile information.

    Args:
        user_id: User ID to update
        body: Profile update data

    Returns:
        Updated user data if successful, None otherwise
    """
    updates = {k: v for k, v in body.dict().items() if v is not None}
    if updates:
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": updates}
        )
    updated = await db.users.find_one(
        {"user_id": user_id},
        {"_id": 0, "password_hash": 0}
    )
    return _with_admin_flag(updated) if updated else None

async def start_college_verification(user_id: str, body: CollegeVerifyStart) -> bool:
    """
    Start college verification process by sending verification code.

    Args:
        user_id: User ID requesting verification
        body: College verification start request

    Returns:
        True if verification email was sent, False otherwise

    Raises:
        Exception: If email format is invalid or roll number already verified
    """
    email = body.college_email.strip().lower()

    # Validate email domain
    if "@" not in email or email.split("@", 1)[1] != "mahindrauniversity.edu.in":
        raise Exception("Please enter your @mahindrauniversity.edu.in college email.")

    # Decode roll number from email
    local_part = email.split("@", 1)[0]
    decoded = _decode_roll_number(local_part)
    if not decoded:
        raise Exception("Couldn't recognize your roll number format from this email. Please reach out if you think this is a mistake.")

    # Check if roll number is already verified on another account
    existing_owner = await db.users.find_one(
        {"roll_number": decoded["roll_number"], "college_verified": True, "user_id": {"$ne": user_id}},
        {"_id": 0}
    )
    if existing_owner:
        raise Exception("This roll number is already verified on another account.")

    # Generate and store verification code
    code = f"{secrets.randbelow(1000000):06d}"
    await db.college_verifications.update_one(
        {"user_id": user_id},
        {"$set": {
            "user_id": user_id,
            "college_email": email,
            "code": code,
            "expires_at": datetime.now(timezone.utc) + timedelta(minutes=15),
            "attempts": 0,
            "created_at": datetime.now(timezone.utc),
        }},
        upsert=True,
    )

    # Send verification email
    try:
        html_content = college_verification_email_html(code, email)
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"college_email": email}}  # Temporarily store for email sending
        )
        sent = await send_email(
            email,
            "UniPool: College Verification Code",
            html_content
        )
        return sent
    except Exception as e:
        logger.error(f"Failed to send college verification email: {e}")
        return False

async def confirm_college_verification(user_id: str, body: CollegeVerifyConfirm) -> Dict[str, Any]:
    """
    Confirm college verification with the provided code.

    Args:
        user_id: User ID requesting verification confirmation
        body: College verification confirm request containing the code

    Returns:
        Dictionary containing updated college info and computed badges

    Raises:
        Exception: If code is invalid, expired, or too many attempts
    """
    # Fetch verification record
    record = await db.college_verifications.find_one(
        {"user_id": user_id},
        {"_id": 0}
    )

    if not record:
        raise Exception("No verification request found. Please start the verification process first.")

    # Check if code has expired
    expires_at = record["expires_at"]
    if expires_at < datetime.now(timezone.utc):
        raise Exception("Verification code has expired. Please start the verification process again.")

    # Check attempt limit
    if record.get("attempts", 0) >= 3:
        raise Exception("Too many verification attempts. Please start the verification process again.")

    # Verify the code
    if body.code != record["code"]:
        # Increment attempt counter
        await db.college_verifications.update_one(
            {"user_id": user_id},
            {"$inc": {"attempts": 1}}
        )
        raise Exception("Invalid verification code. Please check your email and try again.")

    # Mark verification as successful
    await db.college_verifications.update_one(
        {"user_id": user_id},
        {"$set": {"verified": True, "verified_at": datetime.now(timezone.utc)}}
    )

    # Decode and store college information
    local_part = record["college_email"].split("@", 1)[0]
    decoded = _decode_roll_number(local_part.lower())
    if decoded:
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {
                "college_verified": True,
                **{k: v for k, v in decoded.items() if k != "roll_number"}
            }}
        )

    # Fetch updated user data and compute badges
    user = await db.users.find_one(
        {"user_id": user_id},
        {"_id": 0, "password_hash": 0}
    )

    if not user:
        raise Exception("User not found")

    # Get rating information for badge calculation
    rating_pipeline = [
        {"$match": {"rated_user_id": user_id}},
        {"$group": {"_id": None, "avg": {"$avg": "$stars"}, "count": {"$sum": 1}}}
    ]
    rating_stats = await db.ratings.aggregate(rating_pipeline).to_list(1)
    rating_avg = rating_stats[0]["avg"] if rating_stats else None
    rating_count = rating_stats[0]["count"] if rating_stats else 0

    # Get ride completion count for badge calculation
    from helpers.college_helper import _rides_completed_map
    rides_map = await _rides_completed_map([user_id])
    rides_completed = rides_map.get(user_id, 0)

    # Compute and attach badges
    badges = _compute_badges(
        user.get("college_verified", False),
        rating_avg,
        rating_count,
        rides_completed
    )

    # Update user with badges
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"badges": badges}}
    )

    # Return updated user data
    updated_user = await db.users.find_one(
        {"user_id": user_id},
        {"_id": 0, "password_hash": 0}
    )
    updated_user["badges"] = badges
    updated_user["college_id"] = {
        "roll_number": user.get("roll_number"),
        "school_name": user.get("school_name"),
        "degree_level_name": user.get("degree_level_name"),
        "branch_name": user.get("branch_name"),
        "batch_year": user.get("batch_year")
    } if user.get("college_verified") else None

    return _with_admin_flag(updated_user)

async def submit_rating(user_id: str, body: RatingCreate) -> Dict[str, Any]:
    """
    Submit a rating for another user.

    Args:
        user_id: ID of the user submitting the rating
        body: Rating submission data

    Returns:
        Dictionary containing updated rating statistics for the rated user

    Raises:
        Exception: If user tries to rate themselves, invalid stars, or rated user not found
    """
    # Prevent self-rating
    if body.rated_user_id == user_id:
        raise Exception("You can't rate yourself")

    # Validate rating range
    if not (1 <= body.stars <= 10):
        raise Exception("Rating must be between 1 and 10")

    # Check if rated user exists
    rated_user = await db.users.find_one(
        {"user_id": body.rated_user_id},
        {"_id": 0, "password_hash": 0}
    )
    if not rated_user:
        raise Exception("User not found")

    # Upsert the rating (one rating per rater-rated pair)
    await db.ratings.update_one(
        {
            "rater_user_id": user_id,
            "rated_user_id": body.rated_user_id
        },
        {
            "$set": {
                "rater_user_id": user_id,
                "rater_name": (await db.users.find_one(
                    {"user_id": user_id},
                    {"_id": 0}
                ) or {}).get("name", "Unknown"),
                "rated_user_id": body.rated_user_id,
                "stars": body.stars,
                "comment": (body.comment or "").strip()[:500] or None,
                "pool_id": body.pool_id,
                "created_at": datetime.now(timezone.utc),
                "scale": 10
            }
        },
        upsert=True
    )

    # Calculate updated rating statistics
    pipeline = [
        {"$match": {"rated_user_id": body.rated_user_id}},
        {"$group": {"_id": None, "avg": {"$avg": "$stars"}, "count": {"$sum": 1}}}
    ]
    stats = await db.ratings.aggregate(pipeline).to_list(1)
    stats = stats[0] if stats else {"avg": body.stars, "count": 1}

    # Get college info and ride count for badges
    college_map = await _college_info_map([body.rated_user_id])
    from helpers.college_helper import _rides_completed_map
    rides_map = await _rides_completed_map([body.rated_user_id])

    # Compute badges for rated user
    user_data = await db.users.find_one(
        {"user_id": body.rated_user_id},
        {"_id": 0, "password_hash": 0}
    )
    badges = _compute_badges(
        bool(college_map.get(body.rated_user_id)),
        stats["avg"],
        stats["count"],
        rides_map.get(body.rated_user_id, 0)
    )

    return {
        "ok": True,
        "user_rating_avg": round(stats["avg"], 1),
        "user_rating_count": stats["count"],
        "badges": badges
    }

async def get_user_ratings(user_id: str) -> Dict[str, Any]:
    """
    Get rating information for a specific user.

    Args:
        user_id: User ID to get ratings for

    Returns:
        Dictionary containing average rating, count, individual ratings, and badges
    """
    # Verify user exists
    await db.users.find_one(
        {"user_id": user_id},
        {"_id": 0}
    )

    # Fetch ratings
    ratings_cursor = db.ratings.find(
        {"rated_user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1)
    ratings = await ratings_cursor.to_list(100)

    # Calculate average rating
    avg = round(sum(r["stars"] for r in ratings) / len(ratings), 1) if ratings else None

    # Get college info and ride count for badges
    college_map = await _college_info_map([user_id])
    from helpers.college_helper import _rides_completed_map
    rides_map = await _rides_completed_map([user_id])

    # Compute badges
    badges = _compute_badges(
        user_id in college_map,
        avg,
        len(ratings),
        rides_map.get(user_id, 0)
    )

    return {
        "average": avg,
        "count": len(ratings),
        "ratings": ratings,
        "badges": badges,
        "college_id": college_map.get(user_id),
        "rides_completed": rides_map.get(user_id, 0)
    }

async def can_rate(user_id: str, target_user_id: str) -> Dict[str, Any]:
    """
    Check if the current user has already rated the target user.

    Args:
        user_id: ID of the user who would be rating
        target_user_id: ID of the user being rated

    Returns:
        Dictionary indicating if user has already rated target and existing rating if so
    """
    # Prevent self-rating check
    if user_id == target_user_id:
        return {"already_rated": False, "existing": None}

    existing = await db.ratings.find_one(
        {"rater_user_id": user_id, "rated_user_id": target_user_id},
        {"_id": 0}
    )
    return {"already_rated": existing is not None, "existing": existing}

# Helper function for blocking users
async def block_user(blocker_id: str, blocked_id: str) -> bool:
    """
    Block one user from another.

    Args:
        blocker_id: User ID doing the blocking
        blocked_id: User ID being blocked

    Returns:
        True if block was created, False otherwise
    """
    # Prevent self-blocking
    if blocker_id == blocked_id:
        return False

    # Check if target user exists
    target = await db.users.find_one(
        {"user_id": blocked_id},
        {"_id": 0, "password_hash": 0}
    )
    if not target:
        return False

    # Create block relationship
    await db.blocks.update_one(
        {"blocker_id": blocker_id, "blocked_id": blocked_id},
        {"$setOnInsert": {
            "blocker_id": blocker_id,
            "blocked_id": blocked_id,
            "created_at": datetime.now(timezone.utc)
        }},
        upsert=True
    )
    return True

async def unblock_user(blocker_id: str, blocked_id: str) -> bool:
    """
    Unblock a previously blocked user.

    Args:
        blocker_id: User ID doing the unblocking
        blocked_id: User ID being unblocked

    Returns:
        True if block was removed, False if no block existed
    """
    result = await db.blocks.delete_one(
        {"blocker_id": blocker_id, "blocked_id": blocked_id}
    )
    return result.deleted_count > 0

async def list_blocked(user_id: str) -> List[Dict[str, Any]]:
    """
    Get list of users blocked by the given user.

    Args:
        user_id: User ID to get blocked list for

    Returns:
        List of blocked user dictionaries with names and block timestamps
    """
    # Get block records
    cursor = db.blocks.find(
        {"blocker_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1)
    blocks = await cursor.to_list(500)
    blocked_ids = [r["blocked_id"] for r in blocks]

    if not blocked_ids:
        return []

    # Get user information for blocked users
    users = await db.users.find(
        {"user_id": {"$in": blocked_ids}},
        {"_id": 0, "password_hash": 0}
    ).to_list(500)
    user_map = {u["user_id"]: u for u in users}

    # Build response
    return [
        {
            "user_id": r["blocked_id"],
            "name": user_map.get(r["blocked_id"], {}).get("name", "Unknown"),
            "blocked_at": r["created_at"]
        }
        for r in blocks
    ]