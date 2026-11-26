import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  browserLocalPersistence,
  setPersistence,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  setLogLevel,
  doc,
  getDocFromServer,
  type Firestore,
} from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { getAnalytics, isSupported as isAnalyticsSupported, logEvent, type Analytics } from 'firebase/analytics';
import { initializeAppCheck, ReCaptchaV3Provider, type AppCheck } from 'firebase/app-check';
import firebaseConfig from '../../firebase-applet-config.json';

// Silence internal Firestore verbose connection logs in console
try {
  setLogLevel('silent');
} catch {}

/**
 * Clean up old non-essential caches from localStorage so Firebase Auth storage quota is never exceeded
 */
export function purgeOversizedCache(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (
        key &&
        (key.startsWith('zk_auth') ||
          key.startsWith('zk_cache_') ||
          key.startsWith('zk_auto_backups') ||
          key.startsWith('zk_admin_activity') ||
          key.startsWith('zk_visitor_') ||
          key.includes('backup'))
      ) {
        toRemove.push(key);
      }
    }
    toRemove.forEach((k) => {
      try {
        window.localStorage.removeItem(k);
      } catch {}
    });
  } catch {}
}

purgeOversizedCache();

// Resolved Firebase configuration
export const resolvedFirebaseConfig = {
  apiKey:
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_API_KEY) ||
    firebaseConfig.apiKey ||
    '',
  authDomain:
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN) ||
    firebaseConfig.authDomain ||
    '',
  projectId:
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_PROJECT_ID) ||
    firebaseConfig.projectId ||
    '',
  storageBucket:
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET) ||
    firebaseConfig.storageBucket ||
    '',
  messagingSenderId:
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID) ||
    firebaseConfig.messagingSenderId ||
    '',
  appId:
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_APP_ID) ||
    firebaseConfig.appId ||
    '',
  measurementId:
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_MEASUREMENT_ID) ||
    (firebaseConfig as any).measurementId ||
    '',
  firestoreDatabaseId:
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_DATABASE_ID) ||
    (firebaseConfig as any).firestoreDatabaseId ||
    '',
};

// 1. Initialize Firebase App strictly once
export const app = getApps().length === 0 ? initializeApp(resolvedFirebaseConfig) : getApp();

// 2. Enable Firebase App Check when reCAPTCHA site key is configured
let appCheckInstance: AppCheck | null = null;
if (typeof window !== 'undefined' && app) {
  try {
    const recaptchaSiteKey =
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_RECAPTCHA_SITE_KEY) ||
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_APPCHECK_KEY) ||
      (firebaseConfig as any).recaptchaSiteKey ||
      '';

    if (
      recaptchaSiteKey &&
      recaptchaSiteKey.trim().length > 10 &&
      recaptchaSiteKey !== '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI'
    ) {
      if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
        (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
      }
      appCheckInstance = initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(recaptchaSiteKey),
        isTokenAutoRefreshEnabled: true,
      });
    }
  } catch (err) {
    if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
      console.warn('[Firebase App Check] Initialization notice:', err);
    }
  }
}
export const appCheck = appCheckInstance;

// 3. Initialize Firebase Auth
export const auth = getAuth(app);

if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch(() => {});
}

export async function ensureAuthPersistence(): Promise<void> {
  if (!auth) return;
  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch (err: any) {
    const msg = String(err?.message || err || '');
    if (msg.includes('quota') || msg.includes('QuotaExceeded') || msg.includes('auth/internal-error')) {
      purgeOversizedCache();
      try {
        await setPersistence(auth, browserLocalPersistence);
      } catch {}
    }
  }
}

// 4. Initialize Cloud Firestore targeting named database ID from firebase-applet-config.json
let firestoreDb: Firestore = null as unknown as Firestore;
try {
  if (app) {
    const databaseId = resolvedFirebaseConfig.firestoreDatabaseId || firebaseConfig.firestoreDatabaseId;
    try {
      firestoreDb = initializeFirestore(
        app,
        { experimentalForceLongPolling: true },
        databaseId
      );
    } catch {
      firestoreDb = getFirestore(app, databaseId);
    }
  }
} catch (err) {
  console.warn('Firestore initialization warning:', err);
}
export const db = firestoreDb;

// 5. Initialize Firebase Storage (for posters, banners, episode thumbnails)
let firebaseStorage: FirebaseStorage = null as unknown as FirebaseStorage;
try {
  if (app) {
    firebaseStorage = getStorage(app);
  }
} catch (err) {
  console.warn('Firebase Storage initialization warning:', err);
}
export const storage = firebaseStorage;

// 6. Initialize Firebase Analytics safely (browser-only with support check)
let analyticsInstance: Analytics | null = null;
export const analyticsPromise: Promise<Analytics | null> =
  typeof window !== 'undefined' && app
    ? isAnalyticsSupported()
        .then((supported) => {
          if (!supported) return null;
          analyticsInstance = getAnalytics(app);
          return analyticsInstance;
        })
        .catch(() => null)
    : Promise.resolve(null);

export async function trackFirebaseAnalyticsEvent(
  eventName: string,
  params?: Record<string, any>
): Promise<void> {
  try {
    const instance = analyticsInstance || (await analyticsPromise);
    if (instance) {
      logEvent(instance, eventName, params);
    }
  } catch {
    // Non-blocking in restricted browser environments or ad blockers
  }
}

// ------------------------------------------------------------------------------
// Structured Firestore Error Handling & Startup Connection Validation
// ------------------------------------------------------------------------------
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid ?? null,
      email: auth?.currentUser?.email ?? null,
      emailVerified: auth?.currentUser?.emailVerified ?? null,
      isAnonymous: auth?.currentUser?.isAnonymous ?? null,
      tenantId: auth?.currentUser?.tenantId ?? null,
      providerInfo:
        auth?.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  const serialized = JSON.stringify(errInfo);
  console.error('Firestore Error: ', serialized);
  throw new Error(serialized);
}

export async function testConnection(): Promise<boolean> {
  if (!firestoreDb) return false;
  try {
    await getDocFromServer(doc(firestoreDb, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
    return false;
  }
}

if (typeof window !== 'undefined' && firestoreDb) {
  testConnection().catch(() => {});
}

export {
  browserLocalPersistence,
  setPersistence,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  type FirebaseUser,
};
