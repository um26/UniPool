"""Authentication helper functions."""

import bcrypt
from datetime import datetime, timedelta, timezone
from typing import Optional
import uuid

from config.database import db
from config.settings import (
    ADMIN_EMAILS,
    SEED_ADMIN_EMAIL,
    SEED_ADMIN_PASSWORD,
    SEED_ADMIN_USERNAME,
    SESSION_EXPIRE_DAYS,
)


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except Exception:
        return False


async def _create_session_token(user_id: str) -> str:
    session_token = uuid.uuid4().hex
    expires_at = datetime.now(timezone.utc) + timedelta(days=SESSION_EXPIRE_DAYS)
    await db.user_sessions.insert_one({
        "session_token": session_token,
        "user_id": user_id,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc),
    })
    return session_token


async def _create_session_for_user(email: str, name: str, picture: Optional[str]) -> dict:
    existing_user = await db.users.find_one({"email": email}, {"_id": 0, "password_hash": 0})
    if existing_user:
        user_id = existing_user["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": name, "picture": picture, "last_login": datetime.now(timezone.utc)}},
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "username": None,
            "name": name,
            "picture": picture,
            "gender": None,
            "phone": None,
            "password_hash": "",
            "created_at": datetime.now(timezone.utc),
            "last_login": datetime.now(timezone.utc),
        })

    session_token = await _create_session_token(user_id)
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    return {"session_token": session_token, "user": _with_admin_flag(user_doc)}


def _seed_admin_is_explicit() -> bool:
    if not (SEED_ADMIN_EMAIL and SEED_ADMIN_USERNAME and SEED_ADMIN_PASSWORD):
        return False
    return not (
        SEED_ADMIN_EMAIL == "admin@unipool.app"
        and SEED_ADMIN_USERNAME == "admin"
        and SEED_ADMIN_PASSWORD == "securepassword123"
    )


def _with_admin_flag(user_doc: dict) -> dict:
    user = user_doc.copy()
    configured_seed_admin = _seed_admin_is_explicit() and (
        user.get("email") == SEED_ADMIN_EMAIL or user.get("username") == SEED_ADMIN_USERNAME
    )
    is_admin = (
        str(user.get("email") or "").lower() in ADMIN_EMAILS
        or configured_seed_admin
        or user.get("is_admin_override") is True
    )
    user["is_admin"] = is_admin
    return user
