import pytest
from pydantic import ValidationError

from models.user import UserProfileUpdate


def test_profile_phone_accepts_exactly_ten_digits():
    profile = UserProfileUpdate(phone="9876543210")
    assert profile.phone == "9876543210"


@pytest.mark.parametrize("value", ["98765abc10", "987654321", "98765432101", "+919876543210", "98765 43210"])
def test_profile_phone_rejects_non_ten_digit_values(value):
    with pytest.raises(ValidationError):
        UserProfileUpdate(phone=value)


def test_profile_blood_group_is_normalized():
    profile = UserProfileUpdate(blood_group="ab+")
    assert profile.blood_group == "AB+"


@pytest.mark.parametrize("value", ["A", "AB", "O positive", "C+", "hello"])
def test_profile_blood_group_rejects_invalid_values(value):
    with pytest.raises(ValidationError):
        UserProfileUpdate(blood_group=value)
