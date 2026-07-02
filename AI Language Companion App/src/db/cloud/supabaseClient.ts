/**
 * Supabase client singleton.
 *
 * Reads VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from the environment.
 * The anon key is safe to expose in client-side code — Row Level Security
 * enforces data isolation on the server.
 */

import { createClient } from '@supabase/supabase-js';

const url  = import.meta.env.VITE_SUPABASE_URL  as string | undefined;
const key  = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !key) {
  console.warn(
    '[NAVI] Supabase env vars not set (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). ' +
    'Cloud sync will be disabled. App works normally in guest/offline mode.'
  );
}

export const supabase = createClient(
  url  ?? 'https://placeholder.supabase.co',
  key  ?? 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);

/** True when Supabase env vars are actually configured. */
export const isSupabaseConfigured = !!(url && key &&
  url !== 'https://placeholder.supabase.co' &&
  key !== 'placeholder-anon-key');
