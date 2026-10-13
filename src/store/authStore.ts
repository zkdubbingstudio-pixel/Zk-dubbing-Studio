import { create } from 'zustand';
import { User } from '../types';

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
  user: null,
  firebaseUser: null,
  loading: true,
  isSigningIn: false,
  authError: null,
  authSuccessMessage: null,
  isAuthModalOpen: false,
  setUser: (user) => set({ user }),
  setFirebaseUser: (firebaseUser) => set({ firebaseUser }),
  setLoading: (loading) => set({ loading }),
  setIsSigningIn: (isSigningIn) => set({ isSigningIn }),
  setAuthError: (authError) => set({ authError }),
  setAuthSuccessMessage: (authSuccessMessage) => set({ authSuccessMessage }),
  setAuthModalOpen: (isAuthModalOpen) => set({ isAuthModalOpen }),
}));
