"""
Configuration settings for UniPool backend.
Loads environment variables and defines application constants.
"""

import os
from datetime import timezone, timedelta
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / ".env")

# ---------- Database Configuration ----------
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

# ---------- Google OAuth Configuration ----------
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")

# ---------- Email Service Configuration ----------
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
RESEND_FROM_EMAIL = os.environ.get("RESEND_FROM_EMAIL", "onboarding@resend.dev")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "UniPool")
GMAIL_ADDRESS = os.environ.get("GMAIL_ADDRESS", "")
GMAIL_APP_PASSWORD = os.environ.get("GMAIL_APP_PASSWORD", "")
SENDGRID_API_KEY = os.environ.get("SENDGRID_API_KEY", "")
SENDGRID_FROM_EMAIL = os.environ.get("SENDGRID_FROM_EMAIL", GMAIL_ADDRESS)
TURNSTILE_SECRET_KEY = os.environ.get("TURNSTILE_SECRET_KEY", "")

# ---------- Admin Configuration ----------
ADMIN_EMAILS = {
    e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()
}

# Domains that auto-grant the "Verified Student" badge. Generic Indian/global
# academic suffixes are trusted by default; ADD your specific college domain
# via the VERIFIED_EMAIL_DOMAINS env var (comma-separated, e.g. "mycollege.ac.in").
DEFAULT_VERIFIED_SUFFIXES = (".edu", ".edu.in", ".ac.in")
VERIFIED_EMAIL_DOMAINS = {
    d.strip().lower() for d in os.environ.get("VERIFIED_EMAIL_DOMAINS", "").split(",") if d.strip()
}

# Seed admin credentials for initial setup
SEED_ADMIN_EMAIL = os.environ.get("SEED_ADMIN_EMAIL", "admin@unipool.app")
SEED_ADMIN_USERNAME = os.environ.get("SEED_ADMIN_USERNAME", "admin")
SEED_ADMIN_PASSWORD = os.environ.get("SEED_ADMIN_PASSWORD", "securepassword123")

# ---------- VAPID Keys for Push Notifications ----------
VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY", "")
VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", "")
VAPID_SUBJECT = os.environ.get("VAPID_SUBJECT", "mailto:admin@unipool.app")

# ---------- Application Constants ----------
# Pool limits
MAX_OPEN_POOLS_PER_USER = int(os.environ.get("MAX_OPEN_POOLS_PER_USER", "5"))
MAX_POOLS_PER_HOUR = int(os.environ.get("MAX_POOLS_PER_HOUR", "10"))

# Session configuration
SESSION_EXPIRE_DAYS = int(os.environ.get("SESSION_EXPIRE_DAYS", "7"))

# Online status threshold (seconds)
ONLINE_THRESHOLD_SECONDS = int(os.environ.get("ONLINE_THRESHOLD_SECONDS", "60"))

# Typing indicator TTL (seconds)
TYPING_TTL_SECONDS = int(os.environ.get("TYPING_TTL_SECONDS", "4"))

# IST timezone (UTC+5:30)
IST = timezone(timedelta(hours=5, minutes=30))

# Allowed games for leaderboard
ALLOWED_GAMES = {"tap-plane", "memory-match", "word-scramble", "rickshaw-rush", "trivia"}
# For these games a LOWER score is better (e.g. fewer moves). Everything
# else defaults to higher-is-better.
LOWER_IS_BETTER = {"memory-match"}

# College ID verification
COLLEGE_EMAIL_DOMAIN = "mahindrauniversity.edu.in"
ROLL_NUMBER_RE = __import__('re').compile(r"^([a-z]{2})(\d{2})([ump])([a-z]+)(\d{3})$")

SCHOOL_CODES = {"se": "School of Engineering", "sm": "School of Management", "sl": "School of Law"}
DEGREE_LEVEL_NAMES = {"u": "Undergraduate", "m": "Masters", "p": "PhD"}
BRANCH_CODES = {
    "cam": "Computational and Mathematics",
    "cse": "CSE",
    "ari": "Artificial Intelligence",
    "cie": "Civil Engineering",
}

TRIVIA_QUESTIONS = [
    {"q": "The Konkan Railway hugs which coast of India?", "options": ["East Coast", "West Coast", "Northern Plains", "Deccan Plateau"], "answer": 1},
    {"q": "Which is India's busiest railway station by footfall?", "options": ["Howrah Junction", "Chhatrapati Shivaji Terminus", "New Delhi", "Mumbai Central"], "answer": 0},
    {"q": "The 'Palace on Wheels' luxury train serves which state primarily?", "options": ["Kerala", "Rajasthan", "Assam", "Goa"], "answer": 1},
    {"q": "Bengaluru's airport is named after which figure?", "options": ["Rajiv Gandhi", "Kempegowda", "Sardar Patel", "Chhatrapati Shivaji"], "answer": 1},
    {"q": "Which city hosts India's first metro rail system?", "options": ["Delhi", "Mumbai", "Kolkata", "Chennai"], "answer": 2},
    {"q": "The Vande Bharat Express is what kind of train?", "options": ["Steam", "Diesel", "Semi-high-speed electric", "Maglev"], "answer": 2},
    {"q": "India's highest railway bridge (Chenab Bridge) is in?", "options": ["Uttarakhand", "Himachal Pradesh", "Jammu & Kashmir", "Sikkim"], "answer": 2},
    {"q": "'Nilgiri Mountain Railway' toy train serves?", "options": ["Darjeeling", "Ooty", "Shimla", "Matheran"], "answer": 1},
    {"q": "Which is India's national aircraft carrier port?", "options": ["Kochi", "Visakhapatnam", "Mumbai", "Karwar"], "answer": 0},
    {"q": "Which airline is India's flag carrier?", "options": ["IndiGo", "Air India", "SpiceJet", "Vistara"], "answer": 1},
]