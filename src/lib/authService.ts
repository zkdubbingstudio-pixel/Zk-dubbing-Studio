import {
  auth,
  db,
  ensureAuthPersistence,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  trackFirebaseAnalyticsEvent,
  testConnection,
} from './firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { User } from '../types';
import { useAuthStore } from '../store/authStore';
import { dispatchOwnerNotification } from './ownerNotificationService';
import { checkLoginRateLimit, recordLoginFailure, resetLoginRateLimit } from './rateLimiter';
import { sanitizeString, sanitizeUrl } from './security';

export const PRIMARY_OWNER_EMAIL = 'zkdubbingstudio@gmail.com';
export const PRIMARY_ADMIN_EMAIL = PRIMARY_OWNER_EMAIL;

export function isAuthorizedAdmin(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === PRIMARY_OWNER_EMAIL.toLowerCase();
}

export function isOwner(email?: string | null): boolean {
  return isAuthorizedAdmin(email);
}

const userProfileCache = new Map<string, { user: User; timestamp: number }>();
const PROFILE_CACHE_TTL = 5 * 60 * 1000;

export function invalidateUserProfileCache(uid?: string | null): void {
  if (uid) userProfileCache.delete(uid);
  else userProfileCache.clear();
}

const DEFAULT_USER_SETTINGS = {
  appearance: 'Dark' as const,
  defaultQuality: '1080p' as const,
  autoplayNext: true,
  rememberPosition: true,
  newEpisodeNotifications: true,
};

/**
 * Creates a default user profile object immediately upon successful Firebase Auth
 * without waiting for Firestore.
 */
function createDefaultUserProfile(uid: string, email?: string | null, fallbackName?: string | null, fallbackPhoto?: string | null): User {
  const cleanEmail = sanitizeString(email || '', 150).trim().toLowerCase();
  const isOwnerUser = isAuthorizedAdmin(cleanEmail);
  const displayName = sanitizeString(
    fallbackName || (cleanEmail ? cleanEmail.split('@')[0] : 'Anime Fan'),
    120
  );
  const resolvedPhoto = sanitizeUrl(fallbackPhoto || auth?.currentUser?.photoURL || '');
  const role: 'owner' | 'user' = isOwnerUser ? 'owner' : 'user';

  return {
    uid: uid || 'anon',
    id: uid || 'anon',
    email: cleanEmail,
    name: displayName,
    displayName,
    full_name: displayName,
    photoURL: resolvedPhoto,
    profilePhoto: resolvedPhoto,
    role,
    isBanned: false,
    isPremium: false,
    premiumTier: 'free',
    createdAt: Date.now(),
    lastLogin: new Date().toISOString(),
    settings: DEFAULT_USER_SETTINGS,
  };
}

/**
 * Loads user profile from Cloud Firestore in the background with a strict 3-second timeout.
 * If Firestore fails or times out, uses default profile object without blocking.
 */
export async function loadUserProfileFromFirestore(
  uid: string,
  email?: string | null,
  fallbackName?: string | null,
  fallbackPhoto?: string | null
): Promise<User> {
  if (!uid) {
    return createDefaultUserProfile('anon', email, fallbackName, fallbackPhoto);
  }

  const cached = userProfileCache.get(uid);
  if (cached && Date.now() - cached.timestamp < PROFILE_CACHE_TTL) {
    return cached.user;
  }

  const defaultProfile = createDefaultUserProfile(uid, email, fallbackName, fallbackPhoto);

  if (!db) {
    useAuthStore.getState().setDatabaseError('Offline mode');
    return defaultProfile;
  }

  try {
    const docRef = doc(db, 'users', uid);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Firestore operation timed out after 3s')), 3000)
    );
    const snap = (await Promise.race([getDoc(docRef), timeoutPromise])) as any;
    if (snap && snap.exists()) {
      const profileData = snap.data();
      const cleanEmail = sanitizeString(profileData?.email || email || '', 150).trim().toLowerCase();
      const isOwnerUser = isAuthorizedAdmin(cleanEmail);
      const displayName = sanitizeString(
        profileData?.displayName || profileData?.name || profileData?.full_name || fallbackName || (cleanEmail ? cleanEmail.split('@')[0] : 'Anime Fan'),
        120
      );
      const resolvedPhoto = sanitizeUrl(profileData?.photoURL || profileData?.photo_url || fallbackPhoto || '');

      const userRecord: User = {
        uid,
        id: uid,
        email: cleanEmail,
        name: displayName,
        displayName,
        full_name: displayName,
        photoURL: resolvedPhoto,
        profilePhoto: resolvedPhoto,
        role: isOwnerUser ? 'owner' : 'user',
        isBanned: Boolean(profileData?.isBanned ?? profileData?.is_banned),
        isPremium: Boolean(profileData?.isPremium ?? profileData?.is_premium),
        premiumTier: profileData?.premiumTier || profileData?.premium_tier || 'free',
        createdAt: typeof profileData?.createdAt === 'number' ? profileData.createdAt : Date.now(),
        lastLogin: new Date().toISOString(),
        settings: profileData?.settings || DEFAULT_USER_SETTINGS,
      };
      userProfileCache.set(uid, { user: userRecord, timestamp: Date.now() });
      useAuthStore.getState().setDatabaseError(null);
      return userRecord;
    }
  } catch (err: any) {
    const code = err?.code || 'firestore/unavailable';
    const msg = err?.message || String(err || '');
    console.warn(`[Firestore Profile Load] Offline mode [${code}] ${msg}`);
    useAuthStore.getState().setDatabaseError(`Offline mode ([${code}] ${msg})`);
  }

  return defaultProfile;
}

function retryFirestoreAfterLogin(): void {
  void testConnection()
    .then((ok) => {
      useAuthStore.getState().setDatabaseError(ok ? null : 'Offline mode');
    })
    .catch(() => {
      useAuthStore.getState().setDatabaseError('Offline mode');
    });
}

export async function signInWithFirebase(email: string, password: string): Promise<User> {
  const cleanEmail = sanitizeString(email, 150).trim().toLowerCase();

  if (!cleanEmail) {
    const err = new Error('Please enter a valid email address.');
    (err as any).code = 'auth/invalid-email';
    throw err;
  }

  const localRate = checkLoginRateLimit(cleanEmail);
  if (!localRate.allowed) {
    const err = new Error(localRate.message || 'Too many failed login attempts. Please wait before retrying.');
    (err as any).code = 'auth/too-many-requests';
    throw err;
  }

  try {
    const serverRateRes = await fetch('/api/auth/rate-limit/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail }),
    });
    if (serverRateRes.status === 429) {
      const rateBody = await serverRateRes.json().catch(() => ({}));
      const err = new Error(rateBody?.message || 'Too many failed login attempts. Please wait before retrying.');
      (err as any).code = 'auth/too-many-requests';
      throw err;
    }
  } catch (e: any) {
    if (e?.code === 'auth/too-many-requests') throw e;
  }

  if (!auth) {
    const err = new Error('Firebase Authentication is not initialized.');
    (err as any).code = 'auth/not-initialized';
    throw err;
  }

  await ensureAuthPersistence();

  let fbUser;
  try {
    const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
    fbUser = userCredential.user;
  } catch (err: any) {
    recordLoginFailure(cleanEmail);
    fetch('/api/auth/rate-limit/record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, success: false }),
    }).catch(() => {});

    console.error('[Firebase Auth Error - signInWithEmailAndPassword]', {
      code: err?.code || 'auth/unknown',
      message: err?.message || String(err || ''),
    });
    throw err;
  }

  resetLoginRateLimit(cleanEmail);
  fetch('/api/auth/rate-limit/record', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: cleanEmail, success: true }),
  }).catch(() => {});

  trackFirebaseAnalyticsEvent('login', { method: 'password' }).catch(() => {});
  retryFirestoreAfterLogin();

  // Return default profile immediately; load Firestore in background
  const defaultUser = createDefaultUserProfile(fbUser.uid, fbUser.email || cleanEmail, fbUser.displayName, fbUser.photoURL);
  
  // Background profile sync
  loadUserProfileFromFirestore(fbUser.uid, fbUser.email || cleanEmail, fbUser.displayName, fbUser.photoURL)
    .then((resolved) => {
      useAuthStore.getState().setUser(resolved);
    })
    .catch(() => {});

  return defaultUser;
}

export async function signInWithGoogle(): Promise<User> {
  if (!auth) {
    const err = new Error('Firebase Authentication is not initialized.');
    (err as any).code = 'auth/not-initialized';
    throw err;
  }

  await ensureAuthPersistence();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  let fbUser;
  try {
    const result = await signInWithPopup(auth, provider);
    fbUser = result.user;
  } catch (err: any) {
    console.error('[Firebase Auth Error - Google Sign-In]', {
      code: err?.code || 'auth/unknown',
      message: err?.message || String(err || ''),
    });
    throw err;
  }

  trackFirebaseAnalyticsEvent('login', { method: 'google' }).catch(() => {});
  retryFirestoreAfterLogin();

  const defaultUser = createDefaultUserProfile(fbUser.uid, fbUser.email, fbUser.displayName, fbUser.photoURL);

  loadUserProfileFromFirestore(fbUser.uid, fbUser.email, fbUser.displayName, fbUser.photoURL)
    .then((resolved) => {
      useAuthStore.getState().setUser(resolved);
    })
    .catch(() => {});

  return defaultUser;
}

export async function signUpWithFirebase(email: string, password: string, fullName: string): Promise<User> {
  const cleanEmail = sanitizeString(email, 150).trim().toLowerCase();
  const cleanName = sanitizeString(fullName, 100).trim();

  if (!cleanEmail) {
    const err = new Error('Please enter a valid email address.');
    (err as any).code = 'auth/invalid-email';
    throw err;
  }

  if (!auth) {
    const err = new Error('Firebase Authentication is not initialized.');
    (err as any).code = 'auth/not-initialized';
    throw err;
  }

  await ensureAuthPersistence();

  let fbUser;
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
    fbUser = userCredential.user;
  } catch (err: any) {
    console.error('[Firebase Auth Error - createUserWithEmailAndPassword]', {
      code: err?.code || 'auth/unknown',
      message: err?.message || String(err || ''),
    });
    throw err;
  }

  if (cleanName) {
    try {
      await updateProfile(fbUser, { displayName: cleanName });
    } catch (err: any) {
      console.warn('[Firebase Auth Warning - updateProfile]', err?.code || 'auth/unknown', err?.message || err);
    }
  }

  const defaultUser = createDefaultUserProfile(fbUser.uid, fbUser.email || cleanEmail, cleanName || fbUser.displayName, fbUser.photoURL);

  userProfileCache.set(fbUser.uid, { user: defaultUser, timestamp: Date.now() });
  trackFirebaseAnalyticsEvent('sign_up', { method: 'password' }).catch(() => {});
  retryFirestoreAfterLogin();

  if (db) {
    setDoc(doc(db, 'users', fbUser.uid), {
      uid: fbUser.uid,
      id: fbUser.uid,
      email: defaultUser.email,
      name: defaultUser.name,
      displayName: defaultUser.displayName,
      full_name: defaultUser.full_name,
      photoURL: defaultUser.photoURL,
      profilePhoto: defaultUser.profilePhoto,
      role: defaultUser.role,
      isBanned: false,
      isPremium: false,
      premiumTier: 'free',
      createdAt: defaultUser.createdAt,
      lastLogin: defaultUser.lastLogin,
      updatedAt: new Date().toISOString(),
      settings: DEFAULT_USER_SETTINGS,
    }).catch(() => {});
  }

  if (!isAuthorizedAdmin(defaultUser.email)) {
    dispatchOwnerNotification({
      type: 'new_user',
      title: 'New User Registered',
      details: `${defaultUser.name} (${defaultUser.email}) joined ZK Voice Hub`,
      category: 'user',
      userEmail: defaultUser.email,
      userName: defaultUser.name,
      actionUrl: '/admin/users',
    }).catch(() => {});
  }

  return defaultUser;
}

export async function sendFirebasePasswordReset(email: string): Promise<void> {
  const cleanEmail = email.trim();
  if (!cleanEmail) {
    const err = new Error('Please enter a valid email address.');
    (err as any).code = 'auth/invalid-email';
    throw err;
  }
  if (!auth) {
    const err = new Error('Firebase Authentication is not initialized.');
    (err as any).code = 'auth/not-initialized';
    throw err;
  }
  try {
    await sendPasswordResetEmail(auth, cleanEmail);
  } catch (err: any) {
    console.error('[Firebase Auth Error - sendPasswordResetEmail]', {
      code: err?.code || 'auth/unknown',
      message: err?.message || String(err || ''),
    });
    throw err;
  }
}

export async function signOutUser(): Promise<void> {
  invalidateUserProfileCache();
  if (auth) {
    try {
      await signOut(auth);
    } catch (err: any) {
      console.error('[Firebase Auth Error - signOut]', {
        code: err?.code || 'auth/unknown',
        message: err?.message || String(err || ''),
      });
      throw err;
    }
  }
}

export async function getActiveAuthUser(): Promise<User | null> {
  if (auth?.currentUser) {
    return createDefaultUserProfile(
      auth.currentUser.uid,
      auth.currentUser.email,
      auth.currentUser.displayName,
      auth.currentUser.photoURL
    );
  }
  return null;
}
