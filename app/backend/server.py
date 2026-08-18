from fastapi import FastAPI, APIRouter, HTTPException, Header, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from datetime import datetime, timezone, timedelta

import httpx
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# ---------- Config ----------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
RESEND_FROM_EMAIL = os.environ.get("RESEND_FROM_EMAIL", "onboarding@resend.dev")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "UniPool")

ADMIN_EMAILS = {
    e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()
}

VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY", "")
VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", "")
VAPID_SUBJECT = os.environ.get("VAPID_SUBJECT", "mailto:admin@unipool.app")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("unipool")

app = FastAPI(title="UniPool API")
api = APIRouter(prefix="/api")


# ---------- Models ----------
class SessionExchange(BaseModel):
    session_id: str


class UserOut(BaseModel):
    user_id: str
    email: EmailStr
    name: str
    picture: Optional[str] = None


class PoolRequestCreate(BaseModel):
    from_location: str
    to_location: str
    travel_datetime: datetime  # ISO8601
    gender_preference: str = "any"  # "any" | "same"
    companions: int = 0
    luggage: Optional[str] = None
    notes: Optional[str] = None


class PoolRequestUpdate(BaseModel):
    from_location: Optional[str] = None
    to_location: Optional[str] = None
    travel_datetime: Optional[datetime] = None
    gender_preference: Optional[str] = None
    companions: Optional[int] = None
    luggage: Optional[str] = None
    notes: Optional[str] = None


class MessageCreate(BaseModel):
    to_user_id: str
    pool_id: Optional[str] = None
    text: str


class MessageOut(BaseModel):
    message_id: str
    from_user_id: str
    to_user_id: str
    pool_id: Optional[str] = None
    text: str
    created_at: datetime
    read: bool = False


class PushSubscribe(BaseModel):
    endpoint: str
    keys: dict


class PoolRequestOut(BaseModel):
    pool_id: str
    user_id: str
    user_name: str
    user_email: EmailStr
    user_gender: Optional[str] = None
    from_location: str
    to_location: str
    travel_datetime: datetime
    gender_preference: str
    companions: int
    luggage: Optional[str] = None
    notes: Optional[str] = None
    status: str = "open"
    created_at: datetime
    user_rating_avg: Optional[float] = None
    user_rating_count: int = 0


class ProfileUpdate(BaseModel):
    gender: Optional[str] = None  # "male" | "female" | "other"
    phone: Optional[str] = None


class ScoreSubmit(BaseModel):
    game: str
    score: int


class RatingCreate(BaseModel):
    rated_user_id: str
    stars: int
    comment: Optional[str] = None
    pool_id: Optional[str] = None


# ---------- Helpers ----------
def _clean(doc: dict) -> dict:
    if not doc:
        return doc
    doc.pop("_id", None)
    return doc


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _is_admin(email: str) -> bool:
    return (email or "").lower() in ADMIN_EMAILS


def _with_admin_flag(user: dict) -> dict:
    if user:
        user["is_admin"] = _is_admin(user.get("email", ""))
    return user


def _ensure_aware(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


ONLINE_THRESHOLD_SECONDS = 60


def _is_online(last_seen: Optional[datetime]) -> bool:
    if not last_seen:
        return False
    return (_now_utc() - _ensure_aware(last_seen)).total_seconds() < ONLINE_THRESHOLD_SECONDS


# In-memory "is typing" state: {(from_user_id, to_user_id): last_ping_at}.
# Ephemeral by design — a restart clearing it is harmless, and it avoids
# writing throwaway data to Mongo on every keystroke.
TYPING_STATE: dict = {}
TYPING_TTL_SECONDS = 4


async def _enrich_with_ratings(pools: list) -> list:
    """Batch-attach user_rating_avg/user_rating_count to a list of pool dicts."""
    if not pools:
        return pools
    user_ids = list({p["user_id"] for p in pools})
    pipeline = [
        {"$match": {"rated_user_id": {"$in": user_ids}}},
        {"$group": {"_id": "$rated_user_id", "avg": {"$avg": "$stars"}, "count": {"$sum": 1}}},
    ]
    stats = await db.ratings.aggregate(pipeline).to_list(len(user_ids))
    stat_map = {s["_id"]: s for s in stats}
    for p in pools:
        s = stat_map.get(p["user_id"])
        p["user_rating_avg"] = round(s["avg"], 1) if s else None
        p["user_rating_count"] = s["count"] if s else 0
    return pools


async def _touch_last_seen(user_id: str) -> None:
    try:
        await db.users.update_one({"user_id": user_id}, {"$set": {"last_seen": _now_utc()}})
    except Exception as e:
        logger.warning(f"Failed to update last_seen for {user_id}: {e}")


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    exp = _ensure_aware(session["expires_at"])
    if exp < _now_utc():
        raise HTTPException(status_code=401, detail="Session expired")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    # Implicit presence heartbeat — every authenticated call (chat polling,
    # feed refreshes, etc.) counts as "active", so no dedicated heartbeat
    # endpoint is needed. Fire-and-forget so it never slows the response.
    # NOTE: must wrap in a real `async def` coroutine — passing a Motor
    # awaitable straight into asyncio.create_task() can raise
    # "TypeError: a coroutine was expected, got <Future ...>" depending on
    # the event loop, which took down every authenticated endpoint.
    asyncio.create_task(_touch_last_seen(user["user_id"]))
    return _with_admin_flag(user)


# ---------- Email ----------
async def send_email(to_email: str, subject: str, html_content: str) -> bool:
    if not RESEND_API_KEY:
        logger.warning("RESEND_API_KEY missing — skipping email send")
        return False
    payload = {
        "from": f"{EMAIL_FROM_NAME} <{RESEND_FROM_EMAIL}>",
        "to": [to_email],
        "subject": subject,
        "html": html_content,
    }
    try:
        async with httpx.AsyncClient(timeout=30) as http:
            resp = await http.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
                json=payload,
            )
        resp.raise_for_status()
        return True
    except Exception as e:
        logger.error(f"Email send failed to {to_email}: {e}")
        return False


async def send_push(user_id: str, title: str, body: str, url: str = "/") -> None:
    if not (VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY):
        return
    subs = await db.push_subscriptions.find({"user_id": user_id}, {"_id": 0}).to_list(10)
    if not subs:
        return
    from pywebpush import webpush, WebPushException
    import json as _json

    payload = _json.dumps({"title": title, "body": body, "url": url})
    for sub in subs:
        try:
            webpush(
                subscription_info={"endpoint": sub["endpoint"], "keys": sub["keys"]},
                data=payload,
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims={"sub": VAPID_SUBJECT},
            )
        except WebPushException as e:
            logger.warning(f"Push failed for {user_id}: {e}")
            if "410" in str(e) or "404" in str(e):
                await db.push_subscriptions.delete_one({"endpoint": sub["endpoint"]})
        except Exception as e:
            logger.warning(f"Push error for {user_id}: {e}")


def match_email_html(recipient_name: str, match: dict, own: dict) -> str:
    return f"""
    <html><body style="font-family:Arial,sans-serif;background:#FFF9F2;padding:24px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08);">
        <tr><td style="background:#1A237E;padding:20px 24px;color:#FFECC2;">
          <div style="font-size:22px;font-weight:700;color:#FF9933;">UniPool</div>
          <div style="font-size:14px;opacity:0.9;">A fellow traveller matched your route</div>
        </td></tr>
        <tr><td style="padding:24px;color:#1C1917;">
          <p>Namaste {recipient_name},</p>
          <p>Good news — someone on UniPool just posted a cab-pool request that overlaps with yours within a 1-hour window.</p>
          <table cellpadding="8" cellspacing="0" style="background:#FFECC2;border-radius:12px;width:100%;margin:12px 0;">
            <tr><td><b>{match['user_name']}</b><br/>{match['from_location']} → {match['to_location']}<br/>
            <span style="color:#B05C00;">{_ensure_aware(match['travel_datetime']).strftime('%d %b %Y, %I:%M %p UTC')}</span><br/>
            Reply to: <a href="mailto:{match['user_email']}">{match['user_email']}</a></td></tr>
          </table>
          <p style="color:#3D352F;font-size:13px;">Your request: {own['from_location']} → {own['to_location']} at {_ensure_aware(own['travel_datetime']).strftime('%d %b %Y, %I:%M %p UTC')}</p>
          <p>Reach out and split the fare. Safe travels!</p>
          <p style="color:#B05C00;font-weight:600;">— Team UniPool</p>
        </td></tr>
      </table>
    </body></html>
    """


async def find_and_notify_matches(new_pool: dict):
    """Find pool requests overlapping ±1h on the same route and email both users."""
    travel_dt = _ensure_aware(new_pool["travel_datetime"])
    window = timedelta(hours=1)
    cursor = db.pools.find(
        {
            "pool_id": {"$ne": new_pool["pool_id"]},
            "user_id": {"$ne": new_pool["user_id"]},
            "status": "open",
            "from_location": {"$regex": f"^{new_pool['from_location']}$", "$options": "i"},
            "to_location": {"$regex": f"^{new_pool['to_location']}$", "$options": "i"},
            "travel_datetime": {
                "$gte": travel_dt - window,
                "$lte": travel_dt + window,
            },
        },
        {"_id": 0},
    )
    matches = await cursor.to_list(50)
    for m in matches:
        # Gender preference filter
        if new_pool.get("gender_preference") == "same" or m.get("gender_preference") == "same":
            if (new_pool.get("user_gender") or "").lower() != (m.get("user_gender") or "").lower():
                continue

        # Notify the newly-posted user
        html_new = match_email_html(new_pool["user_name"], m, new_pool)
        # Notify the previously-posted user
        html_old = match_email_html(m["user_name"], new_pool, m)

        await asyncio.gather(
            send_email(new_pool["user_email"], "UniPool: A matching cab-pool request!", html_new),
            send_email(m["user_email"], "UniPool: A matching cab-pool request!", html_old),
            send_push(new_pool["user_id"], "New UniPool match!", f"{m['user_name']} is also going {m['from_location']} → {m['to_location']}", "/(tabs)/matches"),
            send_push(m["user_id"], "New UniPool match!", f"{new_pool['user_name']} is also going {new_pool['from_location']} → {new_pool['to_location']}", "/(tabs)/matches"),
            return_exceptions=True,
        )


# ---------- Auth Routes ----------
class GoogleSignIn(BaseModel):
    id_token: str


async def _create_session_for_user(email: str, name: str, picture: Optional[str]) -> dict:
    """Shared logic: upsert the user, mint a session token, return {session_token, user}."""
    existing_user = await db.users.find_one({"email": email}, {"_id": 0})
    if existing_user:
        user_id = existing_user["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": name, "picture": picture, "last_login": _now_utc()}},
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one(
            {
                "user_id": user_id,
                "email": email,
                "name": name,
                "picture": picture,
                "gender": None,
                "phone": None,
                "created_at": _now_utc(),
                "last_login": _now_utc(),
            }
        )

    session_token = uuid.uuid4().hex
    await db.user_sessions.insert_one(
        {
            "session_token": session_token,
            "user_id": user_id,
            "expires_at": _now_utc() + timedelta(days=7),
            "created_at": _now_utc(),
        }
    )
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"session_token": session_token, "user": _with_admin_flag(user_doc)}


@api.post("/auth/google")
async def google_sign_in(body: GoogleSignIn):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Server missing GOOGLE_CLIENT_ID")
    try:
        idinfo = google_id_token.verify_oauth2_token(
            body.id_token, google_requests.Request(), GOOGLE_CLIENT_ID
        )
    except Exception as e:
        logger.warning(f"Google token verification failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid Google token")

    email = idinfo.get("email")
    if not email or not idinfo.get("email_verified", False):
        raise HTTPException(status_code=401, detail="Google email not verified")
    name = idinfo.get("name") or email.split("@")[0]
    picture = idinfo.get("picture")

    return await _create_session_for_user(email, name, picture)


@api.get("/auth/me")
async def me(user=None, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    return user


@api.post("/auth/logout")
async def logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}


@api.patch("/profile")
async def update_profile(body: ProfileUpdate, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    updates = {k: v for k, v in body.dict().items() if v is not None}
    if updates:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": updates})
    updated = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return updated


# ---------- Pool Routes ----------
MAX_OPEN_POOLS_PER_USER = 5
MAX_POOLS_PER_HOUR = 10


@api.post("/pools", response_model=PoolRequestOut)
async def create_pool(body: PoolRequestCreate, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)

    open_count = await db.pools.count_documents({"user_id": user["user_id"], "status": "open"})
    if open_count >= MAX_OPEN_POOLS_PER_USER:
        raise HTTPException(
            status_code=429,
            detail=f"You already have {MAX_OPEN_POOLS_PER_USER} open queries. Close one before posting a new one.",
        )

    recent_count = await db.pools.count_documents(
        {"user_id": user["user_id"], "created_at": {"$gte": _now_utc() - timedelta(hours=1)}}
    )
    if recent_count >= MAX_POOLS_PER_HOUR:
        raise HTTPException(
            status_code=429,
            detail="You're posting too fast. Please wait a bit before posting again.",
        )

    pool_id = f"pool_{uuid.uuid4().hex[:12]}"
    doc = {
        "pool_id": pool_id,
        "user_id": user["user_id"],
        "user_name": user.get("name") or "Traveller",
        "user_email": user["email"],
        "user_gender": user.get("gender"),
        "from_location": body.from_location.strip(),
        "to_location": body.to_location.strip(),
        "travel_datetime": _ensure_aware(body.travel_datetime),
        "gender_preference": body.gender_preference,
        "companions": body.companions,
        "luggage": body.luggage,
        "notes": body.notes,
        "status": "open",
        "created_at": _now_utc(),
    }
    await db.pools.insert_one(doc)
    # Fire-and-forget notify
    asyncio.create_task(find_and_notify_matches({**doc}))
    return _clean(dict(doc))


@api.get("/pools", response_model=List[PoolRequestOut])
async def list_pools(authorization: Optional[str] = Header(None)):
    await get_current_user(authorization)
    now = _now_utc()
    cursor = db.pools.find(
        {"travel_datetime": {"$gte": now - timedelta(hours=2)}, "status": "open"},
        {"_id": 0},
    ).sort("travel_datetime", 1)
    results = await cursor.to_list(200)
    return await _enrich_with_ratings(results)


@api.get("/pools/mine", response_model=List[PoolRequestOut])
async def my_pools(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    cursor = db.pools.find({"user_id": user["user_id"]}, {"_id": 0}).sort("travel_datetime", -1)
    results = await cursor.to_list(200)
    return await _enrich_with_ratings(results)


@api.patch("/pools/{pool_id}/close", response_model=PoolRequestOut)
async def close_pool(pool_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    r = await db.pools.update_one(
        {"pool_id": pool_id, "user_id": user["user_id"]}, {"$set": {"status": "closed"}}
    )
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return _clean(await db.pools.find_one({"pool_id": pool_id}, {"_id": 0}))


@api.patch("/pools/{pool_id}/reopen", response_model=PoolRequestOut)
async def reopen_pool(pool_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    r = await db.pools.update_one(
        {"pool_id": pool_id, "user_id": user["user_id"]}, {"$set": {"status": "open"}}
    )
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return _clean(await db.pools.find_one({"pool_id": pool_id}, {"_id": 0}))


@api.patch("/pools/{pool_id}", response_model=PoolRequestOut)
async def update_pool(pool_id: str, body: PoolRequestUpdate, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    updates = {k: v for k, v in body.dict(exclude_unset=True).items() if v is not None}
    if not updates:
        existing = await db.pools.find_one({"pool_id": pool_id, "user_id": user["user_id"]}, {"_id": 0})
        if not existing:
            raise HTTPException(status_code=404, detail="Not found")
        return _clean(existing)
    r = await db.pools.update_one(
        {"pool_id": pool_id, "user_id": user["user_id"]}, {"$set": updates}
    )
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return _clean(await db.pools.find_one({"pool_id": pool_id}, {"_id": 0}))


@api.get("/pools/matches", response_model=List[PoolRequestOut])
async def my_matches(authorization: Optional[str] = Header(None)):
    """All pools that overlap +-1h with any of my own pools on the same route."""
    user = await get_current_user(authorization)
    my = await db.pools.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(100)
    if not my:
        return []
    results: dict = {}
    for own in my:
        if own.get("status") != "open":
            continue
        dt = _ensure_aware(own["travel_datetime"])
        cursor = db.pools.find(
            {
                "user_id": {"$ne": user["user_id"]},
                "status": "open",
                "from_location": {"$regex": f"^{own['from_location']}$", "$options": "i"},
                "to_location": {"$regex": f"^{own['to_location']}$", "$options": "i"},
                "travel_datetime": {
                    "$gte": dt - timedelta(hours=1),
                    "$lte": dt + timedelta(hours=1),
                },
            },
            {"_id": 0},
        )
        for m in await cursor.to_list(100):
            results[m["pool_id"]] = m
    return await _enrich_with_ratings(list(results.values()))


@api.delete("/pools/{pool_id}")
async def delete_pool(pool_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    r = await db.pools.delete_one({"pool_id": pool_id, "user_id": user["user_id"]})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


# ---------- Push ----------
@api.get("/push/vapid-public-key")
async def vapid_public_key():
    return {"key": VAPID_PUBLIC_KEY}


@api.post("/push/subscribe")
async def push_subscribe(body: PushSubscribe, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    await db.push_subscriptions.update_one(
        {"endpoint": body.endpoint},
        {"$set": {"user_id": user["user_id"], "endpoint": body.endpoint, "keys": body.keys, "created_at": _now_utc()}},
        upsert=True,
    )
    return {"ok": True}


@api.post("/push/unsubscribe")
async def push_unsubscribe(body: dict, authorization: Optional[str] = Header(None)):
    await get_current_user(authorization)
    endpoint = body.get("endpoint")
    if endpoint:
        await db.push_subscriptions.delete_one({"endpoint": endpoint})
    return {"ok": True}


# ---------- Messaging ----------
@api.post("/messages", response_model=MessageOut)
async def send_message(body: MessageCreate, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    if not body.text.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    recent_msgs = await db.messages.count_documents(
        {"from_user_id": user["user_id"], "created_at": {"$gte": _now_utc() - timedelta(minutes=1)}}
    )
    if recent_msgs >= 30:
        raise HTTPException(status_code=429, detail="You're sending messages too fast. Slow down a bit.")

    to_user = await db.users.find_one({"user_id": body.to_user_id}, {"_id": 0})
    if not to_user:
        raise HTTPException(status_code=404, detail="Recipient not found")
    doc = {
        "message_id": f"msg_{uuid.uuid4().hex[:12]}",
        "from_user_id": user["user_id"],
        "to_user_id": body.to_user_id,
        "pool_id": body.pool_id,
        "text": body.text.strip()[:2000],
        "created_at": _now_utc(),
        "read": False,
    }
    await db.messages.insert_one(doc)
    asyncio.create_task(send_push(
        body.to_user_id,
        f"New message from {user['name']}",
        doc["text"][:100],
        "/(tabs)/messages",
    ))
    return _clean(dict(doc))


@api.get("/messages/thread/{other_user_id}", response_model=List[MessageOut])
async def get_thread(other_user_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    cursor = db.messages.find(
        {
            "$or": [
                {"from_user_id": user["user_id"], "to_user_id": other_user_id},
                {"from_user_id": other_user_id, "to_user_id": user["user_id"]},
            ]
        },
        {"_id": 0},
    ).sort("created_at", 1)
    msgs = await cursor.to_list(500)
    await db.messages.update_many(
        {"from_user_id": other_user_id, "to_user_id": user["user_id"], "read": False},
        {"$set": {"read": True}},
    )
    return msgs


@api.get("/messages/conversations")
async def list_conversations(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    uid = user["user_id"]
    cursor = db.messages.find(
        {"$or": [{"from_user_id": uid}, {"to_user_id": uid}]}, {"_id": 0}
    ).sort("created_at", -1)
    msgs = await cursor.to_list(1000)
    seen: dict = {}
    for m in msgs:
        other = m["to_user_id"] if m["from_user_id"] == uid else m["from_user_id"]
        if other not in seen:
            unread = 1 if (m["to_user_id"] == uid and not m["read"]) else 0
            seen[other] = {"other_user_id": other, "last_message": m["text"], "last_at": m["created_at"], "unread": unread}
        elif m["to_user_id"] == uid and not m["read"]:
            seen[other]["unread"] += 1

    others = list(seen.keys())
    if not others:
        return []
    users = await db.users.find({"user_id": {"$in": others}}, {"_id": 0}).to_list(len(others))
    umap = {u["user_id"]: u for u in users}
    out = []
    for other_id, convo in seen.items():
        u = umap.get(other_id, {})
        out.append({
            **convo,
            "name": u.get("name", "Unknown"),
            "picture": u.get("picture"),
            "online": _is_online(u.get("last_seen")),
        })
    return out


@api.post("/messages/typing")
async def send_typing(body: dict, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    to_user_id = body.get("to_user_id")
    if to_user_id:
        TYPING_STATE[(user["user_id"], to_user_id)] = _now_utc()
    return {"ok": True}


@api.get("/messages/typing/{other_user_id}")
async def get_typing(other_user_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    ts = TYPING_STATE.get((other_user_id, user["user_id"]))
    typing = bool(ts and (_now_utc() - ts).total_seconds() < TYPING_TTL_SECONDS)
    return {"typing": typing}


@api.get("/users/{user_id}/presence")
async def get_presence(user_id: str, authorization: Optional[str] = Header(None)):
    await get_current_user(authorization)
    u = await db.users.find_one({"user_id": user_id}, {"_id": 0, "last_seen": 1})
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    return {"online": _is_online(u.get("last_seen")), "last_seen": u.get("last_seen")}


# ---------- Ratings ----------
@api.post("/ratings")
async def submit_rating(body: RatingCreate, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    if body.rated_user_id == user["user_id"]:
        raise HTTPException(status_code=400, detail="You can't rate yourself")
    if not (1 <= body.stars <= 5):
        raise HTTPException(status_code=400, detail="Stars must be between 1 and 5")
    rated_user = await db.users.find_one({"user_id": body.rated_user_id}, {"_id": 0})
    if not rated_user:
        raise HTTPException(status_code=404, detail="User not found")

    # One rating per (rater, rated) pair — resubmitting updates it.
    await db.ratings.update_one(
        {"rater_user_id": user["user_id"], "rated_user_id": body.rated_user_id},
        {"$set": {
            "rater_user_id": user["user_id"],
            "rater_name": user["name"],
            "rated_user_id": body.rated_user_id,
            "stars": body.stars,
            "comment": (body.comment or "").strip()[:500] or None,
            "pool_id": body.pool_id,
            "created_at": _now_utc(),
        }},
        upsert=True,
    )
    pipeline = [
        {"$match": {"rated_user_id": body.rated_user_id}},
        {"$group": {"_id": None, "avg": {"$avg": "$stars"}, "count": {"$sum": 1}}},
    ]
    stats = await db.ratings.aggregate(pipeline).to_list(1)
    s = stats[0] if stats else {"avg": body.stars, "count": 1}
    return {"ok": True, "user_rating_avg": round(s["avg"], 1), "user_rating_count": s["count"]}


@api.get("/ratings/user/{user_id}")
async def get_user_ratings(user_id: str, authorization: Optional[str] = Header(None)):
    await get_current_user(authorization)
    cursor = db.ratings.find({"rated_user_id": user_id}, {"_id": 0}).sort("created_at", -1)
    ratings = await cursor.to_list(100)
    avg = round(sum(r["stars"] for r in ratings) / len(ratings), 1) if ratings else None
    return {"average": avg, "count": len(ratings), "ratings": ratings}


@api.get("/ratings/can-rate/{user_id}")
async def can_rate(user_id: str, authorization: Optional[str] = Header(None)):
    """Whether the current user has already rated this user, and their existing rating if so."""
    user = await get_current_user(authorization)
    existing = await db.ratings.find_one(
        {"rater_user_id": user["user_id"], "rated_user_id": user_id}, {"_id": 0}
    )
    return {"already_rated": existing is not None, "existing": existing}


# ---------- Admin ----------
async def require_admin(authorization: Optional[str] = Header(None)) -> dict:
    user = await get_current_user(authorization)
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


@api.get("/admin/stats")
async def admin_stats(user=None, authorization: Optional[str] = Header(None)):
    await require_admin(authorization)
    total_users = await db.users.count_documents({})
    total_pools = await db.pools.count_documents({})
    open_pools = await db.pools.count_documents({"status": "open"})
    closed_pools = await db.pools.count_documents({"status": "closed"})
    return {
        "total_users": total_users,
        "total_pools": total_pools,
        "open_pools": open_pools,
        "closed_pools": closed_pools,
    }


@api.get("/admin/pools", response_model=List[PoolRequestOut])
async def admin_list_pools(authorization: Optional[str] = Header(None)):
    await require_admin(authorization)
    cursor = db.pools.find({}, {"_id": 0}).sort("created_at", -1)
    return await cursor.to_list(500)


@api.delete("/admin/pools/{pool_id}")
async def admin_delete_pool(pool_id: str, authorization: Optional[str] = Header(None)):
    await require_admin(authorization)
    r = await db.pools.delete_one({"pool_id": pool_id})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


# ---------- Game Leaderboards ----------
ALLOWED_GAMES = {"tap-plane", "memory-match", "word-scramble", "rickshaw-rush", "trivia"}
# For these games a LOWER score is better (e.g. fewer moves). Everything
# else defaults to higher-is-better.
LOWER_IS_BETTER = {"memory-match"}


@api.post("/games/score")
async def submit_score(body: ScoreSubmit, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    if body.game not in ALLOWED_GAMES:
        raise HTTPException(status_code=400, detail="Unknown game")
    doc = {
        "score_id": f"score_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "user_name": user["name"],
        "game": body.game,
        "score": body.score,
        "created_at": _now_utc(),
    }
    await db.game_scores.insert_one(doc)

    # Return the user's rank on this game's leaderboard so the UI can
    # show "You're #3!" style feedback immediately.
    ascending = body.game in LOWER_IS_BETTER
    board = await _leaderboard_for(body.game, limit=1000)
    rank = next((i + 1 for i, r in enumerate(board) if r["user_id"] == user["user_id"]), None)
    return {"ok": True, "rank": rank, "total_players": len(board)}


async def _leaderboard_for(game: str, limit: int = 20) -> list:
    ascending = game in LOWER_IS_BETTER
    pipeline = [
        {"$match": {"game": game}},
        {"$sort": {"score": 1 if ascending else -1, "created_at": 1}},
        {"$group": {
            "_id": "$user_id",
            "user_name": {"$first": "$user_name"},
            "score": {"$first": "$score"},
            "created_at": {"$first": "$created_at"},
        }},
        {"$sort": {"score": 1 if ascending else -1}},
        {"$limit": limit},
    ]
    results = await db.game_scores.aggregate(pipeline).to_list(limit)
    return [
        {"user_id": r["_id"], "user_name": r["user_name"], "score": r["score"]}
        for r in results
    ]


@api.get("/games/leaderboard/{game}")
async def leaderboard(game: str, authorization: Optional[str] = Header(None)):
    if game not in ALLOWED_GAMES:
        raise HTTPException(status_code=404, detail="Unknown game")
    user = None
    try:
        user = await get_current_user(authorization)
    except HTTPException:
        pass
    board = await _leaderboard_for(game, limit=20)
    my_best = None
    if user:
        ascending = game in LOWER_IS_BETTER
        cursor = db.game_scores.find(
            {"game": game, "user_id": user["user_id"]}, {"_id": 0}
        ).sort("score", 1 if ascending else -1).limit(1)
        mine = await cursor.to_list(1)
        if mine:
            my_best = mine[0]["score"]
    return {"entries": board, "my_best": my_best, "ascending": game in LOWER_IS_BETTER}


# ---------- Trivia ----------
TRIVIA_QUESTIONS = [
    {"q": "The Konkan Railway hugs which coast of India?", "options": ["East Coast", "West Coast", "Northern Plains", "Deccan Plateau"], "answer": 1},
    {"q": "Which is India's busiest railway station by footfall?", "options": ["Howrah Junction", "Chhatrapati Shivaji Terminus", "New Delhi", "Mumbai Central"], "answer": 0},
    {"q": "The 'Palace on Wheels' luxury train serves which state primarily?", "options": ["Kerala", "Rajasthan", "Assam", "Goa"], "answer": 1},
    {"q": "Bengaluru's airport is named after which figure?", "options": ["Rajiv Gandhi", "Kempegowda", "Sardar Patel", "Chhatrapati Shivaji"], "answer": 1},
    {"q": "Which city hosts India's first metro rail system?", "options": ["Delhi", "Mumbai", "Kolkata", "Chennai"], "answer": 2},
    {"q": "The Vande Bharat Express is what kind of train?", "options": ["Steam", "Diesel", "Semi-high-speed electric", "Maglev"], "answer": 2},
    {"q": "India's highest railway bridge (Chenab Bridge) is in?", "options": ["Uttarakhand", "Himachal Pradesh", "Jammu & Kashmir", "Sikkim"], "answer": 2},
    {"q": "'Nilgiri Mountain Railway' toy train serves?", "options": ["Darjeeling", "Ooty", "Shimla", "Matheran"], "answer": 1},
    {"q": "Which is India's national aircraft carrier port?", "options": ["Kochi", "Visakhapatnam", "Mumbai", "Karwar"], "answer": 0},
    {"q": "Which airline is India's flag carrier?", "options": ["IndiGo", "Air India", "SpiceJet", "Vistara"], "answer": 1},
]


@api.get("/trivia")
async def trivia():
    import random
    qs = random.sample(TRIVIA_QUESTIONS, k=min(5, len(TRIVIA_QUESTIONS)))
    return qs


# ---------- Root ----------
@api.get("/")
async def root():
    return {"app": "UniPool", "status": "ok"}


# ---------- Wire up ----------
app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def _startup():
    try:
        await db.users.create_index("email", unique=True)
        await db.users.create_index("user_id", unique=True)
        await db.user_sessions.create_index("session_token", unique=True)
        await db.user_sessions.create_index("user_id")
        await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
        await db.pools.create_index("pool_id", unique=True)
        await db.pools.create_index([("from_location", 1), ("to_location", 1), ("travel_datetime", 1)])
        logger.info("Indexes created")
    except Exception as e:
        logger.warning(f"Index setup issue: {e}")


@app.on_event("shutdown")
async def _shutdown():
    client.close()
