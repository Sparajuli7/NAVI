/**
 * Auth store — tracks current user session.
 *
 * isGuest = true means the user explicitly chose "Continue without account".
 * isLoading = true until the Supabase session check completes (brief flicker prevention).
 */

import { create } from 'zustand';
import type { User, Session } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isGuest: boolean;

  setUser: (user: User | null, session: Session | null) => void;
  setLoading: (v: boolean) => void;
  continueAsGuest: () => void;
  signOut: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  isLoading: true,
  isGuest: false,

  setUser: (user, session) => set({ user, session, isLoading: false, isGuest: false }),
  setLoading: (v) => set({ isLoading: v }),
  continueAsGuest: () => set({ isGuest: true, isLoading: false }),
  signOut: () => set({ user: null, session: null, isGuest: false, isLoading: false }),
}));
