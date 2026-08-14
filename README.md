# 🚗 UniPool

> A university carpooling platform that matches students travelling
> on the same route within a ±1-hour window.

[🌐 Live Demo](https://uni-pool-ruddy.vercel.app)

![UniPool Preview](assets/banner.png)

## **Why UniPool?**

University students frequently coordinate travel through fragmented
WhatsApp groups and informal networks.

UniPool turns that process into a structured system:
```
Travel Plan
     ↓
Post Request
     ↓
Find Compatible Travellers
     ↓
Automatic Notification
     ↓
Coordinate & Share Ride
```


## **Matching Logic:**

For every new pool request, UniPool searches for other users who:
```
1. Are travelling from the same location
2. Are travelling to the same destination
3. Have a travel time within ±1 hour
4. Are different users
5. Satisfy the selected gender preference
```

### Tech Stack

`React Native` `Expo` `TypeScript` `FastAPI` `Python` `MongoDB`

## ✨ Features

- 📝 Post travel requests with route, date, time, companions and preferences
- 🔎 Browse and filter available pool requests
- ⚡ Automatically match travellers on the same route within ±1 hour
- ✉️ Notify matched travellers via email
- 👤 Manage user profiles and preferences

## 🏗️ Architecture

                    ┌─────────────────────┐
                    │     UniPool App     │
                    │ Expo / React Native │
                    │     TypeScript      │
                    └──────────┬──────────┘
                               │
                         REST / JSON
                               │
                               ▼
                    ┌─────────────────────┐
                    │     FastAPI API     │
                    │       Python        │
                    └──────┬───────┬──────┘
                           │       │
                     CRUD  │       │  Email
                           │       │
                           ▼       ▼
                    ┌──────────┐ ┌────────────┐
                    │ MongoDB  │ │ Email API  │
                    └──────────┘ └────────────┘
## ⚡ Matching Logic

When a user posts a pool request, UniPool searches for other
requests that satisfy:

- Same origin
- Same destination
- Travel time within ±1 hour
- Compatible gender preference
- Different user

Compatible travellers are then notified via email.

## 📁 Structure

```text
UniPool/
├── app/
│   ├── frontend/    # Expo + React Native
│   └── backend/     # FastAPI + MongoDB
├── assets/          # Project screenshots
├── README.md
└── .gitignore
```
