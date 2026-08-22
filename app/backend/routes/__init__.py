"""
Routes package for UniPool backend.
Exports all API route routers.
"""

# Import from submodules to make them available at package level
from .auth import router as auth_router
from .pools import router as pools_router
from .profile import router as profile_router
from .requests import router as requests_router
from .messages import router as messages_router
from .admin import router as admin_router
from .games import router as games_router
from .matches import router as matches_router
from .users import router as users_router

__all__ = [
    "auth_router",
    "pools_router",
    "profile_router",
    "requests_router",
    "messages_router",
    "admin_router",
    "games_router",
    "matches_router",
    "users_router"
]