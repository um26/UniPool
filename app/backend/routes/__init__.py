"""Routes package for the UniPool backend."""

from .auth import router as auth_router
from .pools import router as pools_router
from .profile import router as profile_router
from .requests import router as requests_router
from .messages import router as messages_router
from .admin import router as admin_router
from .games import router as games_router
from .matches import router as matches_router
from .users import router as users_router
from .compat import router as compat_router
from .mobility import router as mobility_router
from .network import router as network_router
from .experience import router as experience_router

__all__ = [
    "auth_router",
    "pools_router",
    "profile_router",
    "requests_router",
    "messages_router",
    "admin_router",
    "games_router",
    "matches_router",
    "users_router",
    "compat_router",
    "mobility_router",
    "network_router",
    "experience_router",
]
