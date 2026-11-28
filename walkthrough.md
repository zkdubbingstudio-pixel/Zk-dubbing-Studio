# ZK Voice Hub — Firebase-Only Architecture & Security Summary

ZK Voice Hub runs on Firebase Spark (free) plan services (`Firebase Authentication`, `Cloud Firestore`, and `Firebase Analytics`, with `Firebase App Check` gated off until configured).

## Firebase Architecture

1. **Firebase Authentication (`src/lib/authService.ts`, `src/lib/firebase.ts`)**
   - Supports Google OAuth popup sign-in and Email/Password sign-up & login.
   - Server-backed brute-force login rate limiting via `/api/auth/rate-limit/check` and `/api/auth/rate-limit/record`.
   - Owner access (`zkdubbingstudio@gmail.com`) is enforced only when `email_verified == true`.

2. **Cloud Firestore (`src/lib/dataService.ts`, `firebase-blueprint.json`, `firestore.rules`)**
   - Configured against the active project's `(default)` Firestore database.
   - Active collections: `users`, `anime`, `seasons`, `episodes`, `banners`, `favorites`, `watchHistory`, `watchlist`, `comments`, `ratings`, `notifications`, `settings`, `analytics`, `adminLogs`, `premiumPlans`, `payments`, `live_visitors`, `analytics_events`, `admin_notifications`.
   - Client caching (5-minute TTL) + real-time `onSnapshot` listeners in the Admin Dashboard and Admin Analytics.

3. **URL-Based Media Fields (`src/components/admin/ImageUpload.tsx`, `src/components/admin/VideoUpload.tsx`)**
   - Stores sanitized poster, banner, episode thumbnail, season artwork, and video stream URLs directly as text strings in Cloud Firestore without requiring Firebase Storage or Blaze billing.

4. **Firebase App Check & Firebase Analytics (`src/lib/firebase.ts`, `src/lib/telemetryService.ts`)**
   - ReCaptchaV3 App Check initialization gated behind `VITE_ENABLE_APP_CHECK=true` (disabled by default to prevent 403 errors until registered).
   - Firebase Analytics (`getAnalytics` + `isSupported()`) tracking `login`, `sign_up`, `page_view`, `video_start`, `video_complete`, `search`, and `add_to_favorites`.

5. **Express Security Middleware (`server.ts`)**
   - Serves Vite SPA on port `3000` with hardened CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, CSRF origin validation, rate limiting, and `/api/stream/view` throttling.

## Verification

- Confirmed zero Firebase Storage imports or initialization (`firebase/storage` removed).
- Validated `firestore.rules` with `npx eslint firestore.rules`.
- Verified TypeScript compilation, lint, and production Vite bundle (`dist/`).
