# ZK Voice Hub — Security Specification (Phase 0 TDD)

## 1. Core Data Invariants
1. **Verified Owner Authority**: Only an authenticated user whose Firebase ID token contains `email_verified == true` and `email.lower() == 'zkdubbingstudio@gmail.com'` can access or mutate admin collections (`anime`, `seasons`, `episodes`, `banners`, `settings`, `analytics`, `adminLogs`, `premiumPlans`, `admin_notifications` reads) or view draft (`published == false`) episodes.
2. **User PII Isolation**: A document under `/users/{userId}` can only be `get` by `request.auth.uid == userId` or verified owner, and `list` is restricted strictly to the verified owner. Self-writes cannot elevate `role`, `isPremium`, `premiumTier`, or clear `isBanned`.
3. **Strict User Ownership**: Documents under `/favorites/{favoriteId}`, `/watchHistory/{historyId}`, `/watchlist/{watchlistId}`, and `/payments/{paymentId}` require `resource.data.userId == request.auth.uid` on `get`, `list`, `update`, and `delete` (or verified owner), and `incoming().userId == request.auth.uid` on `create`.
4. **Relational Integrity**: Comments (`/comments/{commentId}`) and Ratings (`/ratings/{ratingId}`) cannot exist without a valid parent document in `/anime/{animeId}`. Payment creation requires `status == 'pending'` and an existing plan in `/premiumPlans/{planId}`.
5. **Path & Size Poisoning Guards**: All single-document path IDs must satisfy `^[a-zA-Z0-9_-]{1,128}$`. Every string and array field enforces explicit `.size()` boundaries matching `firebase-blueprint.json`.

## 2. The "Dirty Dozen" Attack Payloads
1. **Privilege Escalation on User Creation (`users/{uid}`)**: Authenticated normal user creates `/users/attacker` with `{ "uid": "attacker", "email": "attacker@example.com", "role": "owner", "isPremium": true, "createdAt": 1700000000 }`. -> MUST return `PERMISSION_DENIED`.
2. **Shadow / Ghost Field Injection on User Profile (`users/{uid}`)**: Authenticated normal user updates `/users/u1` with `{ "displayName": "Valid", "isVerifiedAdmin": true }`. -> MUST return `PERMISSION_DENIED`.
3. **Owner Email Spoof Attack (`anime/{id}`)**: User with `token.email == "zkdubbingstudio@gmail.com"` and `token.email_verified == false` attempts to create `/anime/anm_hack`. -> MUST return `PERMISSION_DENIED`.
4. **User PII Directory Scrape (`list /users`)**: Non-owner authenticated user issues a `list` query on `/users`. -> MUST return `PERMISSION_DENIED`.
5. **Cross-User Watch History Tampering (`watchHistory/{id}`)**: User A attempts to `get`, `list` (unscoped), or `delete` User B's document in `/watchHistory`. -> MUST return `PERMISSION_DENIED`.
6. **Unauthorized Admin Log Injection (`adminLogs/{id}`)**: Normal authenticated user attempts to write to `/adminLogs/fake_log`. -> MUST return `PERMISSION_DENIED`.
7. **Payment Status Forgery (`payments/{id}`)**: User A creates `/payments/pay_1` with `{ "userId": "userA", "planId": "vip", "amount": 0, "status": "completed", "createdAt": 1700000000 }`. -> MUST return `PERMISSION_DENIED`.
8. **Orphaned Comment Creation (`comments/{id}`)**: User creates `/comments/c1` referencing non-existent `/anime/missing_anime_999`. -> MUST return `PERMISSION_DENIED`.
9. **Rating Range Overflow (`ratings/{id}`)**: User creates `/ratings/r1` with `{ "animeId": "anm_1", "userId": "userA", "score": 999 }`. -> MUST return `PERMISSION_DENIED`.
10. **Path Variable Poisoning (`favorites/{id}`)**: User attempts to write to `/favorites/` with an ID containing `.` or `/` or >128 chars (`a`.repeat(200)). -> MUST return `PERMISSION_DENIED`.
11. **Draft Episode Leak (`episodes/{id}`)**: Unauthenticated or non-owner user requests `get` on an unpublished episode (`published == false`). -> MUST return `PERMISSION_DENIED`.
12. **Comment Author Hijack Update (`comments/{id}`)**: User A attempts to update User B's comment `{ "text": "Edited by A" }`, or mutate `userId`/`animeId`. -> MUST return `PERMISSION_DENIED`.
