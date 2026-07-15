/**
 * Auth store — tracks current user session.
 *
 * isLoading = true until the Supabase session check completes (brief flicker prevention).
 */

import { create } from 'zustand';
import type { User, Session } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;

  setUser: (user: User | null, session: Session | null) => void;
  setLoading: (v: boolean) => void;
  signOut: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  isLoading: true,

  setUser: (user, session) => set({ user, session, isLoading: false }),
  setLoading: (v) => set({ isLoading: v }),
  signOut: () => set({ user: null, session: null, isLoading: false }),
}));
