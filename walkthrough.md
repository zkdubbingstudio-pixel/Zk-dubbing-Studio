# ZK Voice Hub — Firebase-Only Architecture & Security Summary

ZK Voice Hub runs 100% on Firebase services (`Firebase Authentication`, `Cloud Firestore`, `Firebase Storage`, `Firebase App Check`, and `Firebase Analytics`) with zero Supabase, Postgres, or Cloudflare R2 dependencies.

## Firebase Architecture

1. **Firebase Authentication (`src/lib/authService.ts`, `src/lib/firebase.ts`)**
   - Supports Google OAuth popup sign-in and Email/Password sign-up & login.
   - Server-backed brute-force login rate limiting via `/api/auth/rate-limit/check` and `/api/auth/rate-limit/record`.
   - Owner access (`zkdubbingstudio@gmail.com`) is enforced only when `email_verified == true`.

2. **Cloud Firestore (`src/lib/dataService.ts`, `firebase-blueprint.json`, `firestore.rules`)**
   - Configured against named database `ai-studio-zkvoicehub-573c9508-5f55-4fa8-929b-89c914e96817`.
   - Active collections: `users`, `anime`, `seasons`, `episodes`, `banners`, `favorites`, `watchHistory`, `watchlist`, `comments`, `ratings`, `notifications`, `settings`, `analytics`, `adminLogs`, `premiumPlans`, `payments`, `live_visitors`, `analytics_events`, `admin_notifications`.
   - Client caching (5-minute TTL) + real-time `onSnapshot` listeners in the Admin Dashboard and Admin Analytics.

3. **Firebase Storage (`storage.rules`, `src/components/admin/ImageUpload.tsx`, `src/components/admin/VideoUpload.tsx`)**
   - Compresses and uploads posters (`posters/`), banners (`banners/`), episode thumbnails (`episode-thumbnails/`), season artwork (`seasons/`), user avatars (`avatars/`), and videos (`videos/`) directly to Firebase Storage (`gen-lang-client-0843629033.firebasestorage.app`).
   - Storage rules disable directory listing globally (`allow list: if false;`), allow reads on published media paths, restrict catalog image/video writes strictly to the verified owner, and scope user avatar writes to the owning authenticated user.

4. **Firebase App Check & Firebase Analytics (`src/lib/firebase.ts`, `src/lib/telemetryService.ts`)**
   - ReCaptchaV3 App Check initialization when `VITE_RECAPTCHA_SITE_KEY` is configured.
   - Firebase Analytics (`getAnalytics` + `isSupported()`) tracking `login`, `sign_up`, `page_view`, `video_start`, `video_complete`, `search`, and `add_to_favorites`.

5. **Express Security Middleware (`server.ts`)**
   - Serves Vite SPA on port `3000` with hardened CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, CSRF origin validation, rate limiting, and `/api/stream/view` throttling.

## Verification

- Confirmed zero Supabase, Postgres, AWS SDK, or Cloudflare R2 packages, env vars, or routes remain.
- Validated `firestore.rules` and `storage.rules` with `npx eslint firestore.rules storage.rules`.
- Verified TypeScript compilation, lint, and production Vite bundle (`dist/`).
