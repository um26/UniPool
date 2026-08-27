"""
Pool-related Pydantic models and MongoDB document schemas.
"""

from pydantic import BaseModel, Field, EmailStr, model_validator
from typing import Dict, List, Optional
from datetime import datetime


class PoolRequestCreate(BaseModel):
    """Request to create a new pool."""
    from_location: str = Field(min_length=2, max_length=120)
    to_location: str = Field(min_length=2, max_length=120)
    travel_datetime: datetime
    gender_preference: str = "any"
    companions: int = Field(default=0, ge=0, le=6)
    total_seats: int = Field(default=4, ge=1, le=8)
    luggage: Optional[str] = Field(default=None, max_length=80)
    notes: Optional[str] = Field(default=None, max_length=240)
    trip_mode: bool = False

    @model_validator(mode="after")
    def validate_pool(self):
        if self.gender_preference not in {"any", "same"}:
            raise ValueError("Invalid gender preference")
        if " ".join(self.from_location.split()).casefold() == " ".join(self.to_location.split()).casefold():
            raise ValueError("Pickup and drop cannot be the same")
        if self.companions + 1 > self.total_seats:
            raise ValueError("Seats must cover you and your companions")
        return self


class PoolRequestUpdate(BaseModel):
    """Request to update an existing pool."""
    from_location: Optional[str] = Field(default=None, min_length=2, max_length=120)
    to_location: Optional[str] = Field(default=None, min_length=2, max_length=120)
    travel_datetime: Optional[datetime] = None
    gender_preference: Optional[str] = None
    companions: Optional[int] = Field(default=None, ge=0, le=6)
    total_seats: Optional[int] = Field(default=None, ge=1, le=8)
    luggage: Optional[str] = Field(default=None, max_length=80)
    notes: Optional[str] = Field(default=None, max_length=240)
    trip_mode: Optional[bool] = None


class PoolDocument:
    """MongoDB document structure for pools collection."""

    @staticmethod
    def get_indexes():
        return [
            {"key": [("pool_id", 1)], "unique": True},
            {"key": [("route_key", 1), ("status", 1), ("travel_datetime", 1)]},
            {"key": [("from_location", 1), ("to_location", 1), ("travel_datetime", 1)]},
        ]


class ConfirmedTraveler(BaseModel):
    user_id: str
    name: str
    email: EmailStr


class PoolResponse(BaseModel):
    """Complete pool response with computed and v2 trip fields."""
    pool_id: str
    user_id: str
    user_name: str
    user_email: EmailStr
    user_gender: Optional[str] = None
    from_location: str
    to_location: str
    from_location_id: Optional[str] = None
    to_location_id: Optional[str] = None
    from_location_canonical: Optional[str] = None
    to_location_canonical: Optional[str] = None
    from_coords: Optional[dict] = None
    to_coords: Optional[dict] = None
    route_key: Optional[str] = None
    travel_datetime: datetime
    gender_preference: str
    companions: int
    total_seats: int = 4
    luggage: Optional[str] = None
    notes: Optional[str] = None
    trip_mode: bool = False
    trip_status: str = "planning"
    status: str = "open"
    created_at: datetime
    updated_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    meeting_point: Optional[dict] = None
    fare: Optional[dict] = None
    member_statuses: Dict[str, str] = Field(default_factory=dict)
    trip_conversation_id: Optional[str] = None
    recurring_template_id: Optional[str] = None
    user_rating_avg: Optional[float] = None
    user_rating_count: int = 0
    user_badges: List[dict] = Field(default_factory=list)
    user_college_id: Optional[dict] = None
    confirmed_travelers: List[ConfirmedTraveler] = Field(default_factory=list)
    my_request_status: Optional[str] = None
