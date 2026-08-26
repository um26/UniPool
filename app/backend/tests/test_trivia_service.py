import asyncio

from config.trivia_bank import TRIVIA_BANK
from services.trivia_service import get_trivia_questions


def test_trivia_bank_is_large_and_well_formed():
    assert len(TRIVIA_BANK) >= 75
    ids = [item["id"] for item in TRIVIA_BANK]
    assert len(ids) == len(set(ids))
    for item in TRIVIA_BANK:
        assert item["q"].strip()
        assert len(item["options"]) == 4
        assert 0 <= item["answer"] < len(item["options"])
        assert item.get("category")


def test_trivia_round_excludes_recent_questions():
    excluded = [item["id"] for item in TRIVIA_BANK[:40]]
    round_questions = asyncio.run(get_trivia_questions(excluded, count=8))
    assert len(round_questions) == 8
    assert not {item["id"] for item in round_questions}.intersection(excluded)


def test_trivia_round_has_category_variety():
    round_questions = asyncio.run(get_trivia_questions([], count=8))
    categories = {item["category"] for item in round_questions}
    assert len(categories) >= 5
