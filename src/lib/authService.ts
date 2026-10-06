import { 
  signInWithPopup, 
  signInWithRedirect, 
  getRedirectResult, 
  signOut, 
  User as FirebaseUser 
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, googleProvider, browserPopupRedirectResolver, db } from './firebase';
import { User } from '../types';
import { supabase } from './supabase';

export const PRIMARY_ADMIN_EMAIL = 'zkdubbingstudio@gmail.com';

// List of allowed admin email addresses
export const AUTHORIZED_ADMIN_EMAILS: string[] = [
  PRIMARY_ADMIN_EMAIL.toLowerCase(),
  ...(import.meta.env.VITE_ADMIN_EMAILS ? import.meta.env.VITE_ADMIN_EMAILS.split(',').map((e: string) => e.trim().toLowerCase()) : [])
];

export function isAuthorizedAdmin(email?: string | null): boolean {
  if (!email) return false;
  return AUTHORIZED_ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

export function isMobileBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (window.innerWidth <= 768 && ('ontouchstart' in window || navigator.maxTouchPoints > 0));
}

export function getFriendlyAuthErrorMessage(error: any): string {
  if (!error) return 'An unknown authentication error occurred.';
  const code = error.code || '';
  const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'current domain';

  switch (code) {
    case 'auth/unauthorized-domain':
      return `Domain "${currentHost}" is not in the Firebase Authorized Domains list. Please add "${currentHost}", "localhost", and "zk-voicehub.vercel.app" in Firebase Console -> Authentication -> Settings -> Authorized Domains.`;
    case 'auth/operation-not-allowed':
      return 'Google sign-in is not enabled in Firebase Console. Please go to Firebase Console -> Authentication -> Sign-in method -> Google and enable it.';
    case 'auth/popup-blocked':
      return 'Sign-in pop-up was blocked by your browser. Please allow pop-ups for this site or use "Android / Mobile Redirect Sign-In".';
    case 'auth/popup-closed-by-user':
      return 'Sign-in was cancelled before completion.';
    case 'auth/cancelled-popup-request':
      return 'Only one sign-in window can be open at a time.';
    case 'auth/network-request-failed':
      return 'Network connection error. Please verify your internet connection.';
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with the same email address using a different sign-in credential.';
    case 'auth/user-disabled':
      return 'This account has been disabled by an administrator.';
    case 'auth/invalid-api-key':
      return 'Invalid Firebase API key. Please check your Firebase configuration.';
    case 'auth/internal-error':
      return 'Internal authentication error. Please try again or use the redirect sign-in option.';
    default:
      return error.message || 'Google sign-in failed. Please try again.';
  }
}

/**
 * Saves and updates the authenticated user in Firestore collection 'users'
 * and syncs to cache/Supabase.
 */
export async function saveUserToFirestore(firebaseUser: FirebaseUser): Promise<User> {
  const uid = firebaseUser.uid;
  const email = (firebaseUser.email || '').toLowerCase();
  const displayName = firebaseUser.displayName || email.split('@')[0] || 'Anime Fan';
  const photoURL = firebaseUser.photoURL || '';
  const isAdmin = isAuthorizedAdmin(email);

  let existingUser: any = null;

  if (db) {
    try {
      const userDocRef = doc(db, 'users', uid);
      const snap = await getDoc(userDocRef);
      if (snap.exists()) {
        existingUser = snap.data();
      }
    } catch (err) {
      console.warn('Could not read existing user doc from Firestore:', err);
    }
  }

  // Preserve existing role if already admin, or assign admin if authorized email
  const role: 'admin' | 'user' = (isAdmin || existingUser?.role === 'admin') ? 'admin' : 'user';
  const createdAt = existingUser?.createdAt || Date.now();

  const userRecord: User = {
    uid,
    id: uid,
    email,
    displayName,
    photoURL,
    role,
    createdAt,
    settings: existingUser?.settings || {
      appearance: 'Dark',
      defaultQuality: '1080p',
      autoplayNext: true,
      rememberPosition: true,
      newEpisodeNotifications: true,
    },
  };

  // 1. Save / Merge in Firestore
  if (db) {
    try {
      const userDocRef = doc(db, 'users', uid);
      await setDoc(userDocRef, {
        uid,
        id: uid,
        email,
        displayName,
        photoURL,
        role,
        createdAt,
        lastLoginAt: new Date().toISOString(),
        updatedAt: serverTimestamp(),
        settings: userRecord.settings,
      }, { merge: true });
    } catch (err) {
      console.error('Failed to write user to Firestore:', err);
    }
  }

  // 2. Sync to Supabase as secondary backup (non-blocking)
  try {
    await supabase.from('users').upsert({
      id: uid,
      email,
      username: displayName,
      role,
      created_at: new Date(createdAt).toISOString(),
    });
  } catch {}

  // 3. Fast hydration cache in localStorage
  try {
    localStorage.setItem('zk_auth_user', JSON.stringify(userRecord));
  } catch {}

  return userRecord;
}

/**
 * Initiates Google Sign-In with automatic fallback between Popup and Redirect.
 * Specially optimized for Android Chrome and mobile web browsers.
 */
export async function signInWithGoogle(options?: { preferRedirect?: boolean }): Promise<FirebaseUser | null> {
  if (!auth) {
    throw new Error('Firebase Authentication is currently unavailable. Please check your network or configuration.');
  }

  const isMobile = isMobileBrowser();
  const shouldUseRedirect = Boolean(options?.preferRedirect);

  // 1. If redirect is explicitly preferred (e.g. mobile redirect button)
  if (shouldUseRedirect) {
    try {
      await signInWithRedirect(auth, googleProvider);
      return null; // Will redirect away from current page
    } catch (redirectErr: any) {
      console.warn('Redirect sign-in error, attempting popup fallback:', redirectErr);
    }
  }

  // 2. Attempt Popup sign-in
  try {
    const cred = await signInWithPopup(auth, googleProvider, browserPopupRedirectResolver);
    if (cred && cred.user) {
      await saveUserToFirestore(cred.user);
      return cred.user;
    }
    return null;
  } catch (popupErr: any) {
    // If user explicitly closed/cancelled the popup, respect the cancellation
    if (popupErr?.code === 'auth/popup-closed-by-user') {
      throw popupErr;
    }

    // If popup was blocked by browser or failed in mobile webview, automatically fall back to signInWithRedirect
    if (
      popupErr?.code === 'auth/popup-blocked' ||
      popupErr?.code === 'auth/cancelled-popup-request' ||
      popupErr?.code === 'auth/internal-error' ||
      isMobile
    ) {
      console.info('Popup blocked or mobile environment detected; seamlessly falling back to Google redirect sign-in...', popupErr?.code);
      try {
        await signInWithRedirect(auth, googleProvider);
        return null;
      } catch (redirectErr: any) {
        console.error('Redirect sign-in error after popup fallback:', redirectErr);
        throw redirectErr;
      }
    }
    throw popupErr;
  }
}

/**
 * Processes redirect result when returning from Google redirect flow
 */
export async function processRedirectResult(): Promise<User | null> {
  if (!auth) return null;
  try {
    const result = await getRedirectResult(auth);
    if (result && result.user) {
      return await saveUserToFirestore(result.user);
    }
  } catch (error: any) {
    console.error('Error handling redirect sign-in result:', error);
    throw error;
  }
  return null;
}

/**
 * Sign out user cleanly
 */
export async function signOutUser(): Promise<void> {
  try {
    localStorage.removeItem('zk_auth_user');
    if (auth) {
      await signOut(auth);
    }
  } catch (error) {
    console.error('Error during signOut:', error);
    throw error;
  }
}
