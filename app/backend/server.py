"""Legacy UniPool ASGI entry point.

The production backend is the modular FastAPI application in ``app.py``.
Keeping this tiny compatibility module means old Render start commands such as
``uvicorn server:app`` serve the same canonical routers instead of the stale
81k-line monolith that previously diverged from matching, chat and college-ID
logic.
"""

try:
    from .app import app
except ImportError:
    from app import app

__all__ = ["app"]
