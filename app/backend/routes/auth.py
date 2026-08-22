"""
Authentication routes.
Handles user login, registration, and session management.
"""

import sys
from pathlib import Path

# Add the backend directory to the Python path so we can import from it
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from fastapi import APIRouter, HTTPException, Header, Request
from services.auth_service import (
    signup_user, login_user, google_sign_in, logout_user, get_current_user,
    verify_turnstile,
)
from services.user_service import start_college_verification, confirm_college_verification
from models.auth import GoogleSignIn
from models.user import SignupRequest, LoginRequest, CollegeVerifyStart, CollegeVerifyConfirm
from models.response import BaseResponse
import logging
from typing import Optional

logger = logging.getLogger("unipool.routes.auth")

# Create router
router = APIRouter(prefix="/auth", tags=["authentication"])


@router.post("/signup", response_model=dict)
async def signup(body: SignupRequest, request: Request):
    """Register a new user with email and password."""
    try:
        if not await verify_turnstile(body.turnstile_token, request.client.host if request.client else None):
            raise HTTPException(status_code=400, detail="Bot check failed - please try again.")
        result = await signup_user(body)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Signup failed: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/login", response_model=dict)
async def login(body: LoginRequest, request: Request):
    """Authenticate user with email/username and password."""
    try:
        if not await verify_turnstile(body.turnstile_token, request.client.host if request.client else None):
            raise HTTPException(status_code=400, detail="Bot check failed - please try again.")
        result = await login_user(body)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Login failed: {e}")
        raise HTTPException(status_code=401, detail=str(e))


@router.post("/google", response_model=dict)
async def google_sign_in_route(body: GoogleSignIn):
    """Authenticate or register user via Google OAuth."""
    try:
        result = await google_sign_in(body)
        return result
    except RuntimeError as e:
        logger.error("Google sign-in configuration error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
    except ValueError as e:
        logger.warning("Google sign-in rejected: %s", e)
        raise HTTPException(status_code=401, detail=str(e))
    except Exception as e:
        logger.exception("Unexpected Google sign-in failure")
        raise HTTPException(status_code=500, detail="Google sign-in failed")


@router.get("/me", response_model=dict)
async def get_current_user_info(authorization: Optional[str] = Header(None)):
    """Get current user information from session token."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    try:
        user = await get_current_user(authorization)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired session")
        return user
    except Exception as e:
        logger.warning(f"Get current user failed: {e}")
        raise HTTPException(status_code=401, detail=str(e))


@router.post("/logout", response_model=BaseResponse)
async def logout_route(authorization: Optional[str] = Header(None)):
    """Log out the current user."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    try:
        token = authorization.split(" ", 1)[1].strip() if authorization.startswith("Bearer ") else authorization
        success = await logout_user(token)
        if not success:
            raise HTTPException(status_code=401, detail="Invalid session")
        return BaseResponse()
    except Exception as e:
        logger.warning(f"Logout failed: {e}")
        raise HTTPException(status_code=401, detail=str(e))


# College verification routes
@router.post("/profile/verify-college-id/start", response_model=BaseResponse)
async def verify_college_id_start(
    body: CollegeVerifyStart,
    authorization: Optional[str] = Header(None)
):
    """Start college verification process."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    try:
        user = await get_current_user(authorization)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired session")

        success = await start_college_verification(user["user_id"], body)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to send verification email")

        return BaseResponse()
    except Exception as e:
        logger.warning(f"College verification start failed: {e}")
        if "Please enter your" in str(e) or "Couldn't recognize" in str(e) or "already verified" in str(e):
            raise HTTPException(status_code=400, detail=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/profile/verify-college-id/confirm", response_model=dict)
async def verify_college_id_confirm(
    body: CollegeVerifyConfirm,
    authorization: Optional[str] = Header(None)
):
    """Confirm college verification with the provided code."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    try:
        user = await get_current_user(authorization)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired session")

        result = await confirm_college_verification(user["user_id"], body)
        return result
    except Exception as e:
        logger.warning(f"College verification confirm failed: {e}")
        if "No verification request found" in str(e) or "expired" in str(e) or "Too many attempts" in str(e) or "Invalid verification code" in str(e):
            raise HTTPException(status_code=400, detail=str(e))
        raise HTTPException(status_code=500, detail=str(e))


# Export the router
__all__ = ["router"]