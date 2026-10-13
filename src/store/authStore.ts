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
  firebaseUser: any | null;
  loading: boolean;
  isSigningIn: boolean;
  authError: string | null;
  authSuccessMessage: string | null;
  isAuthModalOpen: boolean;
  setUser: (user: User | null) => void;
  setFirebaseUser: (user: any | null) => void;
  setLoading: (loading: boolean) => void;
  setIsSigningIn: (isSigningIn: boolean) => void;
  setAuthError: (error: string | null) => void;
  setAuthSuccessMessage: (msg: string | null) => void;
  setAuthModalOpen: (open: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: initialCachedUser,
  firebaseUser: null,
  loading: initialCachedUser ? false : true,
  isSigningIn: false,
  authError: null,
  authSuccessMessage: null,
  isAuthModalOpen: false,
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
  setAuthModalOpen: (isAuthModalOpen) => set({ isAuthModalOpen }),
}));

