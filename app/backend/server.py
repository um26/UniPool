from fastapi import FastAPI, APIRouter, HTTPException, Header, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import re
import secrets
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from datetime import datetime, timezone, timedelta

import httpx
import bcrypt
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
GMAIL_ADDRESS = os.environ.get("GMAIL_ADDRESS", "")
GMAIL_APP_PASSWORD = os.environ.get("GMAIL_APP_PASSWORD", "")
SENDGRID_API_KEY = os.environ.get("SENDGRID_API_KEY", "")
SENDGRID_FROM_EMAIL = os.environ.get("SENDGRID_FROM_EMAIL", GMAIL_ADDRESS)
TURNSTILE_SECRET_KEY = os.environ.get("TURNSTILE_SECRET_KEY", "")

ADMIN_EMAILS = {
    e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()
}

# Domains that auto-grant the "Verified Student" badge. Generic Indian/global
# academic suffixes are trusted by default; ADD your specific college domain
# via the VERIFIED_EMAIL_DOMAINS env var (comma-separated, e.g. "mycollege.ac.in").
DEFAULT_VERIFIED_SUFFIXES = (".edu", ".edu.in", ".ac.in")
VERIFIED_EMAIL_DOMAINS = {
    d.strip().lower() for d in os.environ.get("VERIFIED_EMAIL_DOMAINS", "").split(",") if d.strip()
}


def _is_verified_domain(email: str) -> bool:
    email = (email or "").lower()
    if "@" not in email:
        return False
    domain = email.split("@", 1)[1]
    if domain in VERIFIED_EMAIL_DOMAINS:
        return True
    return any(email.endswith(suffix) for suffix in DEFAULT_VERIFIED_SUFFIXES)


# ---------- College ID verification & roll-number decoding ----------
# Mahindra University roll numbers embed structured info in the email's
# local part, e.g. "se22ucam015@mahindrauniversity.edu.in":
#   se   -> school            (2 letters)
#   22   -> joining year      (2 digits, batch = 2000 + yy)
#   u    -> degree level      (1 letter: u/m/p)
#   cam  -> branch            (variable-length letters)
#   015  -> serial number     (3 digits)
# These maps are intentionally easy to extend — send more codes any time.
COLLEGE_EMAIL_DOMAIN = "mahindrauniversity.edu.in"
ROLL_NUMBER_RE = re.compile(r"^([a-z]{2})(\d{2})([ump])([a-z]+)(\d{3})$")
SCHOOL_CODES = {"se": "School of Engineering", "sm": "School of Management", "sl": "School of Law"}
DEGREE_LEVEL_NAMES = {"u": "Undergraduate", "m": "Masters", "p": "PhD"}
BRANCH_CODES = {
    "cam": "Computer Science & Applied Mathematics",
    "cse": "Computer Science",
    "ece": "Electronics & Communication",
    "ari": "Artificial Intelligence",
    "cie": "Civil Engineering",
}


def _decode_roll_number(local_part: str) -> Optional[dict]:
    m = ROLL_NUMBER_RE.match(local_part.lower())
    if not m:
        return None
    school_code, yy, degree_code, branch_code, serial = m.groups()
    return {
        "roll_number": local_part.upper(),
        "school_code": school_code.upper(),
        "school_name": SCHOOL_CODES.get(school_code, school_code.upper()),
        "batch_year": 2000 + int(yy),
        "degree_level_code": degree_code.upper(),
        "degree_level_name": DEGREE_LEVEL_NAMES.get(degree_code, degree_code.upper()),
        "branch_code": branch_code.upper(),
        "branch_name": BRANCH_CODES.get(branch_code, branch_code.upper()),
        "serial": serial,
    }


async def _college_info_map(user_ids: list) -> dict:
    """Batch-fetch verified college-ID info for a set of user_ids."""
    if not user_ids:
        return {}
    cursor = db.users.find(
        {"user_id": {"$in": user_ids}, "college_verified": True},
        {"_id": 0, "user_id": 1, "roll_number": 1, "school_name": 1, "degree_level_name": 1, "branch_name": 1, "batch_year": 1},
    )
    return {u["user_id"]: u async for u in cursor}


def _compute_badges(college_verified: bool, rating_avg: Optional[float], rating_count: int, rides_completed: int) -> List[dict]:
    badges = []
    if college_verified:
        badges.append({"id": "verified", "label": "Verified Student", "icon": "shield-checkmark"})
    if rating_avg is not None and rating_avg >= 8.5 and rating_count >= 3:
        badges.append({"id": "top_rated", "label": "Top Rated", "icon": "trophy"})
    if rides_completed >= 5:
        badges.append({"id": "frequent", "label": "Frequent Traveller", "icon": "flame"})
    return badges


async def _rides_completed_map(user_ids: list) -> dict:
    """How many confirmed ride-pairings each user has been part of, whether
    as the pool owner or as an accepted traveler — used for the 'Frequent
    Traveller' badge."""
    if not user_ids:
        return {}
    as_requester = await db.join_requests.aggregate([
        {"$match": {"requester_id": {"$in": user_ids}, "status": "accepted"}},
        {"$group": {"_id": "$requester_id", "c": {"$sum": 1}}},
    ]).to_list(len(user_ids))
    as_owner = await db.pools.aggregate([
        {"$match": {"user_id": {"$in": user_ids}, "confirmed_travelers.0": {"$exists": True}}},
        {"$project": {"user_id": 1, "n": {"$size": "$confirmed_travelers"}}},
        {"$group": {"_id": "$user_id", "c": {"$sum": "$n"}}},
    ]).to_list(len(user_ids))
    counts: dict = {}
    for row in as_requester + as_owner:
        counts[row["_id"]] = counts.get(row["_id"], 0) + row["c"]
    return counts


async def _attach_badges(items: list, id_field: str, email_field: str, avg_field: str, count_field: str, out_field: str, roll_field: Optional[str] = None) -> list:
    """Batch-attach a 'badges' list (and optionally verified college-ID info)
    to each dict in items, using rating stats already present on that dict
    plus a fresh rides-completed + college-verification lookup."""
    if not items:
        return items
    user_ids = list({it[id_field] for it in items if it.get(id_field)})
    rides_map = await _rides_completed_map(user_ids)
    college_map = await _college_info_map(user_ids)
    for it in items:
        uid = it.get(id_field)
        info = college_map.get(uid)
        it[out_field] = _compute_badges(
            info is not None, it.get(avg_field), it.get(count_field) or 0, rides_map.get(uid, 0)
        )
        if roll_field:
            it[roll_field] = info
    return items

# Seeded username/password admin account — created on startup if missing.
SEED_ADMIN_USERNAME = "BBadmin"
SEED_ADMIN_PASSWORD = "BB@unipool123"
SEED_ADMIN_EMAIL = "bbadmin@unipool.internal"

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


class ConfirmedTraveler(BaseModel):
    user_id: str
    name: str
    email: EmailStr


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
    user_badges: List[dict] = []
    user_college_id: Optional[dict] = None
    confirmed_travelers: List[ConfirmedTraveler] = []
    my_request_status: Optional[str] = None  # "pending" | "accepted" | "declined" | None


class JoinRequestOut(BaseModel):
    request_id: str
    pool_id: str
    pool_owner_id: str
    from_location: str
    to_location: str
    travel_datetime: datetime
    requester_id: str
    requester_name: str
    requester_email: EmailStr
    requester_gender: Optional[str] = None
    requester_rating_avg: Optional[float] = None
    requester_rating_count: int = 0
    requester_badges: List[dict] = []
    requester_college_id: Optional[dict] = None
    status: str = "pending"
    created_at: datetime
    responded_at: Optional[datetime] = None


class ProfileUpdate(BaseModel):
    gender: Optional[str] = None  # "male" | "female" | "other"
    phone: Optional[str] = None


class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    username: Optional[str] = None
    turnstile_token: Optional[str] = None


class LoginRequest(BaseModel):
    identifier: str  # email or username
    password: str
    turnstile_token: Optional[str] = None


class ScoreSubmit(BaseModel):
    game: str
    score: int


class RatingCreate(BaseModel):
    rated_user_id: str
    stars: int
    comment: Optional[str] = None
    pool_id: Optional[str] = None


class ReportCreate(BaseModel):
    reported_user_id: str
    reason: str  # short category, e.g. "no-show", "unsafe", "harassment", "spam", "other"
    details: Optional[str] = None
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
        user["is_admin"] = _is_admin(user.get("email", "")) or bool(user.get("is_admin_override"))
    return user


def _ensure_aware(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


IST = timezone(timedelta(hours=5, minutes=30))


def _fmt_ist(dt: datetime) -> str:
    """Format a stored (UTC) datetime as an IST wall-clock string for emails —
    all UniPool users are in India, so times should never surface as UTC."""
    return _ensure_aware(dt).astimezone(IST).strftime("%d %b %Y, %I:%M %p IST")


async def _blocked_user_ids(user_id: str) -> set:
    """Everyone blocked in EITHER direction relative to this user — used to
    hide their pools from the feed and prevent messaging/requests."""
    cursor = db.blocks.find(
        {"$or": [{"blocker_id": user_id}, {"blocked_id": user_id}]}, {"_id": 0}
    )
    pairs = await cursor.to_list(2000)
    ids = set()
    for p in pairs:
        ids.add(p["blocked_id"] if p["blocker_id"] == user_id else p["blocker_id"])
    return ids


async def _is_blocked_pair(user_a: str, user_b: str) -> bool:
    doc = await db.blocks.find_one(
        {"$or": [
            {"blocker_id": user_a, "blocked_id": user_b},
            {"blocker_id": user_b, "blocked_id": user_a},
        ]},
        {"_id": 0},
    )
    return doc is not None


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
    return await _attach_badges(pools, "user_id", "user_email", "user_rating_avg", "user_rating_count", "user_badges", "user_college_id")


async def _attach_requester_ratings(requests: list) -> list:
    """Batch-attach requester_rating_avg/count to a list of join_request dicts."""
    if not requests:
        return requests
    user_ids = list({r["requester_id"] for r in requests})
    pipeline = [
        {"$match": {"rated_user_id": {"$in": user_ids}}},
        {"$group": {"_id": "$rated_user_id", "avg": {"$avg": "$stars"}, "count": {"$sum": 1}}},
    ]
    stats = await db.ratings.aggregate(pipeline).to_list(len(user_ids))
    stat_map = {s["_id"]: s for s in stats}
    for r in requests:
        s = stat_map.get(r["requester_id"])
        r["requester_rating_avg"] = round(s["avg"], 1) if s else None
        r["requester_rating_count"] = s["count"] if s else 0
    return requests


async def _enrich_with_my_request_status(pools: list, user_id: str) -> list:
    """Attach my_request_status to each pool dict, for the current viewer."""
    if not pools:
        return pools
    pool_ids = [p["pool_id"] for p in pools]
    cursor = db.join_requests.find(
        {"pool_id": {"$in": pool_ids}, "requester_id": user_id}, {"_id": 0}
    )
    status_map = {r["pool_id"]: r["status"] async for r in cursor}
    for p in pools:
        p["my_request_status"] = status_map.get(p["pool_id"])
        p.setdefault("confirmed_travelers", [])
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
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0, "password_hash": 0})
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
# Note: Render blocks outbound SMTP ports (25/465/587) on its network as a
# standard anti-spam measure, so a direct Gmail-SMTP send from this service
# can never succeed here — always [Errno 101] Network unreachable, no matter
# how correct the SMTP code is. SendGrid's HTTP API (port 443) is unaffected,
# which is why it's the primary path below.
async def send_email(to_email: str, subject: str, html_content: str) -> bool:
    if SENDGRID_API_KEY and SENDGRID_FROM_EMAIL:
        payload = {
            "personalizations": [{"to": [{"email": to_email}]}],
            "from": {"email": SENDGRID_FROM_EMAIL, "name": EMAIL_FROM_NAME},
            "subject": subject,
            "content": [{"type": "text/html", "value": html_content}],
        }
        try:
            async with httpx.AsyncClient(timeout=20) as http:
                resp = await http.post(
                    "https://api.sendgrid.com/v3/mail/send",
                    headers={"Authorization": f"Bearer {SENDGRID_API_KEY}"},
                    json=payload,
                )
            if resp.status_code >= 400:
                logger.error(f"SendGrid send failed to {to_email}: {resp.status_code} {resp.text}")
                return False
            return True
        except Exception as e:
            logger.error(f"SendGrid send failed to {to_email}: {e}")
            return False

    if not RESEND_API_KEY:
        logger.warning("No email credentials configured (SENDGRID_API_KEY or RESEND_API_KEY) — skipping email send")
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
        if resp.status_code >= 400:
            logger.error(f"Email send failed to {to_email}: {resp.status_code} {resp.text}")
            return False
        return True
    except Exception as e:
        logger.error(f"Email send failed to {to_email}: {e}")
        return False


async def _verify_turnstile(token: Optional[str], remote_ip: Optional[str]) -> bool:
    """Verifies a Cloudflare Turnstile token. If no secret key is configured
    yet, verification is skipped (open) so this can be deployed ahead of the
    Cloudflare setup being finished — flip it on the moment the key is set."""
    if not TURNSTILE_SECRET_KEY:
        return True
    if not token:
        return False
    try:
        async with httpx.AsyncClient(timeout=10) as http:
            resp = await http.post(
                "https://challenges.cloudflare.com/turnstile/v0/siteverify",
                data={"secret": TURNSTILE_SECRET_KEY, "response": token, "remoteip": remote_ip or ""},
            )
        data = resp.json()
        return bool(data.get("success"))
    except Exception as e:
        logger.error(f"Turnstile verification error: {e}")
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


async def _leaving_soon_reminder_loop():
    """Runs continuously while the service is awake. Every 5 minutes, finds
    open pools departing within the next ~35 minutes that haven't been
    reminded yet, and pushes a nudge to the owner + all confirmed travelers."""
    while True:
        try:
            now = _now_utc()
            window_end = now + timedelta(minutes=35)
            cursor = db.pools.find(
                {"status": "open", "travel_datetime": {"$gte": now, "$lte": window_end}, "reminder_sent": {"$ne": True}},
                {"_id": 0},
            )
            pools = await cursor.to_list(200)
            for p in pools:
                minutes_left = max(1, int((_ensure_aware(p["travel_datetime"]) - now).total_seconds() // 60))
                recipients = {p["user_id"]} | {t["user_id"] for t in p.get("confirmed_travelers", [])}
                for uid in recipients:
                    asyncio.create_task(send_push(
                        uid, "Ride leaving soon 🚗",
                        f"{p['from_location']} → {p['to_location']} in about {minutes_left} min",
                        "/(tabs)/matches",
                    ))
                await db.pools.update_one({"pool_id": p["pool_id"]}, {"$set": {"reminder_sent": True}})
        except Exception as e:
            logger.warning(f"Leaving-soon reminder loop error: {e}")
        await asyncio.sleep(300)


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
            <span style="color:#B05C00;">{_fmt_ist(match['travel_datetime'])}</span><br/>
            Reply to: <a href="mailto:{match['user_email']}">{match['user_email']}</a></td></tr>
          </table>
          <p style="color:#3D352F;font-size:13px;">Your request: {own['from_location']} → {own['to_location']} at {_fmt_ist(own['travel_datetime'])}</p>
          <p>Reach out and split the fare. Safe travels!</p>
          <p style="color:#B05C00;font-weight:600;">— Team UniPool</p>
        </td></tr>
      </table>
    </body></html>
    """


def join_request_email_html(recipient_name: str, requester_name: str, pool: dict, action: str) -> str:
    """action: 'received' (owner got a new request) | 'accepted' (requester got accepted)"""
    if action == "received":
        heading = "New ride request"
        body = f"<b>{requester_name}</b> wants to travel with you on this pool:"
    else:
        heading = "Request accepted!"
        body = f"<b>{pool['user_name']}</b> accepted your request to travel together:"
    return f"""
    <html><body style="font-family:Arial,sans-serif;background:#FFF9F2;padding:24px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08);">
        <tr><td style="background:#1A237E;padding:20px 24px;color:#FFECC2;">
          <div style="font-size:22px;font-weight:700;color:#FF9933;">UniPool</div>
          <div style="font-size:14px;opacity:0.9;">{heading}</div>
        </td></tr>
        <tr><td style="padding:24px;color:#1C1917;">
          <p>Namaste {recipient_name},</p>
          <p>{body}</p>
          <table cellpadding="8" cellspacing="0" style="background:#FFECC2;border-radius:12px;width:100%;margin:12px 0;">
            <tr><td>{pool['from_location']} → {pool['to_location']}<br/>
            <span style="color:#B05C00;">{_fmt_ist(pool['travel_datetime'])}</span></td></tr>
          </table>
          <p>Open UniPool to {"accept or decline" if action == "received" else "start chatting"}.</p>
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


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except Exception:
        return False


async def _create_session_token(user_id: str) -> str:
    session_token = uuid.uuid4().hex
    await db.user_sessions.insert_one(
        {
            "session_token": session_token,
            "user_id": user_id,
            "expires_at": _now_utc() + timedelta(days=7),
            "created_at": _now_utc(),
        }
    )
    return session_token


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

    session_token = await _create_session_token(user_id)
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
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


@api.post("/auth/signup")
async def signup(body: SignupRequest, request: Request):
    if not await _verify_turnstile(body.turnstile_token, request.client.host if request.client else None):
        raise HTTPException(status_code=400, detail="Bot check failed — please try again.")
    email = body.email.strip().lower()
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    if await db.users.find_one({"email": email}, {"_id": 0}):
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    username = (body.username or "").strip() or None
    if username:
        if await db.users.find_one({"username": username}, {"_id": 0}):
            raise HTTPException(status_code=409, detail="That username is already taken")

    user_id = f"user_{uuid.uuid4().hex[:12]}"
    await db.users.insert_one({
        "user_id": user_id,
        "email": email,
        "username": username,
        "name": body.name.strip() or email.split("@")[0],
        "picture": None,
        "password_hash": _hash_password(body.password),
        "gender": None,
        "phone": None,
        "created_at": _now_utc(),
        "last_login": _now_utc(),
    })
    session_token = await _create_session_token(user_id)
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    return {"session_token": session_token, "user": _with_admin_flag(user_doc)}


@api.post("/auth/login")
async def login(body: LoginRequest, request: Request):
    if not await _verify_turnstile(body.turnstile_token, request.client.host if request.client else None):
        raise HTTPException(status_code=400, detail="Bot check failed — please try again.")
    identifier = body.identifier.strip()
    user = await db.users.find_one(
        {"$or": [{"email": identifier.lower()}, {"username": identifier}]}, {"_id": 0}
    )
    if not user or not user.get("password_hash") or not _verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect email/username or password")

    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"last_login": _now_utc()}})
    session_token = await _create_session_token(user["user_id"])
    user_doc = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "password_hash": 0})
    return {"session_token": session_token, "user": _with_admin_flag(user_doc)}


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
    updated = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "password_hash": 0})
    return updated


class CollegeVerifyStart(BaseModel):
    college_email: EmailStr


class CollegeVerifyConfirm(BaseModel):
    code: str


@api.post("/profile/verify-college-id/start")
async def verify_college_id_start(body: CollegeVerifyStart, authorization: Optional[str] = Header(None)):
    """Step 1: user types their @mahindrauniversity.edu.in address (which may
    differ from their login email, e.g. if they signed up via a personal
    Google account). We validate the format, then email a 6-digit code to
    that address to confirm they actually own it before granting the badge."""
    user = await get_current_user(authorization)
    email = body.college_email.strip().lower()
    if "@" not in email or email.split("@", 1)[1] != COLLEGE_EMAIL_DOMAIN:
        raise HTTPException(status_code=400, detail=f"Please enter your @{COLLEGE_EMAIL_DOMAIN} college email.")
    local_part = email.split("@", 1)[0]
    decoded = _decode_roll_number(local_part)
    if not decoded:
        raise HTTPException(
            status_code=400,
            detail="Couldn't recognize your roll number format from this email. Please reach out if you think this is a mistake.",
        )
    existing_owner = await db.users.find_one(
        {"roll_number": decoded["roll_number"], "college_verified": True, "user_id": {"$ne": user["user_id"]}},
        {"_id": 0},
    )
    if existing_owner:
        raise HTTPException(status_code=409, detail="This roll number is already verified on another account.")

    code = f"{secrets.randbelow(1000000):06d}"
    await db.college_verifications.update_one(
        {"user_id": user["user_id"]},
        {"$set": {
            "user_id": user["user_id"], "college_email": email, "code": code,
            "expires_at": _now_utc() + timedelta(minutes=15), "attempts": 0, "created_at": _now_utc(),
        }},
        upsert=True,
    )
    sent = await send_email(
        email, "Your UniPool verification code",
        f"""<html><body style="font-family:Arial,sans-serif;background:#FFF9F2;padding:24px;">
        <div style="max-width:420px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;text-align:center;">
        <h2 style="color:#1A237E;margin-bottom:8px;">Verify your college ID</h2>
        <p style="color:#3D352F;">Enter this code in UniPool to verify {decoded['roll_number']}:</p>
        <div style="font-size:36px;font-weight:800;letter-spacing:8px;color:#F57F17;margin:24px 0;">{code}</div>
        <p style="color:#8A8178;font-size:13px;">This code expires in 15 minutes. If you didn't request this, you can ignore this email.</p>
        </div></body></html>""",
    )
    if not sent:
        raise HTTPException(status_code=502, detail="Couldn't send the verification email — please try again in a moment.")
    return {"ok": True, "sent_to": email}


@api.post("/profile/verify-college-id/confirm")
async def verify_college_id_confirm(body: CollegeVerifyConfirm, authorization: Optional[str] = Header(None)):
    """Step 2: user enters the code we emailed them."""
    user = await get_current_user(authorization)
    record = await db.college_verifications.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=400, detail="No verification in progress — please start again.")
    if _ensure_aware(record["expires_at"]) < _now_utc():
        raise HTTPException(status_code=400, detail="That code has expired — please request a new one.")
    if record.get("attempts", 0) >= 5:
        raise HTTPException(status_code=429, detail="Too many attempts — please request a new code.")
    if body.code.strip() != record["code"]:
        await db.college_verifications.update_one({"user_id": user["user_id"]}, {"$inc": {"attempts": 1}})
        raise HTTPException(status_code=400, detail="Incorrect code — please check and try again.")

    decoded = _decode_roll_number(record["college_email"].split("@", 1)[0])
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {
            **decoded, "college_email": record["college_email"],
            "college_verified": True, "college_verified_at": _now_utc(),
        }},
    )
    await db.college_verifications.delete_one({"user_id": user["user_id"]})
    updated = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "password_hash": 0})
    return _with_admin_flag(updated)


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
        "confirmed_travelers": [],
    }
    await db.pools.insert_one(doc)
    # Fire-and-forget notify
    asyncio.create_task(find_and_notify_matches({**doc}))
    return _clean(dict(doc))


@api.get("/pools", response_model=List[PoolRequestOut])
async def list_pools(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    now = _now_utc()
    blocked_ids = await _blocked_user_ids(user["user_id"])
    query = {"travel_datetime": {"$gte": now - timedelta(hours=2)}, "status": "open"}
    if blocked_ids:
        query["user_id"] = {"$nin": list(blocked_ids)}
    cursor = db.pools.find(query, {"_id": 0}).sort("travel_datetime", 1)
    results = await cursor.to_list(200)
    results = await _enrich_with_ratings(results)
    return await _enrich_with_my_request_status(results, user["user_id"])


@api.get("/pools/mine", response_model=List[PoolRequestOut])
async def my_pools(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    cursor = db.pools.find({"user_id": user["user_id"]}, {"_id": 0}).sort("travel_datetime", -1)
    results = await cursor.to_list(200)
    results = await _enrich_with_ratings(results)
    return await _enrich_with_my_request_status(results, user["user_id"])


@api.get("/pools/{pool_id}", response_model=PoolRequestOut)
async def get_pool(pool_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    pool = await db.pools.find_one({"pool_id": pool_id}, {"_id": 0})
    if not pool:
        raise HTTPException(status_code=404, detail="Pool not found")
    if await _is_blocked_pair(user["user_id"], pool["user_id"]):
        raise HTTPException(status_code=404, detail="Pool not found")
    results = await _enrich_with_ratings([pool])
    results = await _enrich_with_my_request_status(results, user["user_id"])
    return results[0]


@api.patch("/pools/{pool_id}/close", response_model=PoolRequestOut)
async def close_pool(pool_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    r = await db.pools.update_one(
        {"pool_id": pool_id, "user_id": user["user_id"]}, {"$set": {"status": "closed"}}
    )
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    # Closing a pool means it's no longer taking new travelers — any still-pending
    # join requests on it are auto-declined so requesters aren't left hanging.
    await db.join_requests.update_many(
        {"pool_id": pool_id, "status": "pending"},
        {"$set": {"status": "declined", "responded_at": _now_utc()}},
    )
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
    enriched = await _enrich_with_ratings(list(results.values()))
    return await _enrich_with_my_request_status(enriched, user["user_id"])


@api.delete("/pools/{pool_id}")
async def delete_pool(pool_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    r = await db.pools.delete_one({"pool_id": pool_id, "user_id": user["user_id"]})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


# ---------- Join Requests ----------
def _pool_is_joinable(pool: dict) -> bool:
    if not pool or pool.get("status") != "open":
        return False
    return _ensure_aware(pool["travel_datetime"]) > _now_utc()


@api.post("/pools/{pool_id}/requests", response_model=JoinRequestOut)
async def create_join_request(pool_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    pool = await db.pools.find_one({"pool_id": pool_id}, {"_id": 0})
    if not pool:
        raise HTTPException(status_code=404, detail="Pool not found")
    if pool["user_id"] == user["user_id"]:
        raise HTTPException(status_code=400, detail="You can't request to join your own pool")
    if not _pool_is_joinable(pool):
        raise HTTPException(status_code=400, detail="This pool is no longer accepting requests")
    if any(t["user_id"] == user["user_id"] for t in pool.get("confirmed_travelers", [])):
        raise HTTPException(status_code=400, detail="You're already confirmed on this pool")
    if await _is_blocked_pair(user["user_id"], pool["user_id"]):
        raise HTTPException(status_code=403, detail="You can't request to join this pool")

    existing = await db.join_requests.find_one(
        {"pool_id": pool_id, "requester_id": user["user_id"], "status": {"$in": ["pending", "accepted"]}},
        {"_id": 0},
    )
    if existing:
        raise HTTPException(status_code=400, detail="You already have a request on this pool")

    doc = {
        "request_id": f"req_{uuid.uuid4().hex[:12]}",
        "pool_id": pool_id,
        "pool_owner_id": pool["user_id"],
        "from_location": pool["from_location"],
        "to_location": pool["to_location"],
        "travel_datetime": pool["travel_datetime"],
        "requester_id": user["user_id"],
        "requester_name": user.get("name") or "Traveller",
        "requester_email": user["email"],
        "requester_gender": user.get("gender"),
        "status": "pending",
        "created_at": _now_utc(),
        "responded_at": None,
    }
    await db.join_requests.insert_one(doc)

    asyncio.create_task(send_push(
        pool["user_id"], "New ride request",
        f"{doc['requester_name']} wants to travel with you: {pool['from_location']} → {pool['to_location']}",
        "/(tabs)/matches",
    ))
    asyncio.create_task(send_email(
        pool["user_email"], "UniPool: New ride request",
        join_request_email_html(pool["user_name"], doc["requester_name"], pool, "received"),
    ))
    return _clean(dict(doc))


@api.get("/pools/{pool_id}/requests", response_model=List[JoinRequestOut])
async def list_pool_requests(pool_id: str, authorization: Optional[str] = Header(None)):
    """Pool owner only — all requests (any status) for one of their pools."""
    user = await get_current_user(authorization)
    pool = await db.pools.find_one({"pool_id": pool_id}, {"_id": 0})
    if not pool:
        raise HTTPException(status_code=404, detail="Pool not found")
    if pool["user_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Not your pool")
    cursor = db.join_requests.find({"pool_id": pool_id}, {"_id": 0}).sort("created_at", -1)
    return await cursor.to_list(200)


@api.get("/requests/incoming", response_model=List[JoinRequestOut])
async def incoming_requests(authorization: Optional[str] = Header(None)):
    """Pending requests on pools I own — for the notification/inbox badge."""
    user = await get_current_user(authorization)
    cursor = db.join_requests.find(
        {"pool_owner_id": user["user_id"], "status": "pending"}, {"_id": 0}
    ).sort("created_at", -1)
    results = await cursor.to_list(200)
    results = await _attach_requester_ratings(results)
    return await _attach_badges(results, "requester_id", "requester_email", "requester_rating_avg", "requester_rating_count", "requester_badges", "requester_college_id")


@api.get("/requests/mine", response_model=List[JoinRequestOut])
async def my_requests(authorization: Optional[str] = Header(None)):
    """Requests I've sent, any status — so I can see pending/accepted/declined."""
    user = await get_current_user(authorization)
    cursor = db.join_requests.find(
        {"requester_id": user["user_id"]}, {"_id": 0}
    ).sort("created_at", -1)
    results = await cursor.to_list(200)
    results = await _attach_requester_ratings(results)
    return await _attach_badges(results, "requester_id", "requester_email", "requester_rating_avg", "requester_rating_count", "requester_badges", "requester_college_id")


@api.patch("/requests/{request_id}/accept", response_model=JoinRequestOut)
async def accept_request(request_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    reqdoc = await db.join_requests.find_one({"request_id": request_id}, {"_id": 0})
    if not reqdoc:
        raise HTTPException(status_code=404, detail="Request not found")
    if reqdoc["pool_owner_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Not your pool")
    if reqdoc["status"] != "pending":
        raise HTTPException(status_code=400, detail="This request was already responded to")

    pool = await db.pools.find_one({"pool_id": reqdoc["pool_id"]}, {"_id": 0})
    if not pool:
        raise HTTPException(status_code=404, detail="Pool not found")

    traveler = {"user_id": reqdoc["requester_id"], "name": reqdoc["requester_name"], "email": reqdoc["requester_email"]}
    # Keeps adding travelers — 2 confirmed + 1 more accepted just appends, no cap here.
    await db.pools.update_one(
        {"pool_id": pool["pool_id"], "confirmed_travelers.user_id": {"$ne": traveler["user_id"]}},
        {"$push": {"confirmed_travelers": traveler}},
    )
    await db.join_requests.update_one(
        {"request_id": request_id}, {"$set": {"status": "accepted", "responded_at": _now_utc()}}
    )
    updated = await db.join_requests.find_one({"request_id": request_id}, {"_id": 0})

    asyncio.create_task(send_push(
        reqdoc["requester_id"], "Request accepted! 🚗",
        f"{user.get('name')} accepted you for {pool['from_location']} → {pool['to_location']}",
        "/(tabs)/matches",
    ))
    asyncio.create_task(send_email(
        reqdoc["requester_email"], "UniPool: Your request was accepted",
        join_request_email_html(reqdoc["requester_name"], user.get("name") or "", pool, "accepted"),
    ))
    return _clean(updated)


@api.patch("/requests/{request_id}/decline", response_model=JoinRequestOut)
async def decline_request(request_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    reqdoc = await db.join_requests.find_one({"request_id": request_id}, {"_id": 0})
    if not reqdoc:
        raise HTTPException(status_code=404, detail="Request not found")
    if reqdoc["pool_owner_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Not your pool")
    if reqdoc["status"] != "pending":
        raise HTTPException(status_code=400, detail="This request was already responded to")

    await db.join_requests.update_one(
        {"request_id": request_id}, {"$set": {"status": "declined", "responded_at": _now_utc()}}
    )
    return _clean(await db.join_requests.find_one({"request_id": request_id}, {"_id": 0}))


@api.delete("/requests/{request_id}")
async def cancel_request(request_id: str, authorization: Optional[str] = Header(None)):
    """Requester withdraws their own pending request."""
    user = await get_current_user(authorization)
    r = await db.join_requests.delete_one(
        {"request_id": request_id, "requester_id": user["user_id"], "status": "pending"}
    )
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


# ---------- Confirmed Rides (accepted requests, from both sides) ----------
@api.get("/matches/confirmed")
async def confirmed_matches(authorization: Optional[str] = Header(None)):
    """Every 'traveling together' pairing involving me — whether I'm the pool
    owner or a confirmed traveler on someone else's pool."""
    user = await get_current_user(authorization)
    uid = user["user_id"]
    results = []

    owner_pools = await db.pools.find(
        {"user_id": uid, "confirmed_travelers.0": {"$exists": True}}, {"_id": 0}
    ).to_list(200)
    for p in owner_pools:
        for t in p.get("confirmed_travelers", []):
            results.append({
                "pool_id": p["pool_id"], "from_location": p["from_location"], "to_location": p["to_location"],
                "travel_datetime": p["travel_datetime"], "pool_status": p.get("status", "open"),
                "other_user_id": t["user_id"], "other_user_name": t["name"], "other_user_email": t["email"],
                "my_role": "owner",
            })

    traveler_pools = await db.pools.find({"confirmed_travelers.user_id": uid}, {"_id": 0}).to_list(200)
    for p in traveler_pools:
        results.append({
            "pool_id": p["pool_id"], "from_location": p["from_location"], "to_location": p["to_location"],
            "travel_datetime": p["travel_datetime"], "pool_status": p.get("status", "open"),
            "other_user_id": p["user_id"], "other_user_name": p["user_name"], "other_user_email": p["user_email"],
            "my_role": "traveler",
        })

    if not results:
        return []
    other_ids = list({r["other_user_id"] for r in results})
    pipeline = [
        {"$match": {"rated_user_id": {"$in": other_ids}}},
        {"$group": {"_id": "$rated_user_id", "avg": {"$avg": "$stars"}, "count": {"$sum": 1}}},
    ]
    stats = await db.ratings.aggregate(pipeline).to_list(len(other_ids))
    stat_map = {s["_id"]: s for s in stats}
    for r in results:
        s = stat_map.get(r["other_user_id"])
        r["other_user_rating_avg"] = round(s["avg"], 1) if s else None
        r["other_user_rating_count"] = s["count"] if s else 0
    results = await _attach_badges(results, "other_user_id", "other_user_email", "other_user_rating_avg", "other_user_rating_count", "other_user_badges", "other_user_college_id")
    results.sort(key=lambda r: r["travel_datetime"], reverse=True)
    return results


@api.delete("/pools/{pool_id}/travelers/{traveler_user_id}")
async def remove_confirmed_traveler(pool_id: str, traveler_user_id: str, authorization: Optional[str] = Header(None)):
    """Either the pool owner or the confirmed traveler themselves can undo a
    'traveling together' pairing at any time — no questions asked."""
    user = await get_current_user(authorization)
    pool = await db.pools.find_one({"pool_id": pool_id}, {"_id": 0})
    if not pool:
        raise HTTPException(status_code=404, detail="Pool not found")
    if user["user_id"] not in (pool["user_id"], traveler_user_id):
        raise HTTPException(status_code=403, detail="Not part of this ride")
    if not any(t["user_id"] == traveler_user_id for t in pool.get("confirmed_travelers", [])):
        raise HTTPException(status_code=404, detail="Not a confirmed traveler on this pool")

    await db.pools.update_one(
        {"pool_id": pool_id}, {"$pull": {"confirmed_travelers": {"user_id": traveler_user_id}}}
    )
    await db.join_requests.update_many(
        {"pool_id": pool_id, "requester_id": traveler_user_id, "status": "accepted"},
        {"$set": {"status": "removed", "responded_at": _now_utc()}},
    )

    other_user_id = pool["user_id"] if user["user_id"] == traveler_user_id else traveler_user_id
    asyncio.create_task(send_push(
        other_user_id, "Ride update",
        f"{user.get('name')} removed themselves from {pool['from_location']} → {pool['to_location']}"
        if user["user_id"] == traveler_user_id else
        f"You were removed from {pool['from_location']} → {pool['to_location']}",
        "/(tabs)/matches",
    ))
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

    to_user = await db.users.find_one({"user_id": body.to_user_id}, {"_id": 0, "password_hash": 0})
    if not to_user:
        raise HTTPException(status_code=404, detail="Recipient not found")
    if await _is_blocked_pair(user["user_id"], body.to_user_id):
        raise HTTPException(status_code=403, detail="You can't message this user")
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
    if not (1 <= body.stars <= 10):
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 10")
    rated_user = await db.users.find_one({"user_id": body.rated_user_id}, {"_id": 0, "password_hash": 0})
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
            "scale": 10,
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
    college_map = await _college_info_map([user_id])
    rides_map = await _rides_completed_map([user_id])
    badges = _compute_badges(user_id in college_map, avg, len(ratings), rides_map.get(user_id, 0))
    return {"average": avg, "count": len(ratings), "ratings": ratings, "badges": badges, "college_id": college_map.get(user_id)}


@api.get("/ratings/can-rate/{user_id}")
async def can_rate(user_id: str, authorization: Optional[str] = Header(None)):
    """Whether the current user has already rated this user, and their existing rating if so."""
    user = await get_current_user(authorization)
    existing = await db.ratings.find_one(
        {"rater_user_id": user["user_id"], "rated_user_id": user_id}, {"_id": 0}
    )
    return {"already_rated": existing is not None, "existing": existing}


# ---------- Safety: Block & Report ----------
@api.post("/users/{user_id}/block")
async def block_user(user_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    if user_id == user["user_id"]:
        raise HTTPException(status_code=400, detail="You can't block yourself")
    target = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    await db.blocks.update_one(
        {"blocker_id": user["user_id"], "blocked_id": user_id},
        {"$setOnInsert": {"blocker_id": user["user_id"], "blocked_id": user_id, "created_at": _now_utc()}},
        upsert=True,
    )
    return {"ok": True}


@api.delete("/users/{user_id}/block")
async def unblock_user(user_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    await db.blocks.delete_one({"blocker_id": user["user_id"], "blocked_id": user_id})
    return {"ok": True}


@api.get("/users/me/blocked")
async def list_blocked(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    cursor = db.blocks.find({"blocker_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1)
    rows = await cursor.to_list(500)
    ids = [r["blocked_id"] for r in rows]
    if not ids:
        return []
    users = await db.users.find({"user_id": {"$in": ids}}, {"_id": 0, "password_hash": 0}).to_list(500)
    u_map = {u["user_id"]: u for u in users}
    return [
        {"user_id": r["blocked_id"], "name": u_map.get(r["blocked_id"], {}).get("name", "Unknown"), "blocked_at": r["created_at"]}
        for r in rows
    ]


@api.post("/reports")
async def submit_report(body: ReportCreate, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    if body.reported_user_id == user["user_id"]:
        raise HTTPException(status_code=400, detail="You can't report yourself")
    target = await db.users.find_one({"user_id": body.reported_user_id}, {"_id": 0, "password_hash": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    await db.reports.insert_one({
        "report_id": f"rpt_{uuid.uuid4().hex[:12]}",
        "reporter_id": user["user_id"],
        "reporter_name": user.get("name"),
        "reported_user_id": body.reported_user_id,
        "reported_user_name": target.get("name"),
        "reason": body.reason.strip()[:60],
        "details": (body.details or "").strip()[:1000] or None,
        "pool_id": body.pool_id,
        "status": "open",
        "created_at": _now_utc(),
    })
    return {"ok": True}


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


@api.post("/admin/migrate-ratings-scale")
async def admin_migrate_ratings_scale(authorization: Optional[str] = Header(None)):
    """One-time, idempotent migration: rescale ratings submitted on the old
    1-5 scale to the current 1-10 scale (stars * 2, capped at 10). Safe to
    call more than once — only touches docs without a 'scale' marker."""
    await require_admin(authorization)
    result = await db.ratings.update_many(
        {"scale": {"$exists": False}},
        [{"$set": {"stars": {"$min": [{"$multiply": ["$stars", 2]}, 10]}, "scale": 10}}],
    )
    return {"ok": True, "matched": result.matched_count, "modified": result.modified_count}


@api.get("/admin/reports")
async def admin_list_reports(authorization: Optional[str] = Header(None)):
    await require_admin(authorization)
    cursor = db.reports.find({}, {"_id": 0}).sort("created_at", -1)
    return await cursor.to_list(500)


@api.patch("/admin/reports/{report_id}/resolve")
async def admin_resolve_report(report_id: str, authorization: Optional[str] = Header(None)):
    await require_admin(authorization)
    r = await db.reports.update_one({"report_id": report_id}, {"$set": {"status": "resolved"}})
    if r.matched_count == 0:
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
        await db.users.create_index("username", unique=True, sparse=True)
        await db.user_sessions.create_index("session_token", unique=True)
        await db.user_sessions.create_index("user_id")
        await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
        await db.pools.create_index("pool_id", unique=True)
        await db.pools.create_index([("from_location", 1), ("to_location", 1), ("travel_datetime", 1)])
        await db.blocks.create_index([("blocker_id", 1), ("blocked_id", 1)], unique=True)
        await db.reports.create_index("created_at")
        await db.college_verifications.create_index("user_id", unique=True)
        await db.users.create_index("roll_number", sparse=True)
        logger.info("Indexes created")
    except Exception as e:
        logger.warning(f"Index setup issue: {e}")

    try:
        existing_admin = await db.users.find_one({"username": SEED_ADMIN_USERNAME}, {"_id": 0})
        if not existing_admin:
            await db.users.insert_one({
                "user_id": f"user_{uuid.uuid4().hex[:12]}",
                "email": SEED_ADMIN_EMAIL,
                "username": SEED_ADMIN_USERNAME,
                "name": "BB Admin",
                "picture": None,
                "password_hash": _hash_password(SEED_ADMIN_PASSWORD),
                "gender": None,
                "phone": None,
                "is_admin_override": True,
                "created_at": _now_utc(),
                "last_login": None,
            })
            logger.info(f"Seeded admin account '{SEED_ADMIN_USERNAME}'")
    except Exception as e:
        logger.warning(f"Admin seed issue: {e}")

    asyncio.create_task(_leaving_soon_reminder_loop())


@app.on_event("shutdown")
async def _shutdown():
    client.close()
