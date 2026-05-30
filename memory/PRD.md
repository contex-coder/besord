# Besord — Product Requirements Document v2

## Overview
Besord is a social mobile app for **quick image feedback using a single word**. Users post image + 1 word; community votes Aprovo/Desaprovo and adds 1-word comments. Words become hashtags linking to all posts with that word. **B2B monetization**: companies promote campaigns and receive regional verdict reports.

## Stack
- **Frontend**: Expo SDK 54 (React Native) + expo-router + Reanimated
- **Backend**: FastAPI + MongoDB + Stripe
- **Auth**: Emergent Google OAuth + Apple Sign-In (iOS)
- **Storage**: Images stored as base64 in MongoDB
- **Languages**: PT (default), EN, FR, DE, ZH — auto-detected from device locale
- **Design**: Neo-Brutalist (black borders, solid shadows) + animated flying beetles 🪲🐞
- **Geo**: ip-api.com for vote/comment geolocation

## Core Features

### Consumer (free)
1. Google + Apple login
2. Vertical feed (Recente / Em Alta toggle)
3. Animated landing with flying beetles
4. Create post (image + 1 word)
5. Vote Aprovo/Desaprovo (toggle, switch)
6. 1-word comments per user (editable)
7. Click word → see all posts with that word + collective verdict
8. Profile + own posts grid
9. Report post (3 reports auto-hide)

### Business (paid via Stripe)
1. **Onboarding** simplified (no CNPJ required): Company Name + Country + Tax ID (optional, label per country) + Contact
2. **Create Campaign**: image + 1 word + tier (Local/Regional/National/Global) + target geo + Stripe Checkout
3. **Pricing (USD)**:
   | Tier | Scope | Duration | Price | Votos inclusos |
   |---|---|---|---|---|
   | Local | City | 1 day | $19 | 380 |
   | Regional | State | 7 days | $49 | 980 |
   | National | Country | 30 days | $99 | 1,980 |
   | Global | World | 60 days | $499 | 9,980 |
4. **Algorithm**: 1 sponsored post injected every 3 organic, matched by user's geo (city > state > country > world)
5. **Dashboard**: votes by country/region/city, vote bars, word cloud from comments, progress vs included votes
6. **SPONSORED badge** on all paid posts (transparency)

### Mock Mode (Stripe)
Backend detects placeholder `sk_test_emergent` and returns mock checkout URLs that auto-activate campaigns when visited. User can replace with real Stripe test key for full end-to-end test.

## Data Model (MongoDB)
- `users` { user_id, email, name, picture, apple_id?, provider, business_profile?, created_at }
- `user_sessions` { session_token, user_id, expires_at TTL, created_at }
- `posts` { post_id, word, image_base64, author_id, author_name, aprovo_count, desaprovo_count, comments_count, is_sponsored, campaign_id?, hidden, created_at }
- `votes` { post_id, user_id, vote, geo {country,region,city,lat,lon}, created_at }
- `comments` { comment_id, post_id, user_id, word, geo, created_at }
- `reports` { post_id, user_id, reason }
- `campaigns` { campaign_id, user_id, word, image_base64, tier_key, scope, duration_days, amount_cents, included_votes, target_country_code, target_region, target_city, status, votes_collected, aprovo_count, desaprovo_count, stripe_session_id, post_id, starts_at, ends_at }

## API (v2)
**Auth**: `/api/auth/session`, `/api/auth/apple`, `/api/auth/me`, `/api/auth/logout`
**Posts**: `/api/posts` (?sort, ?word), `/api/posts/{id}/vote`, `/api/posts/{id}/comment`, `/api/posts/{id}/report`, `/api/posts/{id}` DELETE
**Words**: `/api/words/{word}/stats`
**Business**: `/api/business/profile` POST/GET, `/api/business/tiers`, `/api/business/campaigns` POST/GET, `/api/business/campaigns/{id}` GET, `/api/business/campaigns/{id}/check-payment` POST, `/api/business/campaigns/{id}/report`
**Misc**: `/api/geo/me`

## Tests
- **Iteration 1**: 24/24 (auth + posts CRUD + votes + validation)
- **Iteration 2**: 41/45 (added: business profiles, campaigns, sponsored feed, geo aggregation, word cloud, Apple Sign-In). 4 skipped due to placeholder Stripe key — code path validated via mock mode.

## Out of Scope (Future)
- Pay-per-vote overflow billing (after included_votes exhausted)
- Stripe webhooks for async confirmation
- Real Apple JWT signature verification
- Heatmap geo visualization (currently bar list)
- PDF/CSV report export
- Push notifications
