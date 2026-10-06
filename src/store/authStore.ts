import { create } from 'zustand';
import { User as FirebaseUser } from 'firebase/auth';
import { User } from '../types';

let initialCachedUser: User | null = null;
try {
  const raw = localStorage.getItem('zk_auth_user');
  if (raw) initialCachedUser = JSON.parse(raw);
} catch {}

interface AuthState {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  isSigningIn: boolean;
  authError: string | null;
  authSuccessMessage: string | null;
  setUser: (user: User | null) => void;
  setFirebaseUser: (user: FirebaseUser | null) => void;
  setLoading: (loading: boolean) => void;
  setIsSigningIn: (isSigningIn: boolean) => void;
  setAuthError: (error: string | null) => void;
  setAuthSuccessMessage: (msg: string | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: initialCachedUser,
  firebaseUser: null,
  loading: initialCachedUser ? false : true,
  isSigningIn: false,
  authError: null,
  authSuccessMessage: null,
  setUser: (user) => {
    if (user) {
      try { localStorage.setItem('zk_auth_user', JSON.stringify(user)); } catch {}
    } else {
      try { localStorage.removeItem('zk_auth_user'); } catch {}
    }
    set({ user });
  },
  setFirebaseUser: (firebaseUser) => set({ firebaseUser }),
  setLoading: (loading) => set({ loading }),
  setIsSigningIn: (isSigningIn) => set({ isSigningIn }),
  setAuthError: (authError) => set({ authError }),
  setAuthSuccessMessage: (authSuccessMessage) => set({ authSuccessMessage }),
}));

