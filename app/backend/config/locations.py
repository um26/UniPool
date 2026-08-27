"""Canonical travel locations and aliases used across UniPool.

The goal is not to be a full maps database. These are high-frequency university,
airport and railway nodes where deterministic identity improves matching, maps,
search, alerts and analytics. Unknown places still work as free text.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

LOCATIONS: List[Dict[str, Any]] = [
    {"id": "mu", "name": "Mahindra University", "short_name": "MU", "city": "Hyderabad", "kind": "university", "lat": 17.6212, "lng": 78.4827,
     "aliases": ["mu", "mahindra uni", "mahindra university", "mahindra campus", "campus"]},
    {"id": "hyd", "name": "Rajiv Gandhi International Airport", "short_name": "RGIA · HYD", "city": "Hyderabad", "kind": "airport", "lat": 17.2403, "lng": 78.4294,
     "aliases": ["rgia", "rgi airport", "rajiv gandhi airport", "rajiv gandhi international airport", "hyderabad airport", "hyderabad international airport", "hyd airport", "hyd", "shamshabad airport"]},
    {"id": "sc", "name": "Secunderabad Junction", "short_name": "SC", "city": "Hyderabad", "kind": "railway", "lat": 17.4337, "lng": 78.5018,
     "aliases": ["secunderabad", "secunderabad station", "secunderabad railway station", "secunderabad junction", "sc station", "sc"]},
    {"id": "hyb", "name": "Hyderabad Deccan Nampally", "short_name": "HYB", "city": "Hyderabad", "kind": "railway", "lat": 17.3924, "lng": 78.4673,
     "aliases": ["nampally", "nampally station", "hyderabad deccan", "hyderabad railway station", "hyb"]},
    {"id": "kcg", "name": "Kacheguda Railway Station", "short_name": "KCG", "city": "Hyderabad", "kind": "railway", "lat": 17.3890, "lng": 78.4983,
     "aliases": ["kacheguda", "kacheguda station", "kacheguda railway station", "kcg"]},
    {"id": "hitech", "name": "HITEC City", "short_name": "HITEC City", "city": "Hyderabad", "kind": "city", "lat": 17.4435, "lng": 78.3772,
     "aliases": ["hitec", "hitec city", "hi tech city", "cyberabad"]},
    {"id": "gachibowli", "name": "Gachibowli", "short_name": "Gachibowli", "city": "Hyderabad", "kind": "city", "lat": 17.4401, "lng": 78.3489,
     "aliases": ["gachibowli"]},
    {"id": "del", "name": "Indira Gandhi International Airport", "short_name": "IGIA · DEL", "city": "Delhi", "kind": "airport", "lat": 28.5562, "lng": 77.1000,
     "aliases": ["igia", "indira gandhi airport", "indira gandhi international airport", "delhi airport", "del airport", "del"]},
    {"id": "iitd", "name": "IIT Delhi", "short_name": "IITD", "city": "Delhi", "kind": "university", "lat": 28.5450, "lng": 77.1926,
     "aliases": ["iitd", "iit delhi", "indian institute of technology delhi"]},
    {"id": "ndls", "name": "New Delhi Railway Station", "short_name": "NDLS", "city": "Delhi", "kind": "railway", "lat": 28.6422, "lng": 77.2197,
     "aliases": ["new delhi station", "new delhi railway station", "ndls"]},
    {"id": "bom", "name": "Chhatrapati Shivaji Maharaj International Airport", "short_name": "BOM", "city": "Mumbai", "kind": "airport", "lat": 19.0896, "lng": 72.8656,
     "aliases": ["mumbai airport", "bom", "csia", "chhatrapati shivaji airport"]},
    {"id": "blr", "name": "Kempegowda International Airport", "short_name": "BLR", "city": "Bengaluru", "kind": "airport", "lat": 13.1986, "lng": 77.7066,
     "aliases": ["bangalore airport", "bengaluru airport", "kempegowda airport", "blr"]},
    {"id": "maa", "name": "Chennai International Airport", "short_name": "MAA", "city": "Chennai", "kind": "airport", "lat": 12.9941, "lng": 80.1709,
     "aliases": ["chennai airport", "maa"]},
    {"id": "ccu", "name": "Netaji Subhas Chandra Bose International Airport", "short_name": "CCU", "city": "Kolkata", "kind": "airport", "lat": 22.6547, "lng": 88.4467,
     "aliases": ["kolkata airport", "calcutta airport", "ccu"]},
    {"id": "pnq", "name": "Pune Airport", "short_name": "PNQ", "city": "Pune", "kind": "airport", "lat": 18.5793, "lng": 73.9089,
     "aliases": ["pune airport", "pnq"]},
    {"id": "goi", "name": "Goa International Airport (Dabolim)", "short_name": "GOI", "city": "Goa", "kind": "airport", "lat": 15.3808, "lng": 73.8314,
     "aliases": ["goa airport", "dabolim airport", "goi"]},
]

_BY_ID = {item["id"]: item for item in LOCATIONS}


def _norm(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (value or "").strip().casefold()).strip()


def resolve_location(value: str) -> Optional[Dict[str, Any]]:
    """Resolve a user-entered place to a known canonical location when possible."""
    needle = _norm(value)
    if not needle:
        return None
    if needle in _BY_ID:
        return dict(_BY_ID[needle])
    exact: Optional[Dict[str, Any]] = None
    fuzzy: Optional[Dict[str, Any]] = None
    for item in LOCATIONS:
        candidates = [item["name"], item["short_name"], *item.get("aliases", [])]
        normalized = [_norm(candidate) for candidate in candidates]
        if needle in normalized:
            exact = item
            break
        if len(needle) >= 4 and any(needle in candidate or candidate in needle for candidate in normalized if len(candidate) >= 4):
            fuzzy = fuzzy or item
    return dict(exact or fuzzy) if (exact or fuzzy) else None


def canonical_location(value: str) -> Dict[str, Any]:
    """Return a stable location payload while preserving unknown free-text places."""
    resolved = resolve_location(value)
    if resolved:
        return resolved
    display = " ".join((value or "").split()).strip()
    return {
        "id": None,
        "name": display,
        "short_name": display,
        "city": None,
        "kind": "custom",
        "lat": None,
        "lng": None,
        "aliases": [],
    }


def search_locations(query: str = "", limit: int = 12) -> List[Dict[str, Any]]:
    needle = _norm(query)
    if not needle:
        return [dict(item) for item in LOCATIONS[:limit]]
    ranked = []
    for item in LOCATIONS:
        values = [_norm(item["name"]), _norm(item["short_name"]), *[_norm(x) for x in item.get("aliases", [])]]
        score = 0
        if needle in values:
            score = 100
        elif any(v.startswith(needle) for v in values):
            score = 80
        elif any(needle in v for v in values):
            score = 60
        if score:
            ranked.append((score, item))
    ranked.sort(key=lambda pair: (-pair[0], pair[1]["name"]))
    return [dict(item) for _, item in ranked[:limit]]


def route_key(from_location: str, to_location: str) -> str:
    origin = canonical_location(from_location)
    destination = canonical_location(to_location)
    origin_key = origin["id"] or _norm(origin["name"])
    destination_key = destination["id"] or _norm(destination["name"])
    return f"{origin_key}::{destination_key}"
