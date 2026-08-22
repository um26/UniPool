"""
User-related Pydantic models and MongoDB document schemas.
"""

from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from datetime import datetime

# Pydantic models for request/response validation
class UserOut(BaseModel):
    """Public user information (safe to expose)"""
    user_id: str
    email: EmailStr
    name: str
    picture: Optional[str] = None

class UserProfileUpdate(BaseModel):
    """Fields that can be updated in user profile"""
    gender: Optional[str] = None  # "male" | "female" | "other"
    phone: Optional[str] = None
    blood_group: Optional[str] = None

class SignupRequest(BaseModel):
    """User signup request"""
    email: EmailStr
    password: str
    name: str
    username: Optional[str] = None
    turnstile_token: Optional[str] = None

class LoginRequest(BaseModel):
    """User login request"""
    identifier: str  # email or username
    password: str
    turnstile_token: Optional[str] = None

class CollegeVerifyStart(BaseModel):
    """Request to start college verification"""
    college_email: EmailStr

class CollegeVerifyConfirm(BaseModel):
    """Request to confirm college verification with code"""
    code: str

# MongoDB document representation (for internal use)
class UserDocument:
    """MongoDB document structure for users collection"""
    @staticmethod
    def get_indexes():
        """Define database indexes for users collection"""
        return [
            {"key": [("email", 1)], "unique": True},
            {"key": [("user_id", 1)], "unique": True},
            {"key": [("username", 1)], "unique": True, "sparse": True},
            {"key": [("roll_number", 1)], "sparse": True}
        ]

# Response models with computed fields
class UserResponse(BaseModel):
    """Complete user response with computed fields"""
    user_id: str
    email: EmailStr
    name: str
    picture: Optional[str] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    blood_group: Optional[str] = None
    is_admin: bool = False
    college_verified: bool = False
    roll_number: Optional[str] = None
    school_name: Optional[str] = None
    degree_level_name: Optional[str] = None
    branch_name: Optional[str] = None
    batch_year: Optional[int] = None
    rating_avg: Optional[float] = None
    rating_count: int = 0
    rides_completed: int = 0
    badges: List[dict] = []
    created_at: datetime
    last_login: Optional[datetime] = None
    last_seen: Optional[datetime] = None