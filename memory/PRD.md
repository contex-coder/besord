# Besord — Product Requirements Document

## Overview
Besord is a social mobile app for **quick image feedback using a single word**, where users post an image + 1 word and the community votes **Aprovo** (Approve) or **Desaprovo** (Disapprove).

## Stack
- **Frontend**: Expo SDK 54 (React Native) + expo-router
- **Backend**: FastAPI + MongoDB
- **Auth**: Emergent Managed Google OAuth
- **Storage**: Images stored as base64 in MongoDB
- **Language**: Portuguese (PT-BR)
- **Design**: Neo-Brutalist / Swiss High-Contrast (black borders, solid shadows, bold typography)

## Core Features (MVP)
1. **Google Sign-In** (Emergent OAuth) — single-tap login, secure session via `expo-secure-store`
2. **Feed Tab** — vertical scrolling list of posts (image 4:5 + 1 word overlay), per-post Aprovo/Desaprovo buttons, vote-percentage bar, pull-to-refresh
3. **Create Tab** — pick image from gallery + enter 1 word (no spaces, letters/numbers, ≤20 chars) → publish
4. **Profile Tab** — avatar, name, stats (posts / total aprovo / total desaprovo), grid of own posts, logout
5. **Voting System** — toggle off (same vote), switch (other vote), one vote per user per post

## Data Model (MongoDB)
- `users` { user_id, email (unique), name, picture, created_at }
- `user_sessions` { session_token (unique), user_id, expires_at (TTL), created_at }
- `posts` { post_id, word, image_base64, author_id, author_name, author_picture, aprovo_count, desaprovo_count, created_at }
- `votes` { post_id, user_id, vote ("aprovo"|"desaprovo"), created_at } (unique compound index)

## API Endpoints
- `POST /api/auth/session` — exchange Emergent session_id → session_token + user
- `GET /api/auth/me` — current user (Bearer auth)
- `POST /api/auth/logout` — invalidate session
- `GET /api/posts` — list feed (auth optional, includes user_vote if logged in)
- `POST /api/posts` — create post (auth required)
- `DELETE /api/posts/{id}` — delete own post
- `POST /api/posts/{id}/vote` — cast/toggle/change vote

## Testing
- 24/24 backend pytest tests passed (auth, posts CRUD, votes toggle/switch, validation, permissions).

## Out of Scope (Future)
- Comments / replies
- Push notifications
- Trending / discovery feed
- Reporting / moderation
- Web build polish (mobile-first)
