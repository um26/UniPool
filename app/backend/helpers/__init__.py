"""
Helpers package for UniPool backend.
Exports all helper functions and utilities.
"""

# Import from submodules to make them available at package level
from .auth_helper import *
from .college_helper import *
from .email_helper import *
from .badge_helper import *
from .push_helper import *

__all__ = [
    # Auth helper
    "_hash_password", "_verify_password", "_create_session_token",
    "_create_session_for_user", "_with_admin_flag",

    # College helper
    "_is_verified_domain", "_decode_roll_number", "_college_info_map",
    "_compute_badges", "_rides_completed_map", "_attach_badges",

    # Email helper
    "send_email", "_send_via_sendgrid", "_send_via_resend", "_send_via_gmail_smtp",
    "match_email_html", "join_request_email_html", "college_verification_email_html",

    # Badge helper
    "_compute_badges", "_is_verified_domain",

    # Push helper
    "send_push", "send_push_to_multiple"
]