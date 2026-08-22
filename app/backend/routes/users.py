"""
User-related endpoints.
"""

import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Header, HTTPException

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from config.database import db
from services.auth_service import get_current_user

router = APIRouter(prefix="/users", tags=["users"])
ONLINE_THRESHOLD_SECONDS = 60


def _is_online(last_seen: Optional[datetime]) -> bool:
    if not last_seen:
        return False
    if last_seen.tzinfo is None or last_seen.tzinfo.utcoffset(last_seen) is None:
        last_seen = last_seen.replace(tzinfo=timezone.utc)
    return (datetime.now(timezone.utc) - last_seen).total_seconds() < ONLINE_THRESHOLD_SECONDS


@router.get("/{user_id}/presence")
async def get_presence(user_id: str, authorization: Optional[str] = Header(None)):
    """Return the target user's online state and last activity time."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    user = await get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    target = await db.users.find_one({"user_id": user_id}, {"_id": 0, "last_seen": 1})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "online": _is_online(target.get("last_seen")),
        "last_seen": target.get("last_seen"),
    }


__all__ = ["router"]
