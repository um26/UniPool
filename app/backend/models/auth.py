"""
Authentication-related Pydantic models.
"""

from pydantic import BaseModel, Field, EmailStr
from typing import Optional
from datetime import datetime


class GoogleSignIn(BaseModel):
    id_token: str


class MicrosoftSignIn(BaseModel):
    id_token: str
    nonce: str


class SessionExchange(BaseModel):
    session_id: str


class RatingCreate(BaseModel):
    rated_user_id: str
    stars: int = Field(..., ge=1, le=10)
    comment: Optional[str] = None
    pool_id: Optional[str] = None


class MessageCreate(BaseModel):
    to_user_id: str
    pool_id: Optional[str] = None
    text: str


class PushSubscribe(BaseModel):
    endpoint: str
    keys: dict


class ReportCreate(BaseModel):
    reported_user_id: str
    reason: str
    details: Optional[str] = None
    pool_id: Optional[str] = None


class GameScoreSubmit(BaseModel):
    game: str
    score: int


class UserRate(BaseModel):
    stars: int
    comment: Optional[str] = None
    created_at: datetime


class MessageResponse(BaseModel):
    message_id: str
    from_user_id: str
    to_user_id: Optional[str] = None
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
    conversation_id: Optional[str] = None
    conversation_name: Optional[str] = None


class ReportResponse(BaseModel):
    report_id: str
    reporter_id: str
    reporter_name: str
    reported_user_id: str
    reported_user_name: str
    reason: str
    details: Optional[str] = None
    pool_id: Optional[str] = None
    status: str = "open"
    created_at: datetime


class GameLeaderboardEntry(BaseModel):
    user_id: str
    user_name: str
    score: int
    created_at: datetime


class AdminStatsResponse(BaseModel):
    total_users: int
    total_pools: int
    open_pools: int
    closed_pools: int


class SessionDocument:
    @staticmethod
    def get_indexes():
        return [
            {"key": [("session_token", 1)], "unique": True},
            {"key": [("user_id", 1)]},
            {"key": [("expires_at", 1)], "expireAfterSeconds": 0},
        ]


class RatingDocument:
    @staticmethod
    def get_indexes():
        return [{"key": [("rated_user_id", 1)]}]


class BlockDocument:
    @staticmethod
    def get_indexes():
        return [{"key": [("blocker_id", 1), ("blocked_id", 1)], "unique": True}]


class JoinRequestDocument:
    @staticmethod
    def get_indexes():
        return [
            {"key": [("request_id", 1)], "unique": True},
            {"key": [("pool_id", 1)]},
            {"key": [("pool_owner_id", 1)]},
            {"key": [("requester_id", 1)]},
        ]


class MessageDocument:
    @staticmethod
    def get_indexes():
        return [
            {"key": [("message_id", 1)], "unique": True},
            {"key": [("from_user_id", 1), ("created_at", 1)]},
            {"key": [("conversation_id", 1), ("created_at", 1)]},
        ]


class PushSubscriptionDocument:
    @staticmethod
    def get_indexes():
        return [{"key": [("endpoint", 1)], "unique": True}]


class ReportDocument:
    @staticmethod
    def get_indexes():
        return [
            {"key": [("report_id", 1)], "unique": True},
            {"key": [("created_at", 1)]},
        ]


class GameScoreDocument:
    @staticmethod
    def get_indexes():
        return [{"key": [("game", 1)]}]
