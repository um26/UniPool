"""
Config package for UniPool backend.
Exports database connection and settings.
"""

from .database import client, db
from .settings import *

__all__ = ["client", "db"]