import { 
  auth, 
  db,
  ensureAuthPersistence,
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail, 
  updateProfile 
} from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { supabase } from './supabase';
import { User } from '../types';
import { dispatchOwnerNotification } from './ownerNotificationService';

export const PRIMARY_OWNER_EMAIL = 'zkdubbingstudio@gmail.com';
export const PRIMARY_ADMIN_EMAIL = PRIMARY_OWNER_EMAIL;

/**
 * Strictly verifies whether an email belongs to the studio owner.
 * Only zkdubbingstudio@gmail.com receives role = "owner" and full admin access.
 */
export function isAuthorizedAdmin(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === PRIMARY_OWNER_EMAIL.toLowerCase();
}

export function isOwner(email?: string | null): boolean {
  return isAuthorizedAdmin(email);
}

const userProfileCache = new Map<string, { user: User; timestamp: number }>();
const PROFILE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function invalidateUserProfileCache(uid?: string | null): void {
  if (uid) userProfileCache.delete(uid);
  else userProfileCache.clear();
}

/**
 * Loads user profile from Supabase database (with resilient fallback to Firestore).
 * Uses in-memory caching to eliminate redundant database and Firebase queries.
 * Never throws — always returns a valid User object.
 */
export async function loadUserProfileFromSupabase(
  uid: string,
  email?: string | null,
  fallbackName?: string | null
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

  // Check in-memory cache first to eliminate duplicate network calls
  const cached = userProfileCache.get(uid);
  if (cached && (Date.now() - cached.timestamp < PROFILE_CACHE_TTL)) {
    return cached.user;
  }

  const cleanEmail = (email || '').trim().toLowerCase();
  const isOwnerUser = isAuthorizedAdmin(cleanEmail);
  const role: 'owner' | 'user' = isOwnerUser ? 'owner' : 'user';
  const nowIso = new Date().toISOString();

  let profileData: any = null;

  // 1. Fetch from Supabase users table safely
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', uid)
      .maybeSingle();

    if (!error && data) {
      profileData = data;
    } else if (cleanEmail) {
      const emailQuery = await supabase
        .from('users')
        .select('*')
        .eq('email', cleanEmail)
        .maybeSingle();
      if (!emailQuery.error && emailQuery.data) {
        profileData = emailQuery.data;
      }
    }
  } catch (err) {
    console.warn('[Profile Sync] Supabase fetch notice:', err);
  }

  // 2. Resilient fallback: fetch from Firestore if Supabase had no row
  if (!profileData && db) {
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) {
        profileData = snap.data();
      }
    } catch (fsErr) {
      console.warn('[Profile Sync] Firestore fallback notice:', fsErr);
    }
  }

  const displayName =
    profileData?.full_name ||
    profileData?.displayName ||
    profileData?.username ||
    fallbackName ||
    (cleanEmail ? cleanEmail.split('@')[0] : 'Anime Fan');

  const userRecord: User = {
    uid,
    id: uid,
    email: cleanEmail,
    name: displayName,
    displayName,
    full_name: displayName,
    photoURL: profileData?.photo_url || profileData?.photoURL || '',
    profilePhoto: profileData?.photo_url || profileData?.profilePhoto || '',
    role: isOwnerUser ? 'owner' : 'user',
    createdAt: profileData?.created_at
      ? (typeof profileData.created_at === 'number' ? profileData.created_at : new Date(profileData.created_at).getTime())
      : Date.now(),
    lastLogin: nowIso,
    settings: profileData?.settings || {
      appearance: 'Dark',
      defaultQuality: '1080p',
      autoplayNext: true,
      rememberPosition: true,
      newEpisodeNotifications: true,
    },
  };

  // 3. Keep profile updated in Supabase in background
  try {
    const supabasePayload = {
      id: uid,
      uid: uid,
      full_name: displayName,
      username: displayName,
      displayName: displayName,
      email: cleanEmail,
      role: isOwnerUser ? 'owner' : 'user',
      created_at: profileData?.created_at || nowIso,
      last_login: nowIso,
    };
    await supabase.from('users').upsert(supabasePayload, { onConflict: 'id' });
  } catch {}

  // 4. Mirror in Firestore for database reliability in background
  if (db) {
    try {
      setDoc(doc(db, 'users', uid), {
        uid,
        id: uid,
        full_name: displayName,
        displayName,
        email: cleanEmail,
        role: isOwnerUser ? 'owner' : 'user',
        created_at: profileData?.created_at || nowIso,
        createdAt: userRecord.createdAt,
        last_login: nowIso,
        lastLogin: nowIso,
      }, { merge: true }).catch(() => {});
    } catch {}
  }

  userProfileCache.set(uid, { user: userRecord, timestamp: Date.now() });
  return userRecord;
}

/**
 * 1. Sign In with Firebase Email & Password:
 * - Direct call to signInWithEmailAndPassword()
 * - Logs exact Firebase error code to console
 * - Does not replace or mask original Firebase error
 * - Verifies auth.currentUser is populated after login
 * - Assigns role = "owner" for zkdubbingstudio@gmail.com and role = "user" for all others
 */
export async function signInWithFirebase(
  email: string,
  password: string
): Promise<User> {
  const cleanEmail = email.trim();
  console.log('[Firebase Auth] Calling signInWithEmailAndPassword for:', cleanEmail);

  if (!auth) {
    const err = new Error('Firebase Authentication is not initialized.');
    (err as any).code = 'auth/not-initialized';
    console.error('[Firebase Auth Error] Code:', (err as any).code, err.message);
    throw err;
  }

  // Ensure persistence before signing in
  await ensureAuthPersistence();

  try {
    // 1. Find every call to signInWithEmailAndPassword (Requirement 1)
    const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
    const fbUser = userCredential.user;

    // 7. Verify that auth.currentUser is populated after login (Requirement 7)
    console.log('[Firebase Auth] Login successful! Verified auth.currentUser:', {
      uid: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      displayName: auth.currentUser?.displayName,
      isPopulated: Boolean(auth.currentUser),
    });

    // 11. If email == "zkdubbingstudio@gmail.com", assign owner role and allow /admin
    const isOwnerUser = isAuthorizedAdmin(fbUser.email || cleanEmail);
    const role: 'owner' | 'user' = isOwnerUser ? 'owner' : 'user';
    const nowIso = new Date().toISOString();

    const userRecord: User = {
      uid: fbUser.uid,
      id: fbUser.uid,
      email: fbUser.email || cleanEmail,
      name: fbUser.displayName || cleanEmail.split('@')[0],
      displayName: fbUser.displayName || cleanEmail.split('@')[0],
      full_name: fbUser.displayName || cleanEmail.split('@')[0],
      photoURL: fbUser.photoURL || '',
      profilePhoto: fbUser.photoURL || '',
      role,
      createdAt: fbUser.metadata?.creationTime ? new Date(fbUser.metadata.creationTime).getTime() : Date.now(),
      lastLogin: nowIso,
      settings: {
        appearance: 'Dark',
        defaultQuality: '1080p',
        autoplayNext: true,
        rememberPosition: true,
        newEpisodeNotifications: true,
      },
    };

    // Load full profile in background without blocking login
    loadUserProfileFromSupabase(fbUser.uid, cleanEmail, fbUser.displayName).catch((err) => {
      console.warn('[Profile Sync] Background load notice:', err);
    });

    return userRecord;
  } catch (err: any) {
    // 2. Log the exact Firebase error code to the console (Requirement 2 & 12)
    console.error('[Firebase Auth Error] signInWithEmailAndPassword failed:', {
      code: err?.code,
      message: err?.message,
      name: err?.name,
      stack: err?.stack,
    });
    // 3. Remove every try/catch that replaces the original Firebase error (Requirement 3)
    // Throw the original Firebase error without replacing or masking it!
    throw err;
  }
}

/**
 * 2. Create Account with Firebase Email & Password:
 * - Direct call to createUserWithEmailAndPassword()
 * - Logs exact Firebase error code to console
 * - Removes custom password validation (Requirement 4)
 * - Verifies auth.currentUser is populated
 * - Assigns role = "owner" for zkdubbingstudio@gmail.com and role = "user" for all others
 */
export async function signUpWithFirebase(
  email: string,
  password: string,
  fullName: string
): Promise<User> {
  const cleanEmail = email.trim();
  const cleanName = fullName.trim();
  console.log('[Firebase Auth] Calling createUserWithEmailAndPassword for:', cleanEmail);

  if (!auth) {
    const err = new Error('Firebase Authentication is not initialized.');
    (err as any).code = 'auth/not-initialized';
    console.error('[Firebase Auth Error] Code:', (err as any).code, err.message);
    throw err;
  }

  // Ensure persistence before sign-up
  await ensureAuthPersistence();

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
    const fbUser = userCredential.user;

    // Update display name in Firebase Auth
    if (cleanName) {
      try {
        await updateProfile(fbUser, { displayName: cleanName });
      } catch (profErr) {
        console.warn('[Firebase Auth] updateProfile notice:', profErr);
      }
    }

    // 7. Verify that auth.currentUser is populated after creation
    console.log('[Firebase Auth] Create account successful! Verified auth.currentUser:', {
      uid: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      displayName: auth.currentUser?.displayName,
      isPopulated: Boolean(auth.currentUser),
    });

    // 11. If email == "zkdubbingstudio@gmail.com", assign owner role and allow /admin
    const isOwnerUser = isAuthorizedAdmin(fbUser.email || cleanEmail);
    const role: 'owner' | 'user' = isOwnerUser ? 'owner' : 'user';
    const nowIso = new Date().toISOString();
    const createdAtMs = Date.now();

    const userRecord: User = {
      uid: fbUser.uid,
      id: fbUser.uid,
      email: fbUser.email || cleanEmail,
      name: cleanName || fbUser.displayName || cleanEmail.split('@')[0],
      displayName: cleanName || fbUser.displayName || cleanEmail.split('@')[0],
      full_name: cleanName || fbUser.displayName || cleanEmail.split('@')[0],
      photoURL: fbUser.photoURL || '',
      profilePhoto: fbUser.photoURL || '',
      role,
      createdAt: createdAtMs,
      lastLogin: nowIso,
      settings: {
        appearance: 'Dark',
        defaultQuality: '1080p',
        autoplayNext: true,
        rememberPosition: true,
        newEpisodeNotifications: true,
      },
    };

    // Save profile in Supabase & Firestore in background
    try {
      await supabase.from('users').upsert({
        id: fbUser.uid,
        uid: fbUser.uid,
        full_name: userRecord.displayName,
        username: userRecord.displayName,
        displayName: userRecord.displayName,
        email: cleanEmail.toLowerCase(),
        role,
        created_at: nowIso,
        last_login: nowIso,
      }, { onConflict: 'id' });
    } catch {}

    if (db) {
      setDoc(doc(db, 'users', fbUser.uid), {
        uid: fbUser.uid,
        id: fbUser.uid,
        full_name: userRecord.displayName,
        displayName: userRecord.displayName,
        email: cleanEmail.toLowerCase(),
        role,
        created_at: nowIso,
        createdAt: createdAtMs,
        last_login: nowIso,
        lastLogin: nowIso,
      }, { merge: true }).catch(() => {});
    }

    // Alert owner via toast if new user joins
    if (!isOwnerUser) {
      dispatchOwnerNotification({
        type: 'new_user',
        title: 'New User Registered',
        details: `${cleanName} (${cleanEmail}) joined ZK Voice Hub`,
        category: 'user',
        userEmail: cleanEmail,
        userName: cleanName,
        actionUrl: '/admin/users',
      }).catch(() => {});
    }

    return userRecord;
  } catch (err: any) {
    // 2. Log the exact Firebase error code to the console
    console.error('[Firebase Auth Error] createUserWithEmailAndPassword failed:', {
      code: err?.code,
      message: err?.message,
      name: err?.name,
      stack: err?.stack,
    });
    // 3. Throw original Firebase error without replacing it
    throw err;
  }
}

/**
 * 3. Forgot Password with Firebase:
 * - Direct call to sendPasswordResetEmail()
 * - Logs exact Firebase error code to console
 * - Does not replace or mask original Firebase error
 */
export async function sendFirebasePasswordReset(email: string): Promise<void> {
  const cleanEmail = email.trim();
  console.log('[Firebase Auth] Calling sendPasswordResetEmail for:', cleanEmail);

  if (!auth) {
    const err = new Error('Firebase Authentication is not initialized.');
    (err as any).code = 'auth/not-initialized';
    console.error('[Firebase Auth Error] Code:', (err as any).code, err.message);
    throw err;
  }

  try {
    await sendPasswordResetEmail(auth, cleanEmail);
    console.log('[Firebase Auth] sendPasswordResetEmail SUCCESS for:', cleanEmail);
  } catch (err: any) {
    console.error('[Firebase Auth Error] sendPasswordResetEmail failed:', {
      code: err?.code,
      message: err?.message,
      name: err?.name,
      stack: err?.stack,
    });
    throw err;
  }
}

/**
 * Unified Sign Out:
 * - Signs out cleanly from Firebase Authentication
 * - Does NOT use custom storage keys
 */
export async function signOutUser(): Promise<void> {
  invalidateUserProfileCache();
  if (auth) {
    try {
      await signOut(auth);
      console.log('[Firebase Auth] signOut SUCCESS');
    } catch (err: any) {
      console.error('[Firebase Auth Error] signOut notice:', err?.code, err?.message);
    }
  }
}

/**
 * Retrieves the current session user directly from Firebase Auth
 * Never reads from localStorage (Requirement 5)
 */
export async function getActiveAuthUser(): Promise<User | null> {
  if (auth?.currentUser) {
    return await loadUserProfileFromSupabase(
      auth.currentUser.uid,
      auth.currentUser.email,
      auth.currentUser.displayName
    );
  }
  return null;
}
