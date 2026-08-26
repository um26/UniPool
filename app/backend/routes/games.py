"""Game routes for UniPool Time-pass."""

import logging
import sys
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Header, HTTPException, Query

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from models.auth import GameScoreSubmit
from services.admin_service import submit_game_score, get_game_leaderboard
from services.trivia_service import get_trivia_questions

logger = logging.getLogger("unipool.routes.games")
router = APIRouter(prefix="/games", tags=["games"])


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict | None:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    from services.auth_service import get_current_user as get_user_from_session
    return await get_user_from_session(authorization)


@router.post("/score", response_model=dict)
async def submit_game_score_endpoint(
    body: GameScoreSubmit,
    authorization: Optional[str] = Header(None),
):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    user = await get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    try:
        return await submit_game_score(user, body.dict())
    except Exception as exc:
        logger.warning("Submit game score failed: %s", exc)
        if "Unknown game" in str(exc):
            raise HTTPException(status_code=404, detail=str(exc))
        raise HTTPException(status_code=500, detail="Couldn't save game score")


@router.get("/leaderboard/{game}", response_model=List[dict])
async def get_game_leaderboard_endpoint(
    game: str,
    authorization: Optional[str] = Header(None),
):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    try:
        return await get_game_leaderboard(game)
    except Exception as exc:
        logger.warning("Get game leaderboard failed: %s", exc)
        if "Unknown game" in str(exc):
            raise HTTPException(status_code=404, detail=str(exc))
        raise HTTPException(status_code=500, detail="Couldn't load leaderboard")


@router.get("/trivia", response_model=List[dict])
async def get_trivia_endpoint(
    authorization: Optional[str] = Header(None),
    exclude: Optional[str] = Query(None, max_length=2500),
    count: int = Query(8, ge=5, le=12),
):
    """Return a varied trivia round, excluding recently-seen question ids."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    user = await get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    try:
        excluded = [item for item in (exclude or "").split(",") if item]
        return await get_trivia_questions(excluded, count=count)
    except Exception as exc:
        logger.warning("Get trivia failed: %s", exc)
        raise HTTPException(status_code=500, detail="Couldn't load trivia")


__all__ = ["router"]
