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
    // Guarantee persistent login across page refresh and browser sessions
    setPersistence(firebaseAuth, browserLocalPersistence).catch((err) => {
      console.warn('Firebase setPersistence warning:', err);
    });
  }
} catch (e) {
  console.warn('Firebase Auth initialization warning:', e);
}
export const auth = firebaseAuth;

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
  getDocFromServer(doc(firestoreDb, 'test', 'connection')).catch((error) => {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Firebase client is currently offline; operating in offline persistence mode.");
    }
  });
}


