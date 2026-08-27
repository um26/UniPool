"""Notification service for match, request, trip and in-app events."""

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from config.database import db
from helpers.email_helper import send_email
from helpers.push_helper import send_push

logger = logging.getLogger("unipool.notification")

DEFAULT_CATEGORIES = {
    "match": True,
    "request": True,
    "trip": True,
    "chat": True,
    "saved_route": True,
    "rating": True,
    "digest": False,
    "games": False,
    "general": True,
}


async def _preferences(user_id: str) -> dict:
    doc = await db.notification_preferences.find_one({"user_id": user_id}, {"_id": 0})
    categories = dict(DEFAULT_CATEGORIES)
    if doc and isinstance(doc.get("categories"), dict):
        for key, value in doc["categories"].items():
            if key in categories and isinstance(value, bool):
                categories[key] = value
    return {
        "push_enabled": True if not doc else bool(doc.get("push_enabled", True)),
        "email_enabled": True if not doc else bool(doc.get("email_enabled", True)),
        "categories": categories,
    }


async def create_in_app_notification(
    user_id: str,
    title: str,
    body: str,
    url: str = "/",
    category: str = "general",
    data: Optional[Dict[str, Any]] = None,
) -> Optional[dict]:
    prefs = await _preferences(user_id)
    if not prefs["categories"].get(category, True):
        return None
    doc = {
        "notification_id": f"note_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "title": title,
        "body": body,
        "category": category,
        "action_url": url or "/",
        "data": data or {},
        "read_at": None,
        "created_at": datetime.now(timezone.utc),
    }
    await db.notifications.insert_one(doc)
    doc.pop("_id", None)
    return doc


async def send_email_notification(to_email: str, subject: str, html_content: str) -> bool:
    try:
        return await send_email(to_email, subject, html_content)
    except Exception as exc:
        logger.error("Failed to send email notification: %s", exc)
        return False


async def send_push_notification(
    user_id: str,
    title: str,
    body: str,
    url: str = "/",
    category: str = "general",
    data: Optional[Dict[str, Any]] = None,
) -> bool:
    try:
        prefs = await _preferences(user_id)
        if not prefs["categories"].get(category, True):
            return False
        await create_in_app_notification(user_id, title, body, url, category, data)
        if not prefs["push_enabled"]:
            return True
        return await send_push(user_id, title, body, url)
    except Exception as exc:
        logger.error("Failed to send notification: %s", exc)
        return False


async def send_match_notifications(pool: Dict[str, Any], matches: List[Dict[str, Any]]) -> None:
    """Notify both sides of each newly materialized backend match."""
    jobs = []
    email_jobs = []
    for match in matches:
        score = match.get("match_score")
        score_text = f" ({score}% fit)" if score is not None else ""
        owner_body = f"{match.get('user_name', 'A traveller')} is also going {match.get('from_location')} → {match.get('to_location')}{score_text}."
        match_body = f"{pool.get('user_name', 'A traveller')} is also going {pool.get('from_location')} → {pool.get('to_location')}{score_text}."
        chat_url = f"/chat/group/{match['conversation_id']}" if match.get("conversation_id") else "/(tabs)/matches"
        jobs.extend([
            send_push_notification(pool["user_id"], "New UniPool match", owner_body, chat_url, "match", {"pool_id": pool.get("pool_id"), "score": score}),
            send_push_notification(match["user_id"], "New UniPool match", match_body, chat_url, "match", {"pool_id": match.get("pool_id"), "score": score}),
        ])
        owner_prefs = await _preferences(pool["user_id"])
        match_prefs = await _preferences(match["user_id"])
        if pool.get("user_email") and owner_prefs["email_enabled"] and owner_prefs["categories"].get("match", True):
            email_jobs.append(send_email_notification(pool["user_email"], "UniPool: New match found", f"<html><body><p>{owner_body}</p><p>Open UniPool to coordinate the trip.</p></body></html>"))
        if match.get("user_email") and match_prefs["email_enabled"] and match_prefs["categories"].get("match", True):
            email_jobs.append(send_email_notification(match["user_email"], "UniPool: New match found", f"<html><body><p>{match_body}</p><p>Open UniPool to coordinate the trip.</p></body></html>"))
    if jobs or email_jobs:
        await asyncio.gather(*(jobs + email_jobs), return_exceptions=True)


__all__ = [
    "create_in_app_notification",
    "send_email_notification",
    "send_push_notification",
    "send_match_notifications",
]
