"""Web Push helpers used by the UniPool trip lifecycle."""

import asyncio
import json
import logging
from typing import Any, Dict, Iterable

from pywebpush import webpush, WebPushException

from config.database import db
from config.settings import VAPID_PRIVATE_KEY, VAPID_SUBJECT

logger = logging.getLogger("unipool.push")


async def _deliver(subscription: Dict[str, Any], payload: str) -> bool:
    try:
        await asyncio.to_thread(
            webpush,
            subscription_info={
                "endpoint": subscription["endpoint"],
                "keys": subscription.get("keys") or {},
            },
            data=payload,
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims={"sub": VAPID_SUBJECT},
        )
        return True
    except WebPushException as exc:
        status = getattr(getattr(exc, "response", None), "status_code", None)
        if status in (404, 410):
            await db.push_subscriptions.delete_one({"endpoint": subscription.get("endpoint")})
        logger.warning("Web push failed (%s): %s", status, exc)
        return False
    except Exception as exc:
        logger.warning("Web push failed: %s", exc)
        return False


async def send_push(user_id: str, title: str, body: str, url: str = "/") -> bool:
    """Send one notification to every active browser subscription for a user."""
    if not VAPID_PRIVATE_KEY:
        logger.info("Push skipped: VAPID_PRIVATE_KEY is not configured")
        return False

    subscriptions = await db.push_subscriptions.find(
        {"user_id": user_id}, {"_id": 0}
    ).to_list(20)
    if not subscriptions:
        return False

    payload = json.dumps({"title": title, "body": body, "url": url})
    results = await asyncio.gather(*(_deliver(sub, payload) for sub in subscriptions))
    return any(results)


async def send_push_to_multiple(
    user_ids: Iterable[str], title: str, body: str, url: str = "/"
) -> Dict[str, int]:
    ids = list(dict.fromkeys(user_ids))
    results = await asyncio.gather(*(send_push(uid, title, body, url) for uid in ids))
    success = sum(1 for result in results if result)
    return {"success": success, "failure": len(ids) - success, "total": len(ids)}
