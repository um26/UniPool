"""
Notification service.
Contains business logic for sending emails and push notifications.
"""

from typing import List, Optional
from typing import Any, Dict
from helpers.email_helper import send_email
from helpers.push_helper import send_push
import logging
import asyncio

logger = logging.getLogger("unipool.notification")

async def send_email_notification(to_email: str, subject: str, html_content: str) -> bool:
    """
    Send an email notification.

    Args:
        to_email: Recipient email address
        subject: Email subject line
        html_content: HTML content of the email

    Returns:
        True if email was sent successfully, False otherwise
    """
    try:
        return await send_email(to_email, subject, html_content)
    except Exception as e:
        logger.error(f"Failed to send email notification: {e}")
        return False

async def send_push_notification(user_id: str, title: str, body: str, url: str = "/") -> bool:
    """
    Send a push notification.

    Args:
        user_id: Target user ID
        title: Notification title
        body: Notification body text
        url: URL to open when notification is clicked

    Returns:
        True if notification was sent successfully, False otherwise
    """
    try:
        return send_push(user_id, title, body, url)
    except Exception as e:
        logger.error(f"Failed to send push notification: {e}")
        return False

async def send_match_notifications(pool: Dict[str, Any], matches: List[Dict[str, Any]]) -> None:
    """
    Send match notifications to all matched users.

    Args:
        pool: The pool that was created
        matches: List of matched pool dictionaries
    """
    # Send notifications to the pool creator about matches
    for match in matches:
        try:
            await send_push_notification(
                pool["user_id"],
                "New UniPool match!",
                f"{match['user_name']} is also going {match['from_location']} → {match['to_location']}",
                "/(tabs)/matches"
            )
            await send_email_notification(
                pool["user_email"],
                "UniPool: New Match Found!",
                # This would use the match_email_html function from email_helper
                f"<html><body><p>New match found for your pool!</p></body></html>"  # Simplified for now
            )
        except Exception as e:
            logger.warning(f"Failed to send match notification to pool owner: {e}")

    # Send notifications to matched users about the new pool
    for match in matches:
        try:
            await send_push_notification(
                match["user_id"],
                "New UniPool match!",
                f"{pool['user_name']} is also going {pool['from_location']} → {pool['to_location']}",
                "/(tabs)/matches"
            )
            await send_email_notification(
                match["user_email"],
                "UniPool: New Match Found!",
                f"<html><body><p>New match found for your pool!</p></body></html>"  # Simplified for now
            )
        except Exception as e:
            logger.warning(f"Failed to send match notification to matched user: {e}")

# Leave soon reminder functionality would go here in a complete implementation
async def _leaving_soon_reminder_loop():
    """
    Background task to send reminders about pools leaving soon.
    This would run periodically to check for pools departing in the next 30 minutes.
    """
    # This is a simplified placeholder - in reality this would be a more complex
    # background task that queries for upcoming pools and sends reminders
    logger.info("Leave soon reminder loop started (placeholder)")
    while True:
        # In a real implementation:
        # 1. Query for pools leaving in the next 30 minutes
        # 2. Send reminders to users who have requested to join those pools
        # 3. Wait 5 minutes before checking again
        await asyncio.sleep(300)  # 5 minutes