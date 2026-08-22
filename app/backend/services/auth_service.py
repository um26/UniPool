"""
Authentication service.
Contains business logic for user authentication, registration, and session management.
"""

import sys
from pathlib import Path

# Add the backend directory to the Python path so we can import from it
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from typing import Optional, Dict, Any
from config.database import db
from helpers.auth_helper import (
    _hash_password, _verify_password, _create_session_token,
    _create_session_for_user, _with_admin_flag
)
from helpers.college_helper import _is_verified_domain
from models.user import UserOut, SignupRequest, LoginRequest
from models.auth import GoogleSignIn
from config.settings import GOOGLE_CLIENT_ID
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests
import logging
import httpx
from datetime import datetime, timezone, timedelta
from config.settings import TURNSTILE_SECRET_KEY

logger = logging.getLogger("unipool.auth")

IST = timezone(timedelta(hours=5, minutes=30))

def _fmt_ist(dt: datetime) -> str:
    """Format stored datetimes as India Standard Time for notifications."""
    if dt.tzinfo is None or dt.tzinfo.utcoffset(dt) is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(IST).strftime("%d %b %Y, %I:%M %p IST")

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
    """
    Register a new user with email and password.

    Args:
        body: Signup request data

    Returns:
        Dictionary containing session_token and user data

    Raises:
        Exception: If email or username already exists
    """
    # Check if email already exists
    if await db.users.find_one({"email": body.email.lower()}, {"_id": 0}):
        raise Exception("An account with this email already exists")

    # Check if username already exists (if provided)
    username = (body.username or "").strip() or None
    if username:
        if await db.users.find_one({"username": username}, {"_id": 0}):
            raise Exception("That username is already taken")

    # Create new user
    user_id = f"user_{__import__('uuid').uuid4().hex[:12]}"
    await db.users.insert_one({
        "user_id": user_id,
        "email": body.email.strip().lower(),
        "username": username,
        "name": body.name.strip() or body.email.split("@")[0],
        "picture": None,
        "password_hash": _hash_password(body.password),
        "gender": None,
        "phone": None,
        "created_at": datetime.now(timezone.utc),
        "last_login": datetime.now(timezone.utc),
    })

    # Create session and return user data
    session_token = await _create_session_token(user_id)
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    return {"session_token": session_token, "user": _with_admin_flag(user_doc)}

async def login_user(body: LoginRequest) -> Dict[str, Any]:
    """
    Authenticate user with email/username and password.

    Args:
        body: Login request data

    Returns:
        Dictionary containing session_token and user data

    Raises:
        Exception: If credentials are invalid
    """
    identifier = body.identifier.strip()
    user = await db.users.find_one(
        {"$or": [{"email": identifier.lower()}, {"username": identifier}]},
        {"_id": 0}
    )

    if not user or not user.get("password_hash") or not _verify_password(body.password, user["password_hash"]):
        raise Exception("Incorrect email/username or password")

    # Update last login time
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"last_login": datetime.now(timezone.utc)}}
    )

    # Create session and return user data
    session_token = await _create_session_token(user["user_id"])
    user_doc = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "password_hash": 0})
    return {"session_token": session_token, "user": _with_admin_flag(user_doc)}

async def google_sign_in(body: GoogleSignIn) -> Dict[str, Any]:
    """
    Authenticate or register user via Google OAuth.

    Args:
        body: Google sign-in request containing ID token

    Returns:
        Dictionary containing session_token and user data

    The ID token is verified against the configured Google client ID before
    the user account and session are created.
    """
    if not GOOGLE_CLIENT_ID:
        raise RuntimeError("Server missing GOOGLE_CLIENT_ID")
    try:
        idinfo = google_id_token.verify_oauth2_token(
            body.id_token, google_requests.Request(), GOOGLE_CLIENT_ID
        )
    except Exception as exc:
        logger.warning("Google token verification failed: %s", exc)
        raise ValueError("Invalid Google token") from exc

    email = idinfo.get("email")
    if not email or not idinfo.get("email_verified", False):
        logger.warning("Google sign-in rejected an unverified or missing email")
        raise ValueError("Google email not verified")

    name = idinfo.get("name") or email.split("@", 1)[0]
    picture = idinfo.get("picture")
    return await _create_session_for_user(email.strip().lower(), name, picture)

async def logout_user(session_token: str) -> bool:
    """
    Log out a user by deleting their session.

    Args:
        session_token: Session token to delete

    Returns:
        True if session was deleted, False otherwise
    """
    result = await db.user_sessions.delete_one({"session_token": session_token})
    return result.deleted_count > 0

async def get_current_user(session_token: str) -> Optional[Dict[str, Any]]:
    """
    Get current user from session token.

    Args:
        session_token: Session token to validate

    Returns:
        User dictionary if session is valid, None otherwise
    """

    if not session_token or not session_token.lower().startswith("bearer "):
        return None

    token = session_token.split(" ", 1)[1].strip()
    session = await db.user_sessions.find_one(
        {"session_token": token}, {"_id": 0}
    )

    if not session:
        return None

    # Check if session has expired
    expires_at = _ensure_aware(session["expires_at"])
    if expires_at < _now_utc():
        return None

    # Get user data (excluding password hash)
    user = await db.users.find_one(
        {"user_id": session["user_id"]},
        {"_id": 0, "password_hash": 0}
    )

    if not user:
        return None

    # Update last seen timestamp (heartbeat)
    await db.users.update_one(
        {"user_id": session["user_id"]},
        {"$set": {"last_seen": _now_utc()}}
    )

    return _with_admin_flag(user)

# Helper functions (moved from original server.py for compatibility)
def _ensure_aware(dt: datetime) -> datetime:
    """Ensure datetime is timezone aware."""
    if dt.tzinfo is None or dt.tzinfo.utcoffset(dt) is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt

def _now_utc() -> datetime:
    """Get current UTC datetime."""
    return datetime.now(timezone.utc)