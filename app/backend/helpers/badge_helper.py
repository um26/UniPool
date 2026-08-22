"""
Badge helper functions.
Contains utilities for computing and managing user badges.
"""

from config.settings import DEFAULT_VERIFIED_SUFFIXES, VERIFIED_EMAIL_DOMAINS

def _is_verified_domain(email: str) -> bool:
    """
    Check if email domain is verified for automatic student badge.

    Args:
        email: Email address to check

    Returns:
        True if domain is verified, False otherwise
    """
    email = (email or "").lower()
    if "@" not in email:
        return False
    domain = email.split("@", 1)[1]
    if domain in VERIFIED_EMAIL_DOMAINS:
        return True
    return any(email.endswith(suffix) for suffix in DEFAULT_VERIFIED_SUFFIXES)

def _compute_badges(college_verified: bool, rating_avg: float | None,
                   rating_count: int, rides_completed: int) -> list:
    """
    Compute user badges based on verification status, ratings, and ride history.

    Args:
        college_verified: Whether user has verified college ID
        rating_avg: Average rating score (1-10)
        rating_count: Number of ratings received
        rides_completed: Number of completed rides

    Returns:
        List of badge dictionaries
    """
    badges = []
    if college_verified:
        badges.append({"id": "verified", "label": "Verified Student", "icon": "shield-checkmark"})
    if rating_avg is not None and rating_avg >= 8.5 and rating_count >= 3:
        badges.append({"id": "top_rated", "label": "Top Rated", "icon": "trophy"})
    if rides_completed >= 5:
        badges.append({"id": "frequent", "label": "Frequent Traveller", "icon": "flame"})
    return badges