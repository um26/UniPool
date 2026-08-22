# UniPool Backend

FastAPI backend for the UniPool carpooling platform. The backend exposes a REST API consumed by the Expo frontend and persists application data in MongoDB.

## Quick Start

Run these commands from the repository root in PowerShell:

```powershell
Set-Location app/backend

# Create the virtual environment once
python -m venv venv

# Activate it for the current terminal
.\venv\Scripts\Activate.ps1

# Install or update backend dependencies
python -m pip install -r requirements.txt

# Start the development server
python -m uvicorn app:app --reload --host 0.0.0.0 --port 8001
```

The API is available at:

- Local API: `http://127.0.0.1:8001/api`
- Swagger UI: `http://127.0.0.1:8001/docs`
- OpenAPI schema: `http://127.0.0.1:8001/openapi.json`
- Health check: `http://127.0.0.1:8001/`

The canonical entrypoint is `app.py`, using the `app` object. Do not start the modular backend with `server:app`; `server.py` is the legacy monolithic implementation retained for reference during the migration.

### PowerShell Execution Policy

If activation is blocked by PowerShell policy, use the virtual-environment interpreter directly:

```powershell
Set-Location app/backend
.\venv\Scripts\python.exe -m pip install -r requirements.txt
.\venv\Scripts\python.exe -m uvicorn app:app --reload --host 0.0.0.0 --port 8001
```

## Configuration

Create `app/backend/.env` before starting the server. At minimum, configure MongoDB:

```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=unipool
```

Common optional integrations are configured with:

```env
GOOGLE_CLIENT_ID=your_google_client_id
RESEND_API_KEY=your_resend_key
RESEND_FROM_EMAIL=verified@example.com
SENDGRID_API_KEY=your_sendgrid_key
SENDGRID_FROM_EMAIL=verified@example.com
TURNSTILE_SECRET_KEY=your_turnstile_secret
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
ADMIN_EMAILS=admin@example.com
VERIFIED_EMAIL_DOMAINS=mahindrauniversity.edu.in
```

The server creates MongoDB indexes and seeds the configured admin account during startup. Keep credentials in `.env`; do not commit them.

## Frontend Connection

From `app/frontend`, install dependencies and start Expo:

```powershell
Set-Location app/frontend
npm install
npm start
```

The frontend API client should target the backend base URL. For local web development, use:

```env
EXPO_PUBLIC_API_URL=http://127.0.0.1:8001/api
```

For a physical device, replace `127.0.0.1` with the development machine's LAN IP address. The frontend routes include messaging, typing indicators, presence, pools, matches, requests, profile, ratings, games, and administration.

## Architecture

```text
app/backend/
├── app.py                 FastAPI application factory/entrypoint
├── server.py              Legacy monolithic implementation; reference only
├── requirements.txt       Python dependencies
├── .env                   Local configuration; not committed
│
├── config/
│   ├── database.py        MongoDB client and collection handles
│   └── settings.py        Environment-backed configuration
│
├── models/
│   ├── auth.py            Authentication, messaging, and rating schemas
│   ├── pool.py            Pool and travel-request schemas
│   ├── response.py        Shared response schemas
│   └── user.py            User and verification schemas
│
├── routes/                HTTP boundary and route registration
│   ├── auth.py            Signup, login, Google auth, current user
│   ├── pools.py            Pool CRUD, feed, and match discovery
│   ├── matches.py         Confirmed matches
│   ├── requests.py        Join-request operations
│   ├── messages.py        Conversations, chat messages, typing status
│   ├── users.py           User presence: /api/users/{user_id}/presence
│   ├── profile.py         Profile and college-ID verification
│   ├── games.py           Games, trivia, and leaderboards
│   └── admin.py            Administrative operations
│
├── services/              Business logic and database workflows
│   ├── auth_service.py
│   ├── pool_service.py
│   ├── request_service.py
│   ├── messages_service.py
│   ├── user_service.py
│   ├── admin_service.py
│   └── notification_service.py
│
├── helpers/               Shared integrations and domain helpers
│   ├── auth_helper.py     Passwords, sessions, and admin flags
│   ├── college_helper.py  College validation and badge calculations
│   ├── email_helper.py    SendGrid, Resend, and email templates
│   └── push_helper.py     Web-push notifications
│
└── utils/
    ├── exceptions.py      Application exception definitions
    └── responses.py       Response utilities
```

### Request Flow

```text
Expo frontend
     │
     │ REST / JSON with Bearer session token
     ▼
app.py
     │
     │ registers every router under /api
     ▼
routes/*
     │
     │ authenticates and validates request/response shapes
     ▼
services/*
     │
     │ applies business rules and coordinates integrations
     ├──────────────► config/database.py ─────► MongoDB
     └──────────────► helpers/* ──────────────► Email / Push / College logic
```

## Modularization Changes

The backend was split from the former `server.py` monolith into explicit layers:

1. `app.py` now owns FastAPI creation, middleware, startup indexes, admin seeding, and router registration.
2. `routes/` owns HTTP paths and authentication extraction.
3. `services/` owns reusable business operations instead of embedding them in route handlers.
4. `helpers/` owns cross-cutting authentication, college, notification, and email behavior.
5. `models/` owns Pydantic request and response contracts.
6. `config/` centralizes database and environment configuration.
7. `routes/matches.py` and `routes/users.py` restore modular endpoints that were present in the old implementation.
8. `GET /api/users/{user_id}/presence` returns `{ "online": boolean, "last_seen": timestamp }` for chat presence polling.
9. Messaging and request services use the blocked-user helper from `services.pool_service`.
10. The frontend API client was aligned with the modular `/api` route paths.

## Validation and Troubleshooting

Compile the backend modules without connecting to MongoDB:

```powershell
Set-Location app/backend
python -m compileall -q app.py routes services helpers models config
```

Check the route table:

```powershell
python -c "from app import app; print('\n'.join(sorted(r.path for r in app.routes)))"
```

Useful interpretations:

- `404 Not Found`: the path is not registered in the running app, or an old server process is still running.
- `401 Unauthorized`: the path exists, but the request has no valid Bearer session token.
- `500 Internal Server Error`: inspect the backend log for the route and service exception.
- MongoDB connection errors during startup: confirm MongoDB is running and `MONGO_URL`/`DB_NAME` are present in `.env`.

After route changes, restart the process if reload does not update the route table.
