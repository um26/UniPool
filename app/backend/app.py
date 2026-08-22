"""
Main application entry point for UniPool backend.
Initializes FastAPI application, includes routers, and sets up middleware.
"""

import sys
import os
from pathlib import Path

# Add the backend directory to the Python path so we can import from it
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from config.database import db
from routes import auth_router, pools_router, profile_router, requests_router, messages_router, admin_router, games_router, matches_router, users_router
import logging
from datetime import datetime, timezone

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("unipool")

# Create FastAPI application
app = FastAPI(
    title="UniPool API",
    description="Backend API for UniPool - University Carpooling Platform",
    version="1.0.0"
)

# Configure CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all API routers with the /api prefix
app.include_router(auth_router, prefix="/api")
app.include_router(pools_router, prefix="/api")
app.include_router(profile_router, prefix="/api")
app.include_router(requests_router, prefix="/api")
app.include_router(messages_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(games_router, prefix="/api")
app.include_router(matches_router, prefix="/api")
app.include_router(users_router, prefix="/api")


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint returning basic API information."""
    return {
        "app": "UniPool",
        "status": "ok",
        "version": "1.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


# Application startup event
@app.on_event("startup")
async def startup_event():
    """Initialize database indexes and seed data on application startup."""
    logger.info("Starting UniPool application...")

    try:
        # Create database indexes
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
        await db.messages.create_index([("message_id", 1)], unique=True)
        await db.messages.create_index([("from_user_id", 1), ("created_at", 1)])
        await db.game_scores.create_index([("game", 1)])

        logger.info("Database indexes created successfully")

        # Seed admin account if it doesn't exist
        from config.settings import SEED_ADMIN_EMAIL, SEED_ADMIN_USERNAME, SEED_ADMIN_PASSWORD
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
            logger.info(f"Seeded admin account '{SEED_ADMIN_USERNAME}'")
        else:
            logger.info(f"Admin account '{SEED_ADMIN_USERNAME}' already exists")

    except Exception as e:
        logger.error(f"Error during application startup: {e}")
        # Don't prevent startup if seeding fails, but log the error


# Application shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup operations on application shutdown."""
    logger.info("Shutting down UniPool application...")
    # Close database connections if needed
    # db.client.close()  # Uncomment if using a client that needs explicit closing


# Export the app instance
__all__ = ["app"]