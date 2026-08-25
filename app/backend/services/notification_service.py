"""Notification service for match, request and trip events."""

import asyncio
import logging
from typing import Any, Dict, List

from helpers.email_helper import send_email
from helpers.push_helper import send_push

logger = logging.getLogger("unipool.notification")


async def send_email_notification(to_email: str, subject: str, html_content: str) -> bool:
    try:
        return await send_email(to_email, subject, html_content)
    except Exception as exc:
        logger.error("Failed to send email notification: %s", exc)
        return False


async def send_push_notification(user_id: str, title: str, body: str, url: str = "/") -> bool:
    try:
        return await send_push(user_id, title, body, url)
    except Exception as exc:
        logger.error("Failed to send push notification: %s", exc)
        return False


async def send_match_notifications(pool: Dict[str, Any], matches: List[Dict[str, Any]]) -> None:
    """Notify both sides of each newly materialized backend match."""
    jobs = []
    for match in matches:
        score = match.get("match_score")
        score_text = f" ({score}% fit)" if score is not None else ""
        owner_body = f"{match.get('user_name', 'A traveller')} is also going {match.get('from_location')} → {match.get('to_location')}{score_text}."
        match_body = f"{pool.get('user_name', 'A traveller')} is also going {pool.get('from_location')} → {pool.get('to_location')}{score_text}."
        chat_url = f"/chat/group/{match['conversation_id']}" if match.get("conversation_id") else "/(tabs)/matches"
        jobs.extend([
            send_push_notification(pool["user_id"], "New UniPool match", owner_body, chat_url),
            send_push_notification(match["user_id"], "New UniPool match", match_body, chat_url),
        ])
        if pool.get("user_email"):
            jobs.append(send_email_notification(pool["user_email"], "UniPool: New match found", f"<html><body><p>{owner_body}</p><p>Open UniPool to coordinate the trip.</p></body></html>"))
        if match.get("user_email"):
            jobs.append(send_email_notification(match["user_email"], "UniPool: New match found", f"<html><body><p>{match_body}</p><p>Open UniPool to coordinate the trip.</p></body></html>"))
    if jobs:
        await asyncio.gather(*jobs, return_exceptions=True)


__all__ = ["send_email_notification", "send_push_notification", "send_match_notifications"]
