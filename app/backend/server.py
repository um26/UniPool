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


class ProfileUpdate(BaseModel):
    gender: Optional[str] = None  # "male" | "female" | "other"
    phone: Optional[str] = None


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
@api.post("/pools", response_model=PoolRequestOut)
async def create_pool(body: PoolRequestCreate, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
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
    return await cursor.to_list(200)


@api.get("/pools/mine", response_model=List[PoolRequestOut])
async def my_pools(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    cursor = db.pools.find({"user_id": user["user_id"]}, {"_id": 0}).sort("travel_datetime", -1)
    return await cursor.to_list(200)


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
    return list(results.values())


@api.delete("/pools/{pool_id}")
async def delete_pool(pool_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    r = await db.pools.delete_one({"pool_id": pool_id, "user_id": user["user_id"]})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
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
