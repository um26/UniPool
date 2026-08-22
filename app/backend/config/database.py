"""
Database configuration for UniPool backend.
Sets up MongoDB connection using Motor async driver.
"""

from motor.motor_asyncio import AsyncIOMotorClient
from .settings import MONGO_URL, DB_NAME

# Create MongoDB client connection
client = AsyncIOMotorClient(
    MONGO_URL,
    tz_aware=True,
    tzinfo=__import__('datetime').timezone.utc
)

# Get database instance
db = client[DB_NAME]

# Export for use in other modules
__all__ = ["client", "db"]