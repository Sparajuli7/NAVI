/**
 * useAuth — wraps Supabase auth state changes and syncs to authStore.
 *
 * On mount: checks for existing session (returns immediately if logged in).
 * On auth state change: upgrades/downgrades the database implementation.
 */

import { useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../db/cloud/supabaseClient';
import { useAuthStore } from './authStore';
import { setDatabase, resetToLocal } from '../db';
import { CloudDatabase } from '../db/cloud';
import { pullAll, pushLocalToCloud } from '../db/sync/syncEngine';

export function useAuth(onReady: (userId: string | null) => void) {
  useEffect(() => {
    if (!isSupabaseConfigured) {
      // Supabase not set up yet — run as guest immediately
      useAuthStore.getState().continueAsGuest();
      onReady(null);
      return;
    }

    // Check for existing session (page reload / returning user)
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        await handleLogin(session.user.id, session);
        onReady(session.user.id);
      } else {
        useAuthStore.getState().setLoading(false);
        onReady(null);
      }
    });

    // Listen for future auth changes (login / logout / token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        await handleLogin(session.user.id, session);
      } else if (event === 'SIGNED_OUT') {
        resetToLocal();
        useAuthStore.getState().signOut();
      }
    });

    // Flush the local snapshot to the cloud when the tab is backgrounded or
    // closed (mobile app-switch, desktop close). The app writes straight to
    // IndexedDB, so this is what carries post-login changes up to Supabase.
    let flushing = false;
    const flush = () => {
      if (document.visibilityState !== 'hidden') return;
      const userId = useAuthStore.getState().user?.id;
      if (!userId || flushing) return;
      flushing = true;
      void pushLocalToCloud(userId).finally(() => { flushing = false; });
    };
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('pagehide', flush);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', flush);
      window.removeEventListener('pagehide', flush);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

async function handleLogin(userId: string, session: import('@supabase/supabase-js').Session) {
  // Check if cloud is empty (brand-new account)
  const { data: existingChars } = await supabase
    .from('characters').select('id').eq('user_id', userId).limit(1);

  if (!existingChars?.length) {
    // First login — push any local data up to the cloud
    await pushLocalToCloud(userId);
  } else {
    // Returning user — pull cloud data into IndexedDB
    await pullAll(userId);
  }

  // Upgrade to CloudDatabase so future writes go to both local + cloud
  setDatabase(new CloudDatabase(userId));
  useAuthStore.getState().setUser(session.user, session);
}
