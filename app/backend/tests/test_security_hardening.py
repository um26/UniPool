import json
from pathlib import Path

import pytest
from pydantic import ValidationError
from starlette.middleware.cors import CORSMiddleware

from app import app
from helpers.auth_helper import _hash_password, _verify_password
from models.user import PasswordSetRequest, SignupRequest


REPO_ROOT = Path(__file__).resolve().parents[3]


def test_cors_does_not_allow_every_origin():
    cors = next((m for m in app.user_middleware if m.cls is CORSMiddleware), None)
    assert cors is not None
    assert "*" not in cors.kwargs.get("allow_origins", [])
    assert "*" not in cors.kwargs.get("allow_methods", [])
    assert "*" not in cors.kwargs.get("allow_headers", [])


def test_mu_email_is_valid_for_regular_signup_contract():
    request = SignupRequest(
        email="se22ucam015@mahindrauniversity.edu.in",
        password="secure-pass-123",
        name="Test Student",
    )
    assert str(request.email).endswith("@mahindrauniversity.edu.in")


def test_password_setup_requires_a_real_password():
    request = PasswordSetRequest(new_password="new-password-123")
    assert request.current_password is None
    with pytest.raises(ValidationError):
        PasswordSetRequest(new_password="short")


def test_password_hash_round_trip_for_oauth_password_setup():
    hashed = _hash_password("new-password-123")
    assert hashed != "new-password-123"
    assert _verify_password("new-password-123", hashed)
    assert not _verify_password("wrong-password", hashed)


def test_public_landing_copy_has_no_em_dash():
    for relative in ("app/frontend/app/index.tsx", "app/frontend/app/+html.tsx"):
        text = (REPO_ROOT / relative).read_text(encoding="utf-8")
        assert "—" not in text, f"Avoid em dashes in public marketing copy: {relative}"


def test_vercel_has_basic_browser_security_headers():
    config = json.loads((REPO_ROOT / "vercel.json").read_text(encoding="utf-8"))
    headers = {
        item["key"]: item["value"]
        for block in config.get("headers", [])
        for item in block.get("headers", [])
    }
    assert headers.get("X-Content-Type-Options") == "nosniff"
    assert headers.get("X-Frame-Options") == "DENY"
    assert headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"
    assert "geolocation=(self)" in headers.get("Permissions-Policy", "")


def test_predictable_test_session_recipe_is_not_committed():
    assert not (REPO_ROOT / "app/memory/test_credentials.md").exists()
