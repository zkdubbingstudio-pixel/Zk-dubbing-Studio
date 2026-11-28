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
import { getInstallations, getToken } from 'firebase/installations';
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

const ACTIVE_PROJECT_ID = firebaseConfig.projectId || 'zk-voice-hub-c4f67';

function cleanEnvValue(envVal: unknown, fallback: string, requiredSubstring?: string): string {
  const raw = typeof envVal === 'string' ? envVal.trim() : '';
  if (
    !raw ||
    raw.includes('=') ||
    raw.startsWith('your_') ||
    (requiredSubstring && !raw.includes(requiredSubstring))
  ) {
    return (fallback || '').trim();
  }
  return raw;
}

const cfgRecord = firebaseConfig as Record<string, string | undefined>;

// Single unified Firebase configuration for zk-voice-hub-c4f67
const rawMeasurementId = cleanEnvValue(
  import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  cfgRecord.measurementId || '',
  'G-'
);

export const resolvedFirebaseConfig = {
  apiKey: cleanEnvValue(import.meta.env.VITE_FIREBASE_API_KEY, firebaseConfig.apiKey || ''),
  authDomain: cleanEnvValue(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, firebaseConfig.authDomain || '', ACTIVE_PROJECT_ID),
  projectId: cleanEnvValue(import.meta.env.VITE_FIREBASE_PROJECT_ID, ACTIVE_PROJECT_ID, ACTIVE_PROJECT_ID),
  messagingSenderId: cleanEnvValue(
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    firebaseConfig.messagingSenderId || '',
    firebaseConfig.messagingSenderId
  ),
  appId: cleanEnvValue(import.meta.env.VITE_FIREBASE_APP_ID, firebaseConfig.appId || '', firebaseConfig.messagingSenderId),
  ...(rawMeasurementId ? { measurementId: rawMeasurementId } : {}),
  firestoreDatabaseId: cfgRecord.firestoreDatabaseId || '(default)',
};

// 1. Initialize Firebase App strictly once
export const app = getApps().length === 0 ? initializeApp(resolvedFirebaseConfig) : getApp();

// 2. Firebase App Check (disabled until Firebase Console App Check setup is complete and VITE_ENABLE_APP_CHECK=true)
let appCheckInstance: AppCheck | null = null;
const isAppCheckEnabled = cleanEnvValue(import.meta.env.VITE_ENABLE_APP_CHECK, '') === 'true';
if (typeof window !== 'undefined' && app && isAppCheckEnabled) {
  try {
    const recaptchaSiteKey = cleanEnvValue(
      import.meta.env.VITE_RECAPTCHA_SITE_KEY,
      cfgRecord.recaptchaSiteKey || ''
    );

    if (
      recaptchaSiteKey &&
      recaptchaSiteKey.length > 10 &&
      recaptchaSiteKey !== '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI'
    ) {
      if (import.meta.env.DEV) {
        (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
      }
      appCheckInstance = initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(recaptchaSiteKey),
        isTokenAutoRefreshEnabled: true,
      });
    }
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[Firebase App Check] Initialization notice:', err);
    }
  }
}
export const appCheck = appCheckInstance;

// 3. Initialize Firebase Auth
export const auth = getAuth(app);

if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch((err: any) => {
    console.warn('[Firebase Auth Persistence Warning]', err?.code || 'auth/persistence-error', err?.message || err);
  });
}

export async function ensureAuthPersistence(): Promise<void> {
  if (!auth) return;
  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch (err: unknown) {
    const fbErr = err as { code?: string; message?: string };
    const msg = String(fbErr?.message || err || '');
    if (msg.includes('quota') || msg.includes('QuotaExceeded') || msg.includes('auth/internal-error')) {
      purgeOversizedCache();
      try {
        await setPersistence(auth, browserLocalPersistence);
      } catch (retryErr: unknown) {
        const retryFbErr = retryErr as { code?: string; message?: string };
        console.warn(
          '[Firebase Auth Persistence Retry Warning]',
          retryFbErr?.code || 'auth/persistence-error',
          retryFbErr?.message || retryErr
        );
      }
    } else {
      console.warn('[Firebase Auth Persistence Warning]', fbErr?.code || 'auth/persistence-error', msg);
    }
  }
}

// 4. Initialize Cloud Firestore targeting resolved database ID (named DB or '(default)')
let firestoreDb: Firestore = null as unknown as Firestore;
try {
  if (app) {
    const databaseId = resolvedFirebaseConfig.firestoreDatabaseId || '(default)';
    try {
      firestoreDb =
        databaseId === '(default)'
          ? initializeFirestore(app, { experimentalForceLongPolling: true })
          : initializeFirestore(app, { experimentalForceLongPolling: true }, databaseId);
    } catch {
      firestoreDb = databaseId === '(default)' ? getFirestore(app) : getFirestore(app, databaseId);
    }
  }
} catch (err) {
  console.warn('Firestore initialization warning:', err);
}
export const db = firestoreDb;

// 5. Initialize Firebase Analytics safely (verify Installations first so invalid API keys never cause unhandled rejections)
const hasValidMeasurementId = /^G-[A-Z0-9]+$/i.test(rawMeasurementId);
let analyticsInstance: Analytics | null = null;
export const analyticsPromise: Promise<Analytics | null> =
  typeof window !== 'undefined' &&
  app &&
  hasValidMeasurementId &&
  Boolean(resolvedFirebaseConfig.apiKey)
    ? (async () => {
        try {
          const supported = await isAnalyticsSupported();
          if (!supported) return null;
          await getToken(getInstallations(app));
          analyticsInstance = getAnalytics(app);
          return analyticsInstance;
        } catch {
          return null;
        }
      })()
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

let firestoreAvailable = true;
let lastFirestoreError: string | null = null;

export function getFirestoreConnectionStatus(): { available: boolean; error: string | null } {
  return { available: firestoreAvailable, error: lastFirestoreError };
}

export function isFirestoreUnavailableError(error: unknown): boolean {
  const err = error as { code?: string; message?: string } | null;
  const code = String(err?.code || '').toLowerCase();
  const msg = String(err?.message || error || '').toLowerCase();
  return (
    code === 'unavailable' ||
    code === 'not-found' ||
    code === 'failed-precondition' ||
    msg.includes('the client is offline') ||
    msg.includes('could not reach cloud firestore') ||
    msg.includes('does not exist') ||
    msg.includes('not_found') ||
    msg.includes('unavailable')
  );
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errObj = error as { code?: string; message?: string } | null;
  const code = errObj?.code || 'firestore/error';
  const rawMessage = error instanceof Error ? error.message : String(error);
  const unavailable = isFirestoreUnavailableError(error);
  if (unavailable) {
    firestoreAvailable = false;
    lastFirestoreError = `Database unavailable ([${code}] ${rawMessage})`;
  }
  const formattedError = unavailable
    ? `Database unavailable ([${code}] ${rawMessage})`
    : rawMessage.includes(code)
    ? rawMessage
    : `[${code}] ${rawMessage}`;

  const errInfo: FirestoreErrorInfo = {
    error: formattedError,
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
  if (!firestoreDb) {
    firestoreAvailable = false;
    lastFirestoreError = 'Offline mode ([firestore/not-initialized] Firestore instance is not initialized.)';
    return false;
  }
  try {
    await getDocFromServer(doc(firestoreDb, 'test', 'connection'));
    firestoreAvailable = true;
    lastFirestoreError = null;
    return true;
  } catch (error: any) {
    const code = error?.code || 'firestore/unavailable';
    const message = error instanceof Error ? error.message : String(error || 'Firestore unavailable');
    firestoreAvailable = false;
    lastFirestoreError = `Offline mode ([${code}] ${message})`;
    console.warn(`[Firestore Connection] [${code}] ${message}`);
    return false;
  }
}

if (typeof window !== 'undefined' && firestoreDb) {
  testConnection().catch(() => {});
  // Automatically retry Firestore connection in the background every 10 seconds (Requirement 6)
  setInterval(() => {
    testConnection().catch(() => {});
  }, 10000);
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
