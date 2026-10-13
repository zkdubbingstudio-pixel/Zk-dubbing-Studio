import { 
  auth, 
  db,
  ensureAuthPersistence,
  purgeOversizedCache,
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

/**
 * Friendly error messages for Firebase Authentication error codes
 */
export function getFriendlyFirebaseAuthError(error: any): string {
  if (!error) return 'An error occurred during authentication.';
  const code = error?.code || '';
  const msg = typeof error === 'string' ? error : (error.message || '');

  if (code === 'auth/user-not-found' || msg.includes('user-not-found')) {
    return 'No account found with this email. Please switch to Create Account.';
  }
  if (
    code === 'auth/wrong-password' || 
    code === 'auth/invalid-credential' || 
    msg.includes('wrong-password') || 
    msg.includes('invalid-credential')
  ) {
    return 'Incorrect email or password. Please verify and try again.';
  }
  if (code === 'auth/email-already-in-use' || msg.includes('email-already-in-use')) {
    return 'An account with this email already exists. Please switch to the Sign In tab.';
  }
  if (code === 'auth/weak-password' || msg.includes('weak-password')) {
    return 'Password must be at least 6 characters.';
  }
  if (code === 'auth/invalid-email' || msg.includes('invalid-email')) {
    return 'Please enter a valid email address.';
  }
  if (code === 'auth/too-many-requests' || msg.includes('too-many-requests')) {
    return 'Too many failed attempts. Access temporarily locked for security. Please try again shortly or reset your password.';
  }
  if (code === 'auth/network-request-failed' || msg.includes('network-request-failed')) {
    return 'Network connection issue. Please check your internet connectivity.';
  }

  return msg || 'Authentication failed. Please verify your details.';
}

/**
 * Loads user profile from Supabase database (with resilient fallback to Firestore).
 * Does NOT write to localStorage or sessionStorage.
 */
export async function loadUserProfileFromSupabase(
  uid: string,
  email?: string | null,
  fallbackName?: string | null
): Promise<User> {
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
    console.warn('Supabase fetch profile notice:', err);
  }

  // 2. Resilient fallback: fetch from Firestore if Supabase had no row
  if (!profileData && db) {
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) {
        profileData = snap.data();
      }
    } catch (fsErr) {
      console.warn('Firestore fallback fetch notice:', fsErr);
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
    role: isOwnerUser ? 'owner' : (profileData?.role === 'admin' || profileData?.role === 'owner' ? 'owner' : 'user'),
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

  // 3. Keep profile updated in Supabase
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
  } catch (err) {
    console.warn('Could not update profile in Supabase:', err);
  }

  // 4. Mirror in Firestore for database reliability
  if (db) {
    try {
      await setDoc(doc(db, 'users', uid), {
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
      }, { merge: true });
    } catch {}
  }

  return userRecord;
}

/**
 * 2. Create Account:
 * - Initializes auth persistence: await setPersistence(auth, browserLocalPersistence)
 * - Creates user in Firebase Authentication
 * - Sets displayName
 * - Creates matching user profile in Supabase (uid, full_name, email, role = "user" | "owner", created_at, last_login)
 * - Auto-retries if storage quota exceeded
 * - Alerts owner via toast
 */
export async function signUpWithFirebase(
  email: string,
  password: string,
  fullName: string
): Promise<User> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = fullName.trim();

  if (!cleanEmail) throw new Error('Please enter your email address.');
  if (!cleanName) throw new Error('Please enter your full name.');
  if (!password) throw new Error('Please enter your password.');
  if (password.length < 6) throw new Error('Password must be at least 6 characters.');

  if (!auth) {
    throw new Error('Firebase Authentication is currently unavailable. Please refresh.');
  }

  // 1. Initialize auth persistence before login/sign-up (Requirement 2 & 3)
  await ensureAuthPersistence();

  // 2. Create Firebase Authentication user (with auto-retry on quota error)
  let userCredential;
  try {
    userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
  } catch (err: any) {
    const msg = String(err?.message || err || '');
    if (msg.includes('quota') || msg.includes('QuotaExceeded') || msg.includes('auth/internal-error')) {
      purgeOversizedCache();
      try {
        await ensureAuthPersistence();
        userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      } catch (retryErr: any) {
        throw new Error(getFriendlyFirebaseAuthError(retryErr));
      }
    } else {
      throw new Error(getFriendlyFirebaseAuthError(err));
    }
  }

  const fbUser = userCredential.user;

  // 3. Set Firebase displayName
  try {
    await updateProfile(fbUser, { displayName: cleanName });
  } catch {}

  const isOwnerUser = isAuthorizedAdmin(cleanEmail);
  const role: 'owner' | 'user' = isOwnerUser ? 'owner' : 'user';
  const nowIso = new Date().toISOString();
  const createdAtMs = Date.now();

  const userRecord: User = {
    uid: fbUser.uid,
    id: fbUser.uid,
    email: cleanEmail,
    name: cleanName,
    displayName: cleanName,
    full_name: cleanName,
    photoURL: '',
    profilePhoto: '',
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

  // 4. Create matching user profile in Supabase
  try {
    await supabase.from('users').upsert({
      id: fbUser.uid,
      uid: fbUser.uid,
      full_name: cleanName,
      username: cleanName,
      displayName: cleanName,
      email: cleanEmail,
      role: isOwnerUser ? 'owner' : 'user',
      created_at: nowIso,
      last_login: nowIso,
    }, { onConflict: 'id' });
  } catch (err) {
    console.warn('Could not save user profile to Supabase users table:', err);
  }

  // 5. Mirror profile in Firestore
  if (db) {
    try {
      await setDoc(doc(db, 'users', fbUser.uid), {
        uid: fbUser.uid,
        id: fbUser.uid,
        full_name: cleanName,
        displayName: cleanName,
        email: cleanEmail,
        role: isOwnerUser ? 'owner' : 'user',
        created_at: nowIso,
        createdAt: createdAtMs,
        last_login: nowIso,
        lastLogin: nowIso,
      }, { merge: true });
    } catch {}
  }

  // 6. Alert the owner (zkdubbingstudio@gmail.com) via real-time toast if a new user registered
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
}

/**
 * 3. Sign In:
 * - Initializes auth persistence: await setPersistence(auth, browserLocalPersistence)
 * - Authenticates with Firebase Email + Password
 * - Auto-retries if storage quota exceeded
 * - Loads user profile from Supabase
 */
export async function signInWithFirebase(
  email: string,
  password: string
): Promise<User> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) throw new Error('Please enter your email address.');
  if (!password) throw new Error('Please enter your password.');

  if (!auth) {
    throw new Error('Firebase Authentication is currently unavailable. Please refresh.');
  }

  // 1. Initialize auth persistence before login (Requirement 2 & 3)
  await ensureAuthPersistence();

  // 2. Authenticate with Firebase (with auto-retry on quota error)
  let userCredential;
  try {
    userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
  } catch (err: any) {
    const msg = String(err?.message || err || '');
    if (msg.includes('quota') || msg.includes('QuotaExceeded') || msg.includes('auth/internal-error')) {
      purgeOversizedCache();
      try {
        await ensureAuthPersistence();
        userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
      } catch (retryErr: any) {
        throw new Error(getFriendlyFirebaseAuthError(retryErr));
      }
    } else {
      throw new Error(getFriendlyFirebaseAuthError(err));
    }
  }

  const fbUser = userCredential.user;

  // 3. Load user profile from Supabase
  return await loadUserProfileFromSupabase(fbUser.uid, cleanEmail, fbUser.displayName);
}

/**
 * 4. Forgot Password:
 * - Sends Firebase password reset email
 */
export async function sendFirebasePasswordReset(email: string): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) throw new Error('Please enter your email address.');

  if (!auth) {
    throw new Error('Firebase Authentication is currently unavailable. Please refresh.');
  }

  try {
    await sendPasswordResetEmail(auth, cleanEmail);
  } catch (err: any) {
    throw new Error(getFriendlyFirebaseAuthError(err));
  }
}

/**
 * Unified Sign Out:
 * - Signs out cleanly from Firebase Authentication
 * - Does NOT use custom storage keys
 */
export async function signOutUser(): Promise<void> {
  if (auth) {
    try {
      await signOut(auth);
    } catch (err) {
      console.warn('Notice during Firebase signOut:', err);
    }
  }
}

/**
 * Retrieves the current session user directly from Firebase Auth
 * Never reads from localStorage (Requirement 7)
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

// Backward-compatible alias for any callers
export const authenticateWithEmailPassword = async (
  email: string,
  password: string,
  isExplicitCreate: boolean = false
): Promise<User> => {
  if (isExplicitCreate) {
    return await signUpWithFirebase(email, password, email.split('@')[0]);
  }
  return await signInWithFirebase(email, password);
};
