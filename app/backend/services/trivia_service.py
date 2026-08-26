"""Travel trivia selection for UniPool Time-pass."""

import random
from collections import defaultdict
from typing import Iterable, List, Dict, Any

from config.trivia_bank import TRIVIA_BANK


def _clean_excluded(exclude_ids: Iterable[str] | None) -> set[str]:
    if not exclude_ids:
        return set()
    return {str(item).strip() for item in exclude_ids if str(item).strip()}


def _balanced_sample(pool: list[dict], count: int) -> list[dict]:
    """Prefer category variety before filling remaining slots randomly."""
    if count <= 0 or not pool:
        return []

    by_category: dict[str, list[dict]] = defaultdict(list)
    for item in pool:
        by_category[item.get("category") or "other"].append(item)
    for items in by_category.values():
        random.shuffle(items)

    categories = list(by_category)
    random.shuffle(categories)
    picked: list[dict] = []

    # First pass: one from as many categories as possible.
    for category in categories:
        if len(picked) >= count:
            break
        items = by_category[category]
        if items:
            picked.append(items.pop())

    # Fill the rest from all unused questions.
    remaining = [item for items in by_category.values() for item in items]
    random.shuffle(remaining)
    picked.extend(remaining[: max(0, count - len(picked))])
    random.shuffle(picked)
    return picked


async def get_trivia_questions(
    exclude_ids: Iterable[str] | None = None,
    count: int = 8,
) -> List[Dict[str, Any]]:
    """Return a varied round while avoiding recently-seen question ids.

    If the caller excludes nearly the whole bank, the selector gracefully
    falls back to the full bank rather than returning an undersized round.
    """
    requested = max(5, min(int(count or 8), 12))
    excluded = _clean_excluded(exclude_ids)
    available = [item for item in TRIVIA_BANK if item["id"] not in excluded]

    if len(available) < requested:
        available = list(TRIVIA_BANK)

    return _balanced_sample(available, requested)


__all__ = ["get_trivia_questions"]
