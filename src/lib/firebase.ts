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
  type User as FirebaseUser
} from 'firebase/auth';
import { initializeFirestore, getFirestore, setLogLevel, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export const PRODUCTION_DOMAIN = 'zk-voicehub.vercel.app';
export const PRODUCTION_ORIGIN = 'https://zk-voicehub.vercel.app';

// Silence internal Firestore connection logs & timeout warnings in console
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
      if (key && (
        key.startsWith('zk_auth') ||
        key.startsWith('zk_cache_') ||
        key.startsWith('zk_auto_backups') ||
        key.startsWith('zk_admin_activity') ||
        key.startsWith('zk_visitor_') ||
        key.includes('backup')
      )) {
        toRemove.push(key);
      }
    }
    toRemove.forEach((k) => {
      try { window.localStorage.removeItem(k); } catch {}
    });
  } catch {}
}

// Automatically clean non-essential caches on module evaluation
purgeOversizedCache();

// Dynamically resolve authDomain to use production domain on Vercel
export function getResolvedAuthDomain(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase();
    if (host.includes('vercel.app') || host === PRODUCTION_DOMAIN) {
      return PRODUCTION_DOMAIN;
    }
  }
  return firebaseConfig.authDomain || 'gen-lang-client-0843629033.firebaseapp.com';
}

const activeFirebaseConfig = {
  ...firebaseConfig,
  authDomain: getResolvedAuthDomain(),
};

// Initialize Firebase App only once (Singleton pattern) safely
let firebaseApp: any = null;
try {
  if (getApps().length === 0) {
    firebaseApp = initializeApp(activeFirebaseConfig);
  } else {
    firebaseApp = getApp();
  }
} catch (err) {
  console.warn('Firebase App initialization warning:', err);
  try {
    firebaseApp = getApp();
  } catch {
    firebaseApp = null;
  }
}
export const app = firebaseApp;

// Initialize Auth safely
let firebaseAuth: any = null;
try {
  if (app) {
    firebaseAuth = getAuth(app);
    setPersistence(firebaseAuth, browserLocalPersistence).catch((err) => {
      purgeOversizedCache();
      setPersistence(firebaseAuth, browserLocalPersistence).catch(() => {});
    });
  }
} catch (e) {
  console.warn('Firebase Auth initialization warning:', e);
}
export const auth = firebaseAuth;

/**
 * Initializes and confirms browserLocalPersistence before any login or sign-up.
 * If quota is exceeded, automatically purges old cache and retries.
 */
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
      } catch (retryErr) {
        console.warn('Retry setPersistence warning:', retryErr);
      }
    }
  }
}

// Initialize Firestore safely
let firestoreDb: any = null;
try {
  if (app) {
    try {
      firestoreDb = initializeFirestore(app, {
        experimentalForceLongPolling: true,
      }, firebaseConfig.firestoreDatabaseId);
    } catch {
      firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    }
  }
} catch (err) {
  console.warn('Firestore initialization warning:', err);
}
export const db = firestoreDb;

export { 
  browserLocalPersistence,
  setPersistence,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  type FirebaseUser
};

// Test connection on boot non-blocking and safe
if (firestoreDb) {
  getDocFromServer(doc(firestoreDb, 'test', 'connection')).catch(() => {});
}
