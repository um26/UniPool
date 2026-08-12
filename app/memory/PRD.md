# UniPool — Product Requirements

## Overview
UniPool is a university cab-pool matching app for outstation students. Users sign in with Google, post cab-pool requests (from/to/date-time/preferences), and receive **email notifications** when another request matches their route within a **±1 hour** window.

## Stack
- **Frontend**: Expo Router (React Native), reanimated, expo-blur, expo-linear-gradient, expo-image
- **Backend**: FastAPI + Motor (MongoDB)
- **Auth**: Emergent-managed Google OAuth (session_id → session_token, stored in expo-secure-store)
- **Email**: Emergent-managed Resend integration (`X-Email-Key` header, `from_name` required)

## Core Flows
1. **Login** — Google one-tap via Emergent auth
2. **Home Feed** — see all open pools, filter chips (All/Today/Tomorrow/Airport/Railway)
3. **Post Pool** — modal form: from, to, date, time, gender pref, companions, luggage, notes
4. **Auto-match + Email** — on create, backend finds ±1h same-route requests, emails both users
5. **Matches Tab** — view current matches; deep-link to email the other traveller
6. **Profile** — set gender preference, view/delete my requests, sign out
7. **Mini-games** — Travel Trivia (India), Tap-the-Plane arcade

## Backend API
- `POST /api/auth/session` — exchange session_id for session_token
- `GET  /api/auth/me`
- `POST /api/auth/logout`
- `PATCH /api/profile` — update gender/phone
- `POST /api/pools` — create pool (triggers match search + emails)
- `GET  /api/pools` — list open pools (within past 2h + future)
- `GET  /api/pools/mine`
- `GET  /api/pools/matches`
- `DELETE /api/pools/{pool_id}`
- `GET  /api/trivia`

## Design
Warm Indian palette (Saffron/Marigold + Deep Indigo + Cream) with subtle rangoli backgrounds and travel-themed loading (animated plane on dashed route).
