"""
Authentication service.
Contains business logic for user authentication, registration, and session management.
"""

import asyncio
import sys
from pathlib import Path

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from typing import Optional, Dict, Any
from config.database import db
from helpers.auth_helper import (
    _hash_password, _verify_password, _create_session_token,
    _create_session_for_user, _with_admin_flag
)
from helpers.roll_number_decoder import decode_roll_number
from models.user import UserOut, SignupRequest, LoginRequest
from models.auth import GoogleSignIn
from config.settings import GOOGLE_CLIENT_ID
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests
from cachecontrol import CacheControl
import requests as requests_lib
import logging
import httpx
from datetime import datetime, timezone, timedelta
from config.settings import TURNSTILE_SECRET_KEY

logger = logging.getLogger("unipool.auth")

IST = timezone(timedelta(hours=5, minutes=30))
_GOOGLE_REQUEST = google_requests.Request(session=CacheControl(requests_lib.Session()))
MU_EMAIL_DOMAIN = "mahindrauniversity.edu.in"


def _fmt_ist(dt: datetime) -> str:
    """Format stored datetimes as India Standard Time for notifications."""
    if dt.tzinfo is None or dt.tzinfo.utcoffset(dt) is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(IST).strftime("%d %b %Y, %I:%M %p IST")


def _is_mu_email(email: str) -> bool:
    normalized = (email or "").strip().lower()
    return normalized.endswith(f"@{MU_EMAIL_DOMAIN}") and normalized.count("@") == 1


async def verify_turnstile(token: Optional[str], remote_ip: Optional[str]) -> bool:
    if not TURNSTILE_SECRET_KEY:
        return True
    if not token:
        return False
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(
                "https://challenges.cloudflare.com/turnstile/v0/siteverify",
                data={"secret": TURNSTILE_SECRET_KEY, "response": token, "remoteip": remote_ip or ""},
            )
        return bool(response.json().get("success"))
    except Exception as exc:
        logger.error("Turnstile verification failed: %s", exc)
        return False


async def signup_user(body: SignupRequest) -> Dict[str, Any]:
    """Register a new personal-email user with email and password."""
    email = str(body.email).strip().lower()
    if _is_mu_email(email):
        # Official college mail must prove mailbox ownership before account
        # creation. This also prevents callers bypassing the OTP UI by hitting
        # the legacy signup endpoint directly.
        raise Exception("Verify your Mahindra University email with the OTP signup flow")

    if await db.users.find_one({"email": email}, {"_id": 0}):
        raise Exception("An account with this email already exists")

    username = (body.username or "").strip() or None
    if username:
        if await db.users.find_one({"username": username}, {"_id": 0}):
            raise Exception("That username is already taken")

    user_id = f"user_{__import__('uuid').uuid4().hex[:12]}"
    await db.users.insert_one({
        "user_id": user_id,
        "email": email,
        "username": username,
        "name": body.name.strip() or email.split("@")[0],
        "picture": None,
        "password_hash": _hash_password(body.password),
        "gender": None,
        "phone": None,
        "created_at": datetime.now(timezone.utc),
        "last_login": datetime.now(timezone.utc),
    })

    session_token = await _create_session_token(user_id)
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    return {"session_token": session_token, "user": _with_admin_flag(user_doc)}


async def login_user(body: LoginRequest) -> Dict[str, Any]:
    """Authenticate a user with email/username and password."""
    identifier = body.identifier.strip()
    user = await db.users.find_one(
        {"$or": [{"email": identifier.lower()}, {"username": identifier}]},
        {"_id": 0}
    )

    if not user or not user.get("password_hash") or not _verify_password(body.password, user["password_hash"]):
        raise Exception("Incorrect email/username or password")

    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"last_login": datetime.now(timezone.utc)}}
    )

    session_token = await _create_session_token(user["user_id"])
    user_doc = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "password_hash": 0})
    return {"session_token": session_token, "user": _with_admin_flag(user_doc)}


async def google_sign_in(body: GoogleSignIn) -> Dict[str, Any]:
    """Authenticate/register with Google and auto-verify a trusted MU mailbox."""
    if not GOOGLE_CLIENT_ID:
        raise RuntimeError("Server missing GOOGLE_CLIENT_ID")
    try:
        idinfo = await asyncio.to_thread(
            google_id_token.verify_oauth2_token,
            body.id_token,
            _GOOGLE_REQUEST,
            GOOGLE_CLIENT_ID,
        )
    except Exception as exc:
        logger.warning("Google token verification failed: %s", exc)
        raise ValueError("Invalid Google token") from exc

    email = idinfo.get("email")
    if not email or not idinfo.get("email_verified", False):
        logger.warning("Google sign-in rejected an unverified or missing email")
        raise ValueError("Google email not verified")

    email = email.strip().lower()
    name = idinfo.get("name") or email.split("@", 1)[0]
    picture = idinfo.get("picture")

    decoded = None
    if _is_mu_email(email):
        decoded = decode_roll_number(email.split("@", 1)[0])
        if not decoded:
            raise ValueError("Couldn't recognize your Mahindra University roll number from this Google account")

        existing_identity = await db.users.find_one(
            {
                "roll_number": decoded["roll_number"],
                "college_verified": True,
                "email": {"$ne": email},
            },
            {"_id": 0, "user_id": 1},
        )
        if existing_identity:
            raise ValueError("This college identity is already linked to another UniPool account")

    result = await _create_session_for_user(email, name, picture)

    if decoded:
        verified_fields = {
            "college_verified": True,
            "college_email": email,
            **decoded,
        }
        await db.users.update_one(
            {"user_id": result["user"]["user_id"]},
            {"$set": verified_fields},
        )
        result["user"] = _with_admin_flag({**result["user"], **verified_fields})

    return result


async def logout_user(session_token: str) -> bool:
    result = await db.user_sessions.delete_one({"session_token": session_token})
    return result.deleted_count > 0


async def get_current_user(session_token: str) -> Optional[Dict[str, Any]]:
    """Get current user from session token."""
    if not session_token or not session_token.lower().startswith("bearer "):
        return None

    token = session_token.split(" ", 1)[1].strip()
    session = await db.user_sessions.find_one(
        {"session_token": token}, {"_id": 0}
    )

    if not session:
        return None

    expires_at = _ensure_aware(session["expires_at"])
    if expires_at < _now_utc():
        return None

    user = await db.users.find_one(
        {"user_id": session["user_id"]},
        {"_id": 0, "password_hash": 0}
    )

    if not user:
        return None

    await db.users.update_one(
        {"user_id": session["user_id"]},
        {"$set": {"last_seen": _now_utc()}}
    )

    return _with_admin_flag(user)


def _ensure_aware(dt: datetime) -> datetime:
    """Ensure datetime is timezone aware."""
    if dt.tzinfo is None or dt.tzinfo.utcoffset(dt) is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _now_utc() -> datetime:
    """Get current UTC datetime."""
    return datetime.now(timezone.utc)
