"""
Models package for UniPool backend.
Exports all Pydantic models and database document structures.
"""

# Import from submodules to make them available at package level
from .user import *
from .pool import *
from .auth import *
from .response import *

__all__ = [
    # User models
    "UserOut", "UserProfileUpdate", "SignupRequest", "LoginRequest",
    "CollegeVerifyStart", "CollegeVerifyConfirm", "UserDocument", "UserResponse",

    # Pool models
    "PoolRequestCreate", "PoolRequestUpdate", "PoolDocument", "PoolResponse",
    "ConfirmedTraveler",

    # Auth models
    "GoogleSignIn", "SessionExchange", "RatingCreate", "MessageCreate",
    "PushSubscribe", "ReportCreate", "GameScoreSubmit", "UserRate",
    "MessageResponse", "ReportResponse", "GameLeaderboardEntry",
    "AdminStatsResponse", "SessionDocument", "RatingDocument", "BlockDocument",
    "JoinRequestDocument", "MessageDocument", "PushSubscriptionDocument",
    "ReportDocument", "GameScoreDocument",

    # Response models
    "BaseResponse", "PaginatedResponse", "IDResponse", "MessageResponse", "HealthResponse"
]