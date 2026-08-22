"""
Authentication helper functions.
Contains utilities for password hashing, token creation, and verification.
"""

import bcrypt
import secrets
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional
from config.settings import SESSION_EXPIRE_DAYS, ADMIN_EMAILS, SEED_ADMIN_USERNAME
from config.database import db

def _hash_password(password: str) -> str:
    """
    Hash a password using bcrypt.

    Args:
        password: Plain text password to hash

    Returns:
        Hashed password string
    """
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def _verify_password(password: str, password_hash: str) -> bool:
    """
    Verify a password against its hash.

    Args:
        password: Plain text password to verify
        password_hash: Hashed password to check against

    Returns:
        True if password matches hash, False otherwise
    """
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except Exception:
        return False

async def _create_session_token(user_id: str) -> str:
    """
    Create a new session token for a user.

    Args:
        user_id: User ID to create session for

    Returns:
        Generated session token
    """
    session_token = uuid.uuid4().hex
    expires_at = datetime.now(timezone.utc) + timedelta(days=SESSION_EXPIRE_DAYS)

    await db.user_sessions.insert_one(
        {
            "session_token": session_token,
            "user_id": user_id,
            "expires_at": expires_at,
            "created_at": datetime.now(timezone.utc),
        }
    )
    return session_token

async def _create_session_for_user(email: str, name: str, picture: Optional[str]) -> dict:
    """
    Shared logic: upsert the user, mint a session token, return {session_token, user}.

    Args:
        email: User email
        name: User name
        picture: User picture URL (optional)

    Returns:
        Dictionary containing session_token and user document
    """
    existing_user = await db.users.find_one({"email": email}, {"_id": 0, "password_hash": 0})
    if existing_user:
        user_id = existing_user["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": name, "picture": picture, "last_login": datetime.now(timezone.utc)}}
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        # For new users from OAuth, we don't have a password yet
        await db.users.insert_one(
            {
                "user_id": user_id,
                "email": email,
                "username": None,  # Will be set later if user chooses
                "name": name,
                "picture": picture,
                "gender": None,
                "phone": None,
                "password_hash": "",  # Empty for OAuth users
                "created_at": datetime.now(timezone.utc),
                "last_login": datetime.now(timezone.utc),
            }
        )

    session_token = await _create_session_token(user_id)
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    return {"session_token": session_token, "user": _with_admin_flag(user_doc)}

def _with_admin_flag(user_doc: dict) -> dict:
    """
    Add admin flag to user document based on environment configuration.

    Args:
        user_doc: User document from database

    Returns:
        User document with is_admin field added
    """
    user = user_doc.copy()
    is_admin = (
        user.get("email") in ADMIN_EMAILS
        or user.get("username") == SEED_ADMIN_USERNAME
        or user.get("is_admin_override") is True
    )
    user["is_admin"] = is_admin
    return user