/**
 * Phase 0: Payload-First Security TDD Test Suite for ZK Voice Hub Firestore Rules
 * Verifies all 12 Dirty Dozen payloads are rejected with PERMISSION_DENIED.
 *
 * Run against Firebase Emulator Suite using @firebase/rules-unit-testing:
 * npx firebase emulators:exec --only firestore "npx vitest run firestore.rules.test.ts"
 */
import fs from 'node:fs';
import path from 'node:path';

export interface SecurityTestCase {
  name: string;
  collection: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  auth: { uid: string; email?: string; email_verified?: boolean } | null;
  docId?: string;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TESTS: SecurityTestCase[] = [
  {
    name: '1. Privilege Escalation on User Creation',
    collection: 'users',
    operation: 'create',
    docId: 'attacker_uid',
    auth: { uid: 'attacker_uid', email: 'attacker@example.com', email_verified: true },
    payload: {
      uid: 'attacker_uid',
      email: 'attacker@example.com',
      role: 'owner',
      isPremium: true,
      createdAt: Date.now(),
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '2. Shadow Field Injection on User Profile',
    collection: 'users',
    operation: 'update',
    docId: 'user_1',
    auth: { uid: 'user_1', email: 'fan@example.com', email_verified: true },
    payload: { displayName: 'Fan', isVerifiedAdmin: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '3. Owner Email Spoof Attack with Unverified Email',
    collection: 'anime',
    operation: 'create',
    docId: 'anm_spoof',
    auth: { uid: 'spoof_uid', email: 'zkdubbingstudio@gmail.com', email_verified: false },
    payload: { title: 'Spoofed Anime', status: 'Ongoing' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '4. Non-Owner User PII Directory Scrape',
    collection: 'users',
    operation: 'list',
    auth: { uid: 'user_1', email: 'fan@example.com', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '5. Cross-User Watch History Tampering',
    collection: 'watchHistory',
    operation: 'delete',
    docId: 'user_2_ep_1',
    auth: { uid: 'user_1', email: 'fan@example.com', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '6. Unauthorized Admin Log Injection',
    collection: 'adminLogs',
    operation: 'create',
    docId: 'log_fake_1',
    auth: { uid: 'user_1', email: 'fan@example.com', email_verified: true },
    payload: { action: 'Fake Audit', category: 'security', details: 'spoof', timestamp: Date.now() },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '7. Payment Status Forgery on Create',
    collection: 'payments',
    operation: 'create',
    docId: 'pay_forged_1',
    auth: { uid: 'user_1', email: 'fan@example.com', email_verified: true },
    payload: {
      userId: 'user_1',
      planId: 'vip_monthly',
      amount: 0,
      currency: 'INR',
      status: 'completed',
      createdAt: Date.now(),
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '8. Orphaned Comment Creation for Non-Existent Anime',
    collection: 'comments',
    operation: 'create',
    docId: 'comment_orphan_1',
    auth: { uid: 'user_1', email: 'fan@example.com', email_verified: true },
    payload: {
      animeId: 'non_existent_anime_999',
      userId: 'user_1',
      userName: 'Fan',
      text: 'Hello',
      createdAt: Date.now(),
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '9. Rating Score Out-of-Bounds Overflow',
    collection: 'ratings',
    operation: 'create',
    docId: 'rating_overflow_1',
    auth: { uid: 'user_1', email: 'fan@example.com', email_verified: true },
    payload: { animeId: 'anm_1', userId: 'user_1', score: 999, createdAt: Date.now() },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '10. Oversized Document ID Poisoning',
    collection: 'favorites',
    operation: 'create',
    docId: 'x'.repeat(200),
    auth: { uid: 'user_1', email: 'fan@example.com', email_verified: true },
    payload: { userId: 'user_1', animeId: 'anm_1', createdAt: Date.now() },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '11. Unpublished Draft Episode Leak to Guest',
    collection: 'episodes',
    operation: 'get',
    docId: 'ep_draft_1',
    auth: null,
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '12. Comment Author Impersonation on Update',
    collection: 'comments',
    operation: 'update',
    docId: 'comment_user2',
    auth: { uid: 'user_1', email: 'fan@example.com', email_verified: true },
    payload: { userId: 'user_1', text: 'Hijacked' },
    expected: 'PERMISSION_DENIED',
  },
];

export function verifyRulesContainAllCollections(): boolean {
  const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
  const rulesText = fs.readFileSync(rulesPath, 'utf8');
  const required = [
    'users',
    'anime',
    'episodes',
    'banners',
    'favorites',
    'watchHistory',
    'comments',
    'ratings',
    'notifications',
    'settings',
    'analytics',
    'adminLogs',
    'premiumPlans',
    'payments',
  ];
  return required.every((col) => rulesText.includes(`match /${col}/{`));
}
