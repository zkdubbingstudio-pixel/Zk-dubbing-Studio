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
  type User as FirebaseUser
} from 'firebase/auth';
import { initializeFirestore, getFirestore, setLogLevel, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

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

purgeOversizedCache();

// Read Firebase configuration from environment variables (Requirement 5)
export const resolvedFirebaseConfig = {
  apiKey: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_API_KEY) || firebaseConfig.apiKey || '',
  authDomain: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN) || firebaseConfig.authDomain || '',
  projectId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_PROJECT_ID) || firebaseConfig.projectId || '',
  storageBucket: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET) || firebaseConfig.storageBucket || '',
  messagingSenderId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID) || firebaseConfig.messagingSenderId || '',
  appId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_APP_ID) || firebaseConfig.appId || '',
  firestoreDatabaseId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_DATABASE_ID) || (firebaseConfig as any).firestoreDatabaseId || '',
};

// 1. Initialize Firebase App strictly once using the resolved config (Requirement 5, 8 & 9)
export const app = getApps().length === 0 ? initializeApp(resolvedFirebaseConfig) : getApp();

// 2. Initialize Firebase Auth strictly once (Requirement 9)
export const auth = getAuth(app);

// 3. Set persistence to browserLocalPersistence (Requirement 6)
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.warn('[Firebase Auth] Persistence initialization notice:', err);
  });
}

/**
 * Ensures persistence before critical auth calls, auto-purging old caches if storage quota is hit
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
        console.warn('[Firebase Auth] Retry setPersistence notice:', retryErr);
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
  GoogleAuthProvider,
  signInWithPopup,
  type FirebaseUser
};

// Test connection on boot non-blocking and safe
if (firestoreDb) {
  getDocFromServer(doc(firestoreDb, 'test', 'connection')).catch(() => {});
}
