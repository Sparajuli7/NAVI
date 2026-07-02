/**
 * AccountPanel — inline account management shown inside SettingsPanel.
 * Shows current user info and sign-out, or sign-in prompt for guests.
 */

import React, { useState } from 'react';
import { LogOut, User, Mail, CheckCircle, Cloud } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../db/cloud/supabaseClient';
import { useAuthStore } from './authStore';
import { resetToLocal } from '../db';

interface Props {
  onSignIn: () => void; // navigate to AuthScreen
}

export function AccountPanel({ onSignIn }: Props) {
  const { user, isGuest } = useAuthStore();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
    resetToLocal();
    useAuthStore.getState().signOut();
    setSigningOut(false);
  };

  if (!isSupabaseConfigured) {
    return (
      <div className="p-4 rounded-xl bg-muted/50 border border-border text-center">
        <p className="text-xs text-muted-foreground">
          Account system not set up yet. Add Supabase env vars to enable.
        </p>
      </div>
    );
  }

  if (user) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[var(--color-teal)]/20 flex items-center justify-center">
            <User size={18} className="text-[var(--color-teal)]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{user.email}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <CheckCircle size={12} className="text-emerald-400" />
              <p className="text-xs text-emerald-400">Syncing to cloud</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
          <Cloud size={12} />
          <span>All your companions and progress are backed up</span>
        </div>

        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-40"
        >
          <LogOut size={14} />
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    );
  }

  // Guest or not logged in
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/50 p-4 space-y-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Mail size={16} />
        <p className="text-sm">
          {isGuest ? 'Using without account' : 'Not signed in'}
        </p>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Create a free account to back up your companions, phrases, and progress across devices.
      </p>
      <button
        onClick={onSignIn}
        className="w-full py-2.5 px-4 rounded-xl bg-[var(--color-teal)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
      >
        Sign in / Create account
      </button>
    </div>
  );
}
