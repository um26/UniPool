"""
Authentication-related Pydantic models.
"""

from pydantic import BaseModel, Field, EmailStr
from typing import Optional
from datetime import datetime, timedelta

# Pydantic models for request/response validation
class GoogleSignIn(BaseModel):
    """Google OAuth sign-in request"""
    id_token: str

class SessionExchange(BaseModel):
    """Session token exchange request"""
    session_id: str

class RatingCreate(BaseModel):
    """Rating submission request"""
    rated_user_id: str
    stars: int = Field(..., ge=1, le=10)  # 1-10 stars
    comment: Optional[str] = None
    pool_id: Optional[str] = None

class MessageCreate(BaseModel):
    """Message sending request"""
    to_user_id: str
    pool_id: Optional[str] = None
    text: str

class PushSubscribe(BaseModel):
    """Push notification subscription request"""
    endpoint: str
    keys: dict

class ReportCreate(BaseModel):
    """Report submission request"""
    reported_user_id: str
    reason: str
    details: Optional[str] = None
    pool_id: Optional[str] = None

class GameScoreSubmit(BaseModel):
    """Game score submission request"""
    game: str
    score: int

# Response models
class UserRate(BaseModel):
    """User rating information"""
    stars: int
    comment: Optional[str] = None
    created_at: datetime

class MessageResponse(BaseModel):
    """Message response"""
    message_id: str
    from_user_id: str
    to_user_id: str
    pool_id: Optional[str] = None
    text: str
    created_at: datetime
    read: bool = False

MessageOut = MessageResponse

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
    requester_badges: list[dict] = []
    requester_college_id: Optional[dict] = None
    status: str = "pending"
    created_at: datetime
    responded_at: Optional[datetime] = None

class ReportResponse(BaseModel):
    """Report response"""
    report_id: str
    reporter_id: str
    reporter_name: str
    reported_user_id: str
    reported_user_name: str
    reason: str
    details: Optional[str] = None
    pool_id: Optional[str] = None
    status: str = "open"  # "open" | "resolved"
    created_at: datetime

class GameLeaderboardEntry(BaseModel):
    """Game leaderboard entry"""
    user_id: str
    user_name: str
    score: int
    created_at: datetime

class AdminStatsResponse(BaseModel):
    """Admin statistics response"""
    total_users: int
    total_pools: int
    open_pools: int
    closed_pools: int

# MongoDB document representations
class SessionDocument:
    """MongoDB document structure for user_sessions collection"""
    @staticmethod
    def get_indexes():
        """Define database indexes for user_sessions collection"""
        return [
            {"key": [("session_token", 1)], "unique": True},
            {"key": [("user_id", 1)]},
            {"key": [("expires_at", 1)], "expireAfterSeconds": 0}
        ]

class RatingDocument:
    """MongoDB document structure for ratings collection"""
    @staticmethod
    def get_indexes():
        """Define database indexes for ratings collection"""
        return [
            {"key": [("rated_user_id", 1)]}
        ]

class BlockDocument:
    """MongoDB document structure for blocks collection"""
    @staticmethod
    def get_indexes():
        """Define database indexes for blocks collection"""
        return [
            {"key": [("blocker_id", 1), ("blocked_id", 1)], "unique": True}
        ]

class JoinRequestDocument:
    """MongoDB document structure for join_requests collection"""
    @staticmethod
    def get_indexes():
        """Define database indexes for join_requests collection"""
        return [
            {"key": [("request_id", 1)], "unique": True},
            {"key": [("pool_id", 1)]},
            {"key": [("pool_owner_id", 1)]},
            {"key": [("requester_id", 1)]}
        ]

class MessageDocument:
    """MongoDB document structure for messages collection"""
    @staticmethod
    def get_indexes():
        """Define database indexes for messages collection"""
        return [
            {"key": [("message_id", 1)], "unique": True},
            {"key": [("from_user_id", 1), ("created_at", 1)]}
        ]

class PushSubscriptionDocument:
    """MongoDB document structure for push_subscriptions collection"""
    @staticmethod
    def get_indexes():
        """Define database indexes for push_subscriptions collection"""
        return [
            {"key": [("endpoint", 1)], "unique": True}
        ]

class ReportDocument:
    """MongoDB document structure for reports collection"""
    @staticmethod
    def get_indexes():
        """Define database indexes for reports collection"""
        return [
            {"key": [("report_id", 1)], "unique": True},
            {"key": [("created_at", 1)]}
        ]

class GameScoreDocument:
    """MongoDB document structure for game_scores collection"""
    @staticmethod
    def get_indexes():
        """Define database indexes for game_scores collection"""
        return [
            {"key": [("game", 1)]}
        ]