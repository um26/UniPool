"""
Services package for UniPool backend.
Exports all service functions and business logic.
"""

# Import from submodules to make them available at package level
from .auth_service import *
from .pool_service import *
from .user_service import *
from .notification_service import *
from .messages_service import *
from .admin_service import *

__all__ = [
    # Auth service
    "signup_user", "login_user", "google_sign_in", "logout_user",
    "get_current_user", "_ensure_aware", "_now_utc",

    # Pool service
    "create_pool", "get_pool", "list_pools", "my_pools",
    "close_pool", "reopen_pool", "delete_pool", "_blocked_user_ids",
    "_is_blocked_pair", "_enrich_with_ratings", "_attach_requester_ratings",
    "_enrich_with_my_request_status", "_clean", "_fmt_ist",

    # User service
    "update_profile", "start_college_verification", "confirm_college_verification",
    "submit_rating", "get_user_ratings", "can_rate", "block_user",
    "unblock_user", "list_blocked",

    # Notification service
    "send_email_notification", "send_push_notification",
    "send_match_notifications", "_leaving_soon_reminder_loop",

    # Messages service
    "send_message", "get_conversations", "get_messages_with_user",
    "send_typing_indicator", "get_typing_status",

    # Admin service
    "require_admin", "get_admin_stats", "list_admin_pools",
    "admin_delete_pool", "migrate_ratings_scale", "refresh_college_info",
    "list_admin_reports", "admin_resolve_report", "_leaderboard_for",
    "submit_game_score", "get_game_leaderboard", "get_trivia_questions"
]