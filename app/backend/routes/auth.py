"""Authentication routes for UniPool."""

from fastapi import APIRouter, HTTPException, Header, Request
from typing import Optional
import logging

from services.auth_service import (
    signup_user, login_user, google_sign_in, logout_user, get_current_user,
    verify_turnstile,
)
from services.user_service import start_college_verification, confirm_college_verification
from helpers.college_helper import sync_user_college_profile
from models.auth import GoogleSignIn
from models.user import SignupRequest, LoginRequest, CollegeVerifyStart, CollegeVerifyConfirm
from models.response import BaseResponse

logger = logging.getLogger("unipool.routes.auth")
router = APIRouter(prefix="/auth", tags=["authentication"])


async def _sync_result_user(result: dict) -> dict:
    if result and result.get("user"):
        result["user"] = await sync_user_college_profile(result["user"])
    return result


@router.post("/signup", response_model=dict)
async def signup(body: SignupRequest, request: Request):
    try:
        if not await verify_turnstile(body.turnstile_token, request.client.host if request.client else None):
            raise HTTPException(status_code=400, detail="Bot check failed - please try again.")
        return await _sync_result_user(await signup_user(body))
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("Signup failed: %s", e)
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/login", response_model=dict)
async def login(body: LoginRequest, request: Request):
    try:
        if not await verify_turnstile(body.turnstile_token, request.client.host if request.client else None):
            raise HTTPException(status_code=400, detail="Bot check failed - please try again.")
        return await _sync_result_user(await login_user(body))
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("Login failed: %s", e)
        raise HTTPException(status_code=401, detail=str(e))


@router.post("/google", response_model=dict)
async def google_sign_in_route(body: GoogleSignIn):
    try:
        return await _sync_result_user(await google_sign_in(body))
    except RuntimeError as e:
        logger.error("Google sign-in configuration error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
    except ValueError as e:
        logger.warning("Google sign-in rejected: %s", e)
        raise HTTPException(status_code=401, detail=str(e))
    except Exception:
        logger.exception("Unexpected Google sign-in failure")
        raise HTTPException(status_code=500, detail="Google sign-in failed")


@router.get("/me", response_model=dict)
async def get_current_user_info(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    try:
        user = await get_current_user(authorization)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired session")
        return await sync_user_college_profile(user)
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("Get current user failed: %s", e)
        raise HTTPException(status_code=401, detail=str(e))


@router.post("/logout", response_model=BaseResponse)
async def logout_route(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    try:
        token = authorization.split(" ", 1)[1].strip() if authorization.lower().startswith("bearer ") else authorization
        if not await logout_user(token):
            raise HTTPException(status_code=401, detail="Invalid session")
        return BaseResponse()
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("Logout failed: %s", e)
        raise HTTPException(status_code=401, detail=str(e))


@router.post("/profile/verify-college-id/start", response_model=BaseResponse)
async def verify_college_id_start(body: CollegeVerifyStart, authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    try:
        user = await get_current_user(authorization)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired session")
        if not await start_college_verification(user["user_id"], body):
            raise HTTPException(status_code=500, detail="Failed to send verification email")
        return BaseResponse()
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("College verification start failed: %s", e)
        if "Please enter your" in str(e) or "Couldn't recognize" in str(e) or "already verified" in str(e):
            raise HTTPException(status_code=400, detail=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/profile/verify-college-id/confirm", response_model=dict)
async def verify_college_id_confirm(body: CollegeVerifyConfirm, authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    try:
        user = await get_current_user(authorization)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired session")
        result = await confirm_college_verification(user["user_id"], body)
        # Return the corrected decoded profile in the same response so the ID
        # card updates immediately after verification.
        refreshed = await get_current_user(authorization)
        if refreshed:
            result["user"] = await sync_user_college_profile(refreshed)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("College verification confirm failed: %s", e)
        if any(text in str(e) for text in ("No verification request found", "expired", "Too many attempts", "Invalid verification code")):
            raise HTTPException(status_code=400, detail=str(e))
        raise HTTPException(status_code=500, detail=str(e))


__all__ = ["router"]
