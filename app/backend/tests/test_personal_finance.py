import pytest
from fastapi import HTTPException

from routes.personal_finance import month_bounds


def test_month_bounds_rolls_to_next_month():
    start, end = month_bounds("2026-08")
    assert start.isoformat().startswith("2026-08-01")
    assert end.isoformat().startswith("2026-09-01")


def test_month_bounds_rolls_year_at_december():
    start, end = month_bounds("2026-12")
    assert start.year == 2026 and start.month == 12
    assert end.year == 2027 and end.month == 1


def test_month_bounds_rejects_invalid_month():
    with pytest.raises(HTTPException):
        month_bounds("August")
