"""
Pool-related Pydantic models and MongoDB document schemas.
"""

from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from datetime import datetime

# Pydantic models for request/response validation
class PoolRequestCreate(BaseModel):
    """Request to create a new pool"""
    from_location: str
    to_location: str
    travel_datetime: datetime  # ISO8601
    gender_preference: str = "any"  # "any" | "same"
    companions: int = 0
    luggage: Optional[str] = None
    notes: Optional[str] = None
    trip_mode: bool = False

class PoolRequestUpdate(BaseModel):
    """Request to update an existing pool"""
    from_location: Optional[str] = None
    to_location: Optional[str] = None
    travel_datetime: Optional[datetime] = None
    gender_preference: Optional[str] = None
    companions: Optional[int] = None
    luggage: Optional[str] = None
    notes: Optional[str] = None
    trip_mode: Optional[bool] = None

# MongoDB document representation (for internal use)
class PoolDocument:
    """MongoDB document structure for pools collection"""
    @staticmethod
    def get_indexes():
        """Define database indexes for pools collection"""
        return [
            {"key": [("pool_id", 1)], "unique": True},
            {"key": [("from_location", 1), ("to_location", 1), ("travel_datetime", 1)]}
        ]

# Response models
class ConfirmedTraveler(BaseModel):
    """Information about a confirmed traveler in a pool"""
    user_id: str
    name: str
    email: EmailStr

class PoolResponse(BaseModel):
    """Complete pool response with computed fields"""
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
    trip_mode: bool = False
    status: str = "open"  # "open" | "closed"
    created_at: datetime
    user_rating_avg: Optional[float] = None
    user_rating_count: int = 0
    user_badges: List[dict] = []
    user_college_id: Optional[dict] = None
    confirmed_travelers: List[ConfirmedTraveler] = []
    my_request_status: Optional[str] = None  # "pending" | "accepted" | "declined" | None