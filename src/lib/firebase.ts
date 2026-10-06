import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  GoogleAuthProvider, 
  getAuth, 
  browserPopupRedirectResolver, 
  browserLocalPersistence, 
  setPersistence 
} from 'firebase/auth';
import { initializeFirestore, getFirestore, setLogLevel, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Silence internal Firestore connection logs & timeout warnings in console
try {
  setLogLevel('silent');
} catch {}

// Initialize Firebase App only once (Singleton pattern) safely
let firebaseApp: any = null;
try {
  if (getApps().length === 0) {
    firebaseApp = initializeApp(firebaseConfig);
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

// Configure Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});
googleProvider.addScope('email');
googleProvider.addScope('profile');

export { browserPopupRedirectResolver, browserLocalPersistence };

// Test connection on boot non-blocking and safe
if (firestoreDb) {
  getDocFromServer(doc(firestoreDb, 'test', 'connection')).catch((error) => {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Firebase client is currently offline; operating in offline persistence mode.");
    }
  });
}


