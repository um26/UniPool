import pytest
from pydantic import ValidationError

from models.user import CollegeSignupConfirm, SignupRequest
from services.college_signup_service import _decode_email, is_mu_college_email


def test_mu_email_detection_is_exact_domain():
    assert is_mu_college_email("SE22UCAM015@mahindrauniversity.edu.in")
    assert is_mu_college_email("se22ucam015@mahindrauniversity.edu.in")
    assert not is_mu_college_email("se22ucam015@gmail.com")
    assert not is_mu_college_email("se22ucam015@mahindrauniversity.edu.in.evil.example")


def test_college_email_decodes_student_identity():
    decoded = _decode_email("se22ucam015@mahindrauniversity.edu.in")
    assert decoded["roll_number"] == "SE22UCAM015"
    assert decoded["branch_name"] == "Computational Mathematics"
    assert decoded["batch_year"] == 2022
    assert decoded["degree_level_name"] == "Undergraduate"


def test_college_signup_rejects_unknown_roll_format():
    with pytest.raises(ValueError, match="Couldn't recognize"):
        _decode_email("hello@mahindrauniversity.edu.in")


def test_college_signup_code_must_be_six_digits():
    assert CollegeSignupConfirm(challenge_id="abc", code="123456").code == "123456"
    with pytest.raises(ValidationError):
        CollegeSignupConfirm(challenge_id="abc", code="12A456")
    with pytest.raises(ValidationError):
        CollegeSignupConfirm(challenge_id="abc", code="12345")


def test_regular_signup_accepts_mu_email_as_a_normal_account():
    request = SignupRequest(
        email="se22ucam015@mahindrauniversity.edu.in",
        password="test-password",
        name="Test Student",
    )
    assert str(request.email) == "se22ucam015@mahindrauniversity.edu.in"


def test_signup_password_has_server_side_minimum():
    with pytest.raises(ValidationError):
        SignupRequest(email="student@example.com", password="short", name="Student")
    assert SignupRequest(email="student@example.com", password="long-enough", name="Student").password == "long-enough"
