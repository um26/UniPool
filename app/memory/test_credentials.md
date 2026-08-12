# UniPool Test Credentials

## Auth Type
Emergent-managed Google OAuth (one-tap Google sign-in). No app-managed passwords.

## Backend Auth Endpoint
- `POST /api/auth/session` — body `{ "session_id": "<from redirect URL>" }` → returns `{ session_token, user }`
- `GET  /api/auth/me` — `Authorization: Bearer <session_token>`
- `POST /api/auth/logout`

## Test Session (for backend testing)
Since Emergent Google Auth requires a live redirect flow, backend endpoints can be tested by seeding a session directly in MongoDB:

```python
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone, timedelta
import os
client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]
now = datetime.now(timezone.utc)
await db.users.update_one(
    {"user_id": "user_testuser001"},
    {"$setOnInsert": {"email": "test.user@example.com", "name": "Test User", "picture": None, "gender": "any", "phone": None, "created_at": now, "last_login": now}, "$set": {"user_id": "user_testuser001"}},
    upsert=True,
)
await db.user_sessions.update_one(
    {"session_token": "test-session-token-abc123"},
    {"$set": {"session_token": "test-session-token-abc123", "user_id": "user_testuser001", "expires_at": now + timedelta(days=7), "created_at": now}},
    upsert=True,
)
```
Then use `Authorization: Bearer test-session-token-abc123` for authenticated API calls.

## Email Notifications
- Provider: Emergent Resend (managed) via `/api/v1/email/send`
- From-name env: `EMAIL_FROM_NAME=UniPool`
- Test recipient (integration probe only): `delivered@resend.dev`
