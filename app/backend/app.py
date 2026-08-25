"""Canonical FastAPI entry point for the UniPool backend."""

import logging
import sys
from datetime import datetime, timezone
from pathlib import Path

backend_dir = Path(__file__).parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from config.database import db
from routes import (
    auth_router,
    pools_router,
    profile_router,
    requests_router,
    messages_router,
    admin_router,
    games_router,
    matches_router,
    users_router,
    compat_router,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("unipool")

app = FastAPI(
    title="UniPool API",
    description="Backend API for UniPool - University Carpooling Platform",
    version="1.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

for router in (
    auth_router,
    pools_router,
    profile_router,
    requests_router,
    messages_router,
    admin_router,
    games_router,
    matches_router,
    users_router,
    compat_router,
):
    app.include_router(router, prefix="/api")


@app.get("/")
async def root():
    return {
        "app": "UniPool",
        "status": "ok",
        "version": "1.1.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.on_event("startup")
async def startup_event():
    """Create the indexes required by active UniPool product flows."""
    logger.info("Starting UniPool application...")
    try:
        await db.users.create_index("email", unique=True)
        await db.users.create_index("user_id", unique=True)
        await db.users.create_index("username", unique=True, sparse=True)
        await db.users.create_index("roll_number", sparse=True)
        await db.user_sessions.create_index("session_token", unique=True)
        await db.user_sessions.create_index("user_id")
        await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
        await db.pools.create_index("pool_id", unique=True)
        await db.pools.create_index([("from_location", 1), ("to_location", 1), ("travel_datetime", 1)])
        await db.pools.create_index([("user_id", 1), ("status", 1), ("travel_datetime", 1)])
        await db.join_requests.create_index("request_id", unique=True)
        await db.join_requests.create_index([("pool_owner_id", 1), ("status", 1)])
        await db.join_requests.create_index([("requester_id", 1), ("status", 1)])
        await db.blocks.create_index([("blocker_id", 1), ("blocked_id", 1)], unique=True)
        await db.reports.create_index("created_at")
        await db.college_verifications.create_index("user_id", unique=True)
        await db.messages.create_index("message_id", unique=True)
        await db.messages.create_index([("from_user_id", 1), ("created_at", 1)])
        await db.messages.create_index([("conversation_id", 1), ("created_at", 1)])
        await db.conversations.create_index("conversation_id", unique=True)
        await db.conversations.create_index([("type", 1), ("route_key", 1), ("travel_datetime", 1)])
        await db.push_subscriptions.create_index("endpoint", unique=True)
        await db.push_subscriptions.create_index("user_id")
        await db.game_scores.create_index([("game", 1)])

        from config.settings import SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, SEED_ADMIN_USERNAME
        from helpers.auth_helper import _hash_password

        existing_admin = await db.users.find_one({"username": SEED_ADMIN_USERNAME}, {"_id": 0})
        if not existing_admin:
            admin_user_id = f"user_{__import__('uuid').uuid4().hex[:12]}"
            await db.users.insert_one({
                "user_id": admin_user_id,
                "email": SEED_ADMIN_EMAIL,
                "username": SEED_ADMIN_USERNAME,
                "name": "BB Admin",
                "picture": None,
                "password_hash": _hash_password(SEED_ADMIN_PASSWORD),
                "gender": None,
                "phone": None,
                "is_admin_override": True,
                "created_at": datetime.now(timezone.utc),
                "last_login": None,
            })
        logger.info("UniPool database indexes ready")
    except Exception as exc:
        logger.exception("UniPool startup initialization failed: %s", exc)


@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Shutting down UniPool application...")


__all__ = ["app"]
