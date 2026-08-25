"""Compatibility scoring, smart feed ranking and automatic match materialization."""

import re
from datetime import datetime, timedelta, timezone
from difflib import SequenceMatcher
from typing import Any, Dict, List

from config.database import db


def _aware(dt: datetime) -> datetime:
    if dt.tzinfo is None or dt.tzinfo.utcoffset(dt) is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _norm(value: Any) -> str:
    text = str(value or "").casefold().strip()
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return " ".join(text.split())


_LOCATION_ALIASES = {
    "mu": "mahindra university",
    "mahindra uni": "mahindra university",
    "mahindra campus": "mahindra university",
    "mahindra university campus": "mahindra university",
    "rgia": "hyderabad airport",
    "rgi airport": "hyderabad airport",
    "rajiv gandhi airport": "hyderabad airport",
    "rajiv gandhi international airport": "hyderabad airport",
    "hyderabad international airport": "hyderabad airport",
    "hyd airport": "hyderabad airport",
}


def _canonical_location(value: Any) -> str:
    text = _norm(value)
    if not text:
        return ""
    if text in _LOCATION_ALIASES:
        return _LOCATION_ALIASES[text]
    replacements = {
        " intl ": " ",
        " international ": " ",
        " terminal ": " ",
        " campus ": " ",
        " main gate ": " ",
        " pickup point ": " ",
    }
    padded = f" {text} "
    for old, new in replacements.items():
        padded = padded.replace(old, new)
    text = " ".join(padded.split())
    return _LOCATION_ALIASES.get(text, text)


def _sim(a: Any, b: Any) -> float:
    a_text, b_text = _canonical_location(a), _canonical_location(b)
    if not a_text or not b_text:
        return 0.0
    if a_text == b_text:
        return 1.0
    if a_text in b_text or b_text in a_text:
        return 0.94
    seq = SequenceMatcher(None, a_text, b_text).ratio()
    a_tokens, b_tokens = set(a_text.split()), set(b_text.split())
    union = a_tokens | b_tokens
    jaccard = len(a_tokens & b_tokens) / len(union) if union else 0.0
    return max(seq, jaccard)


def route_similarity(a: Dict[str, Any], b: Dict[str, Any]) -> float:
    return (
        _sim(a.get("from_location"), b.get("from_location"))
        + _sim(a.get("to_location"), b.get("to_location"))
    ) / 2


def _time_similarity(a: Dict[str, Any], b: Dict[str, Any]) -> float:
    try:
        minutes = abs((_aware(a["travel_datetime"]) - _aware(b["travel_datetime"])).total_seconds()) / 60
    except Exception:
        return 0.0
    if minutes <= 15:
        return 1.0
    if minutes <= 30:
        return 0.92
    if minutes <= 60:
        return 0.82
    if minutes <= 120:
        return 0.58
    if minutes <= 180:
        return 0.32
    return 0.0


def _gender_similarity(a: Dict[str, Any], b: Dict[str, Any]) -> float:
    ga, gb = _norm(a.get("user_gender")), _norm(b.get("user_gender"))
    for pref_source in (a, b):
        if pref_source.get("gender_preference") == "same":
            if not ga or not gb:
                return 0.55
            if ga != gb:
                return 0.0
    return 1.0


def _travel_similarity(a: Dict[str, Any], b: Dict[str, Any]) -> float:
    try:
        companion = max(0.0, 1.0 - min(abs(int(a.get("companions") or 0) - int(b.get("companions") or 0)), 3) / 4)
    except Exception:
        companion = 0.6
    la, lb = _norm(a.get("luggage")), _norm(b.get("luggage"))
    luggage = 0.65 if not la or not lb else (1.0 if la == lb else 0.72)
    return 0.55 * luggage + 0.45 * companion


def _trust(candidate: Dict[str, Any]) -> float:
    rating = candidate.get("user_rating_avg")
    count = int(candidate.get("user_rating_count") or 0)
    badges = len(candidate.get("user_badges") or [])
    verified = 1.0 if candidate.get("user_college_id") or any(
        b.get("id") == "verified" for b in candidate.get("user_badges") or []
    ) else 0.0
    rating_part = 0.0 if rating is None else min(float(rating) / 10.0, 1.0)
    return rating_part * 0.45 + min(count / 10, 1) * 0.20 + min(badges / 3, 1) * 0.15 + verified * 0.20


def score_match(a: Dict[str, Any], b: Dict[str, Any]) -> tuple[int, Dict[str, int]]:
    parts = {
        "route": round(route_similarity(a, b) * 35),
        "time": round(_time_similarity(a, b) * 25),
        "preferences": round(_gender_similarity(a, b) * 10),
        "travel_details": round(_travel_similarity(a, b) * 10),
        "trip_mode": round((1.0 if bool(a.get("trip_mode")) == bool(b.get("trip_mode")) else 0.55) * 5),
        "trust": round(_trust(b) * 15),
    }
    return max(0, min(99, sum(parts.values()))), parts


def _label(score: int) -> str:
    if score >= 90:
        return "Excellent fit"
    if score >= 80:
        return "Strong fit"
    if score >= 70:
        return "Good fit"
    return "Possible fit"


def _reasons(own: Dict[str, Any], candidate: Dict[str, Any], breakdown: Dict[str, int], delta_minutes: int) -> List[str]:
    reasons: List[str] = []
    if breakdown.get("route", 0) >= 31:
        reasons.append("Same route")
    elif breakdown.get("route", 0) >= 25:
        reasons.append("Very similar route")
    if delta_minutes <= 15:
        reasons.append("Leaving within 15 min")
    elif delta_minutes <= 30:
        reasons.append("Leaving within 30 min")
    elif delta_minutes <= 60:
        reasons.append("Leaving within an hour")
    if candidate.get("user_college_id"):
        reasons.append("Verified student")
    if candidate.get("user_rating_avg") is not None and candidate.get("user_rating_avg", 0) >= 8.5:
        reasons.append("Highly rated")
    if own.get("gender_preference") == "same" or candidate.get("gender_preference") == "same":
        if breakdown.get("preferences", 0) == 10:
            reasons.append("Preference match")
    return reasons[:4]


async def _blocked(user_id: str) -> set[str]:
    docs = await db.blocks.find({"$or": [{"blocker_id": user_id}, {"blocked_id": user_id}]}, {"_id": 0}).to_list(2000)
    return {d["blocked_id"] if d["blocker_id"] == user_id else d["blocker_id"] for d in docs}


async def _enrich(candidates: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    if not candidates:
        return candidates
    ids = list({c["user_id"] for c in candidates if c.get("user_id")})
    stats = await db.ratings.aggregate([
        {"$match": {"rated_user_id": {"$in": ids}}},
        {"$group": {"_id": "$rated_user_id", "avg": {"$avg": "$stars"}, "count": {"$sum": 1}}},
    ]).to_list(len(ids))
    stat_map = {s["_id"]: s for s in stats}
    users = await db.users.find(
        {"user_id": {"$in": ids}},
        {"_id": 0, "user_id": 1, "college_verified": 1, "roll_number": 1, "college_email": 1},
    ).to_list(len(ids))
    verified = {u["user_id"]: u for u in users if u.get("college_verified")}
    for candidate in candidates:
        stat = stat_map.get(candidate.get("user_id"))
        candidate["user_rating_avg"] = round(stat["avg"], 1) if stat else None
        candidate["user_rating_count"] = stat["count"] if stat else 0
        verified_user = verified.get(candidate.get("user_id"))
        candidate["user_college_id"] = ({"verified": True, "roll_number": verified_user.get("roll_number")} if verified_user else None)
    return candidates


async def smart_matches(user_id: str) -> List[Dict[str, Any]]:
    """Pure read: calculate matches without creating chats or notifications."""
    mine = await db.pools.find({"user_id": user_id, "status": "open"}, {"_id": 0}).to_list(100)
    if not mine:
        return []
    blocked = await _blocked(user_id)
    lo = min(_aware(p["travel_datetime"]) for p in mine) - timedelta(hours=3)
    hi = max(_aware(p["travel_datetime"]) for p in mine) + timedelta(hours=3)
    candidates = await db.pools.find({
        "user_id": {"$ne": user_id, "$nin": list(blocked)},
        "status": "open",
        "travel_datetime": {"$gte": lo, "$lte": hi},
    }, {"_id": 0}).to_list(500)
    await _enrich(candidates)
    results: Dict[str, Dict[str, Any]] = {}
    for candidate in candidates:
        best = None
        for own in mine:
            score, breakdown = score_match(own, candidate)
            if best is None or score > best[0]:
                best = (score, breakdown, own)
        if not best:
            continue
        score, breakdown, own = best
        if breakdown["route"] < 18 or breakdown["time"] < 8 or score < 52:
            continue
        delta = round(abs((_aware(candidate["travel_datetime"]) - _aware(own["travel_datetime"])).total_seconds() / 60))
        candidate["match_score"] = score
        candidate["match_label"] = _label(score)
        candidate["match_breakdown"] = breakdown
        candidate["matched_pool_id"] = own.get("pool_id")
        candidate["match_time_delta_minutes"] = delta
        candidate["match_reasons"] = _reasons(own, candidate, breakdown, delta)
        results[candidate["pool_id"]] = candidate
    return sorted(results.values(), key=lambda x: (x.get("match_score", 0), -x.get("match_time_delta_minutes", 999)), reverse=True)


async def materialize_matches_for_pool(pool: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Create shared chats + notifications for matches caused by one pool."""
    if not pool or not pool.get("pool_id") or not pool.get("user_id"):
        return []
    try:
        matches = await smart_matches(pool["user_id"])
        relevant = [m for m in matches if m.get("matched_pool_id") == pool["pool_id"]]
        if not relevant:
            return []
        from services.messages_service import ensure_trip_conversation
        for match in relevant:
            try:
                conversation = await ensure_trip_conversation(match["pool_id"], [pool["user_id"]])
                match["conversation_id"] = conversation["conversation_id"]
                match["conversation_name"] = conversation["name"]
            except Exception:
                pass
        from services.notification_service import send_match_notifications
        await send_match_notifications(pool, relevant)
        return relevant
    except Exception:
        import logging
        logging.getLogger("unipool.match").exception("Could not materialize matches for pool %s", pool.get("pool_id"))
        return []


async def rank_pool_feed(user: Dict[str, Any], pools: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    mine = await db.pools.find({"user_id": user["user_id"], "status": "open"}, {"_id": 0}).to_list(100)
    if not mine:
        pools.sort(key=lambda x: _aware(x["travel_datetime"]))
        return pools
    await _enrich(pools)
    for pool in pools:
        best_score, best_breakdown, best_own = 0, {}, None
        for own in mine:
            score, breakdown = score_match(own, pool)
            if score > best_score:
                best_score, best_breakdown, best_own = score, breakdown, own
        pool["feed_score"] = best_score
        pool["match_score"] = best_score
        pool["match_label"] = _label(best_score)
        pool["match_breakdown"] = best_breakdown
        if best_own:
            delta = round(abs((_aware(pool["travel_datetime"]) - _aware(best_own["travel_datetime"])).total_seconds() / 60))
            pool["match_time_delta_minutes"] = delta
            pool["match_reasons"] = _reasons(best_own, pool, best_breakdown, delta)
    return sorted(pools, key=lambda x: (x.get("feed_score", 0), -_aware(x["travel_datetime"]).timestamp()), reverse=True)
