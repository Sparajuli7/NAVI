/**
 * Auth screen — email/password + Google OAuth + "Continue without account".
 *
 * Shown on first launch (when no session exists). User can always skip.
 * Accessible later via Settings → Account.
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Mail, Lock, LogIn, UserPlus, Chrome, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../db/cloud/supabaseClient';

interface Props {
  onAuthenticated: () => void;
  onSkip: () => void;
}

export function AuthScreen({ onAuthenticated, onSkip }: Props) {
  const [tab, setTab]             = useState<'signin' | 'signup'>('signin');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [showPw, setShowPw]       = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const clearMessages = () => { setError(''); setSuccessMsg(''); };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured) { setError('Account system not configured yet.'); return; }
    setLoading(true);
    clearMessages();

    const { error: authError } = tab === 'signin'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });

    setLoading(false);
    if (authError) {
      setError(authError.message);
    } else if (tab === 'signup') {
      setSuccessMsg('Check your email for a confirmation link, then come back and sign in!');
    } else {
      onAuthenticated();
    }
  };

  const handleGoogle = async () => {
    if (!isSupabaseConfigured) { setError('Account system not configured yet.'); return; }
    clearMessages();
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (authError) setError(authError.message);
    // onAuthenticated() will be called by the onAuthStateChange listener in useAuth
  };

  return (
    <div className="relative w-full max-w-md mx-auto min-h-screen flex flex-col items-center justify-center px-6 bg-background">
      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 text-center"
      >
        <div className="text-5xl mb-3">🌏</div>
        <h1 className="font-playfair text-3xl font-bold text-foreground">NAVI</h1>
        <p className="text-sm text-muted-foreground mt-1">Your language companion</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="w-full bg-card rounded-2xl border border-border p-6 shadow-lg"
      >
        {/* Tabs */}
        <div className="flex rounded-xl bg-muted p-1 mb-6">
          {(['signin', 'signup'] as const).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); clearMessages(); }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                tab === t
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>

        {/* Google OAuth */}
        <button
          onClick={handleGoogle}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-border bg-background hover:bg-muted transition-colors text-sm font-medium text-foreground mb-4 disabled:opacity-50"
        >
          <Chrome size={18} />
          Continue with Google
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Email form */}
        <form onSubmit={handleEmailAuth} className="space-y-4">
          <div className="relative">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full pl-9 pr-4 py-3 rounded-xl bg-muted border border-transparent focus:border-[var(--color-teal)] outline-none text-sm text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type={showPw ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full pl-9 pr-10 py-3 rounded-xl bg-muted border border-transparent focus:border-[var(--color-teal)] outline-none text-sm text-foreground placeholder:text-muted-foreground"
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-400/10 px-3 py-2 rounded-lg">{error}</p>
          )}
          {successMsg && (
            <p className="text-xs text-emerald-400 bg-emerald-400/10 px-3 py-2 rounded-lg">{successMsg}</p>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[var(--color-teal)] text-white font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : tab === 'signin' ? (
              <><LogIn size={16} /> Sign in</>
            ) : (
              <><UserPlus size={16} /> Create account</>
            )}
          </button>
        </form>

        {/* What you get */}
        <div className="mt-5 pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground text-center mb-3 font-medium">With an account you get:</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              ['☁️', 'Cloud sync'],
              ['📱', 'Multi-device'],
              ['🔒', 'Private & secure'],
            ].map(([icon, label]) => (
              <div key={label} className="text-xs text-muted-foreground">
                <div className="text-base mb-1">{icon}</div>
                {label}
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Skip */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        onClick={onSkip}
        className="mt-6 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        Continue without account <ArrowRight size={14} />
      </motion.button>

      <p className="mt-4 text-xs text-muted-foreground/50 text-center">
        Your data stays on your device either way. An account just adds cloud backup.
      </p>
    </div>
  );
}
