"""Pool-related Pydantic models and MongoDB document schemas."""

from datetime import datetime
from typing import Literal, Optional, List

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


GenderPreference = Literal["any", "same"]


class PoolRequestCreate(BaseModel):
    """Request to create a new pool."""

    from_location: str = Field(..., min_length=2, max_length=120)
    to_location: str = Field(..., min_length=2, max_length=120)
    travel_datetime: datetime
    gender_preference: GenderPreference = "any"
    companions: int = Field(default=0, ge=0, le=6)
    seats_total: int = Field(default=4, ge=2, le=8)
    luggage: Optional[str] = Field(default=None, max_length=80)
    notes: Optional[str] = Field(default=None, max_length=240)
    trip_mode: bool = False

    @field_validator("from_location", "to_location")
    @classmethod
    def normalize_location(cls, value: str) -> str:
        return " ".join(value.split()).strip()

    @model_validator(mode="after")
    def validate_capacity(self):
        # Owner + pre-existing companions must fit before anyone requests to join.
        if 1 + self.companions > self.seats_total:
            raise ValueError("Companions exceed the trip capacity")
        if self.from_location.casefold() == self.to_location.casefold():
            raise ValueError("Pickup and drop cannot be the same")
        return self


class PoolRequestUpdate(BaseModel):
    from_location: Optional[str] = Field(default=None, min_length=2, max_length=120)
    to_location: Optional[str] = Field(default=None, min_length=2, max_length=120)
    travel_datetime: Optional[datetime] = None
    gender_preference: Optional[GenderPreference] = None
    companions: Optional[int] = Field(default=None, ge=0, le=6)
    seats_total: Optional[int] = Field(default=None, ge=2, le=8)
    luggage: Optional[str] = Field(default=None, max_length=80)
    notes: Optional[str] = Field(default=None, max_length=240)
    trip_mode: Optional[bool] = None

    @field_validator("from_location", "to_location")
    @classmethod
    def normalize_optional_location(cls, value: Optional[str]) -> Optional[str]:
        return " ".join(value.split()).strip() if value is not None else value


class PoolDocument:
    @staticmethod
    def get_indexes():
        return [
            {"key": [("pool_id", 1)], "unique": True},
            {"key": [("from_location", 1), ("to_location", 1), ("travel_datetime", 1)]},
        ]


class ConfirmedTraveler(BaseModel):
    user_id: str
    name: str
    email: EmailStr


class PoolResponse(BaseModel):
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
    seats_total: int = 4
    seats_available: int = 0
    luggage: Optional[str] = None
    notes: Optional[str] = None
    trip_mode: bool = False
    status: str = "open"  # accepting requests: open | closed
    trip_status: str = "planning"  # planning | confirmed | in_progress | completed | cancelled
    created_at: datetime
    updated_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    user_rating_avg: Optional[float] = None
    user_rating_count: int = 0
    user_badges: List[dict] = []
    user_college_id: Optional[dict] = None
    confirmed_travelers: List[ConfirmedTraveler] = []
    my_request_status: Optional[str] = None
    trip_conversation_id: Optional[str] = None
    match_score: Optional[int] = None
    match_label: Optional[str] = None
    match_breakdown: Optional[dict] = None
    match_time_delta_minutes: Optional[int] = None
    match_reasons: List[str] = []
