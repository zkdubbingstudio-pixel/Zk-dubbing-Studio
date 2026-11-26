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
  handleFirestoreError,
  OperationType,
} from './firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { User } from '../types';
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
 * Loads user profile strictly from Cloud Firestore (users/{uid})
 * adhering to Zero-Trust Firestore Security Rules.
 */
export async function loadUserProfileFromFirestore(
  uid: string,
  email?: string | null,
  fallbackName?: string | null,
  fallbackPhoto?: string | null
): Promise<User> {
  if (!uid) {
    return {
      uid: 'anon',
      id: 'anon',
      email: email || '',
      name: fallbackName || 'Anime Fan',
      displayName: fallbackName || 'Anime Fan',
      photoURL: '',
      role: 'user',
      isBanned: false,
      createdAt: Date.now(),
    };
  }

  const cached = userProfileCache.get(uid);
  if (cached && Date.now() - cached.timestamp < PROFILE_CACHE_TTL) {
    return cached.user;
  }

  const cleanEmail = sanitizeString(email || '', 150).trim().toLowerCase();
  const isOwnerUser = isAuthorizedAdmin(cleanEmail);
  const nowIso = new Date().toISOString();

  let profileData: any = null;
  let docExists = false;

  if (db) {
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) {
        docExists = true;
        profileData = snap.data();
      }
    } catch (err: any) {
      if (String(err?.message || '').includes('permission')) {
        handleFirestoreError(err, OperationType.GET, `users/${uid}`);
      }
    }
  }

  const displayName = sanitizeString(
    profileData?.displayName ||
      profileData?.name ||
      profileData?.full_name ||
      profileData?.username ||
      fallbackName ||
      (cleanEmail ? cleanEmail.split('@')[0] : 'Anime Fan'),
    120
  );

  const resolvedPhoto = sanitizeUrl(
    profileData?.photoURL ||
      profileData?.photo_url ||
      profileData?.profilePhoto ||
      fallbackPhoto ||
      auth?.currentUser?.photoURL ||
      ''
  );

  const createdAtMs =
    typeof profileData?.createdAt === 'number'
      ? profileData.createdAt
      : profileData?.created_at
      ? new Date(profileData.created_at).getTime() || Date.now()
      : Date.now();

  const userRecord: User = {
    uid,
    id: uid,
    email: cleanEmail || profileData?.email || '',
    name: displayName,
    displayName,
    full_name: displayName,
    photoURL: resolvedPhoto,
    profilePhoto: resolvedPhoto,
    role: isOwnerUser ? 'owner' : 'user',
    isBanned: Boolean(profileData?.isBanned ?? profileData?.is_banned),
    isPremium: Boolean(profileData?.isPremium ?? profileData?.is_premium),
    premiumTier: profileData?.premiumTier || profileData?.premium_tier || 'free',
    createdAt: createdAtMs,
    lastLogin: nowIso,
    settings: profileData?.settings || DEFAULT_USER_SETTINGS,
  };

  // Persist / update user profile in Cloud Firestore respecting field immutability rules
  if (db && auth?.currentUser && auth.currentUser.uid === uid) {
    try {
      const userRef = doc(db, 'users', uid);
      if (!docExists) {
        await setDoc(userRef, {
          uid,
          id: uid,
          email: userRecord.email,
          name: displayName,
          displayName,
          full_name: displayName,
          photoURL: resolvedPhoto,
          profilePhoto: resolvedPhoto,
          role: isOwnerUser ? 'owner' : 'user',
          isBanned: false,
          isPremium: false,
          premiumTier: 'free',
          createdAt: createdAtMs,
          lastLogin: nowIso,
          updatedAt: nowIso,
          settings: userRecord.settings,
        });
      } else {
        const updatePayload: Record<string, any> = {
          lastLogin: nowIso,
          updatedAt: nowIso,
        };
        if (resolvedPhoto && !profileData?.photoURL) {
          updatePayload.photoURL = resolvedPhoto;
          updatePayload.profilePhoto = resolvedPhoto;
        }
        await updateDoc(userRef, updatePayload);
      }
    } catch {
      // Non-blocking sync error if offline
    }
  }

  userProfileCache.set(uid, { user: userRecord, timestamp: Date.now() });
  return userRecord;
}

export async function signInWithFirebase(email: string, password: string): Promise<User> {
  const cleanEmail = sanitizeString(email, 150).trim().toLowerCase();

  if (!cleanEmail) {
    const err = new Error('Please enter a valid email address.');
    (err as any).code = 'auth/invalid-email';
    throw err;
  }

  // Client + Server-side brute-force rate limit enforcement
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

  try {
    const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
    const fbUser = userCredential.user;

    resetLoginRateLimit(cleanEmail);
    fetch('/api/auth/rate-limit/record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, success: true }),
    }).catch(() => {});

    trackFirebaseAnalyticsEvent('login', { method: 'password' }).catch(() => {});

    return await loadUserProfileFromFirestore(
      fbUser.uid,
      fbUser.email || cleanEmail,
      fbUser.displayName,
      fbUser.photoURL
    );
  } catch (err: any) {
    recordLoginFailure(cleanEmail);
    fetch('/api/auth/rate-limit/record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, success: false }),
    }).catch(() => {});

    throw err;
  }
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
  const result = await signInWithPopup(auth, provider);
  const fbUser = result.user;

  trackFirebaseAnalyticsEvent('login', { method: 'google' }).catch(() => {});

  return await loadUserProfileFromFirestore(
    fbUser.uid,
    fbUser.email,
    fbUser.displayName,
    fbUser.photoURL
  );
}

export async function signUpWithFirebase(email: string, password: string, fullName: string): Promise<User> {
  const cleanEmail = sanitizeString(email, 150).trim().toLowerCase();
  const cleanName = sanitizeString(fullName, 100).trim();

  if (!auth) {
    const err = new Error('Firebase Authentication is not initialized.');
    (err as any).code = 'auth/not-initialized';
    throw err;
  }

  await ensureAuthPersistence();

  const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
  const fbUser = userCredential.user;

  if (cleanName) {
    try {
      await updateProfile(fbUser, { displayName: cleanName });
    } catch {}
  }

  const isOwnerUser = isAuthorizedAdmin(fbUser.email || cleanEmail);
  const role: 'owner' | 'user' = isOwnerUser ? 'owner' : 'user';
  const nowIso = new Date().toISOString();
  const createdAtMs = Date.now();
  const finalName = cleanName || fbUser.displayName || cleanEmail.split('@')[0];

  const userRecord: User = {
    uid: fbUser.uid,
    id: fbUser.uid,
    email: fbUser.email || cleanEmail,
    name: finalName,
    displayName: finalName,
    full_name: finalName,
    photoURL: fbUser.photoURL || '',
    profilePhoto: fbUser.photoURL || '',
    role,
    isBanned: false,
    isPremium: false,
    premiumTier: 'free',
    createdAt: createdAtMs,
    lastLogin: nowIso,
    settings: DEFAULT_USER_SETTINGS,
  };

  if (db) {
    try {
      await setDoc(doc(db, 'users', fbUser.uid), {
        uid: fbUser.uid,
        id: fbUser.uid,
        email: userRecord.email,
        name: finalName,
        displayName: finalName,
        full_name: finalName,
        photoURL: fbUser.photoURL || '',
        profilePhoto: fbUser.photoURL || '',
        role,
        isBanned: false,
        isPremium: false,
        premiumTier: 'free',
        createdAt: createdAtMs,
        lastLogin: nowIso,
        updatedAt: nowIso,
        settings: DEFAULT_USER_SETTINGS,
      });
    } catch {}
  }

  userProfileCache.set(fbUser.uid, { user: userRecord, timestamp: Date.now() });
  trackFirebaseAnalyticsEvent('sign_up', { method: 'password' }).catch(() => {});

  if (!isOwnerUser) {
    dispatchOwnerNotification({
      type: 'new_user',
      title: 'New User Registered',
      details: `${finalName} (${cleanEmail}) joined ZK Voice Hub`,
      category: 'user',
      userEmail: cleanEmail,
      userName: finalName,
      actionUrl: '/admin/users',
    }).catch(() => {});
  }

  return userRecord;
}

export async function sendFirebasePasswordReset(email: string): Promise<void> {
  const cleanEmail = email.trim();
  if (!auth) {
    const err = new Error('Firebase Authentication is not initialized.');
    (err as any).code = 'auth/not-initialized';
    throw err;
  }
  await sendPasswordResetEmail(auth, cleanEmail);
}

export async function signOutUser(): Promise<void> {
  invalidateUserProfileCache();
  if (auth) {
    try {
      await signOut(auth);
    } catch {}
  }
}

export async function getActiveAuthUser(): Promise<User | null> {
  if (auth?.currentUser) {
    return await loadUserProfileFromFirestore(
      auth.currentUser.uid,
      auth.currentUser.email,
      auth.currentUser.displayName,
      auth.currentUser.photoURL
    );
  }
  return null;
}
