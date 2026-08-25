from datetime import datetime, timedelta, timezone

from helpers.roll_number_decoder import decode_roll_number
from services.match_service import _trust, route_similarity, score_match


def _pool(**overrides):
    base = {
        "from_location": "Mahindra University",
        "to_location": "RGI Airport",
        "travel_datetime": datetime.now(timezone.utc) + timedelta(hours=2),
        "gender_preference": "any",
        "companions": 0,
        "luggage": "1 suitcase",
        "trip_mode": False,
        "user_rating_avg": 8.0,
        "user_rating_count": 5,
        "user_badges": [],
        "user_college_id": None,
    }
    base.update(overrides)
    return base


def test_mu_rgia_aliases_are_same_route():
    a = _pool()
    b = _pool(
        from_location="Mahindra University Campus",
        to_location="Rajiv Gandhi International Airport",
    )
    assert route_similarity(a, b) > 0.95


def test_rating_trust_uses_ten_point_scale():
    half = _trust(
        {
            "user_rating_avg": 5,
            "user_rating_count": 0,
            "user_badges": [],
            "user_college_id": None,
        }
    )
    perfect = _trust(
        {
            "user_rating_avg": 10,
            "user_rating_count": 0,
            "user_badges": [],
            "user_college_id": None,
        }
    )
    assert 0 < half < perfect
    assert perfect <= 1


def test_close_departure_scores_higher_than_far_departure():
    own = _pool()
    close = _pool(travel_datetime=own["travel_datetime"] + timedelta(minutes=15))
    far = _pool(travel_datetime=own["travel_datetime"] + timedelta(hours=3))
    close_score, _ = score_match(own, close)
    far_score, _ = score_match(own, far)
    assert close_score > far_score


def test_cam_roll_number_mapping_is_authoritative():
    decoded = decode_roll_number("SE22UCAM015")
    assert decoded is not None
    assert decoded["school_name"] == "School of Engineering"
    assert decoded["batch_year"] == 2022
    assert decoded["degree_level_name"] == "Undergraduate"
    assert decoded["branch_name"] == "Computational Mathematics"
    assert decoded["serial"] == "015"
