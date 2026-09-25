/**
 * Auth screen — email/password + Google OAuth.
 * Mandatory: no guest / skip path.
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Mail, Lock, LogIn, UserPlus, Chrome, Eye, EyeOff, AlertCircle,
  Compass, Cloud, Smartphone, Shield,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../db/cloud/supabaseClient';

interface Props {
  onAuthenticated: () => void;
}

export function AuthScreen({ onAuthenticated }: Props) {
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
    if (!isSupabaseConfigured) { setError('Accounts unavailable.'); return; }
    setLoading(true);
    clearMessages();

    const { error: authError } = tab === 'signin'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });

    setLoading(false);
    if (authError) {
      setError(authError.message);
    } else if (tab === 'signup') {
      setSuccessMsg('Check your email, then sign in.');
    } else {
      onAuthenticated();
    }
  };

  const handleGoogle = async () => {
    if (!isSupabaseConfigured) { setError('Accounts unavailable.'); return; }
    clearMessages();
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/app` },
    });
    if (authError) setError(authError.message);
  };

  return (
    <div className="relative w-full max-w-md mx-auto min-h-screen flex flex-col items-center justify-center px-6 bg-background overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-background to-secondary/10 pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 mb-8 text-center"
      >
        <motion.div
          className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.05, type: 'spring', stiffness: 260, damping: 20 }}
        >
          <Compass className="w-7 h-7 text-primary" strokeWidth={1.75} />
        </motion.div>
        <h1
          className="text-3xl font-bold text-foreground tracking-tight"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          NAVI
        </h1>
        <p className="text-sm text-muted-foreground mt-1.5">Sign in to continue</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.35 }}
        className="relative z-10 w-full bg-card/90 rounded-2xl border border-border/60 p-6"
      >
        {!isSupabaseConfigured ? (
          <div className="text-center py-6 space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <AlertCircle size={22} className="text-muted-foreground" />
            </div>
            <h2 className="text-base font-medium text-foreground">Accounts unavailable</h2>
            <p className="text-sm text-muted-foreground">
              Sign-in isn&apos;t configured here. Try again later.
            </p>
          </div>
        ) : (
          <>
            <div className="flex rounded-xl bg-muted/80 p-1 mb-5">
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
                  {t === 'signin' ? 'Sign in' : 'Sign up'}
                </button>
              ))}
            </div>

            <button
              onClick={handleGoogle}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-border bg-background hover:bg-muted/60 transition-colors text-sm font-medium text-foreground mb-4 disabled:opacity-50"
            >
              <Chrome size={18} />
              Google
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-3.5">
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full pl-9 pr-4 py-3 rounded-xl bg-muted/80 border border-transparent focus:border-secondary outline-none text-sm text-foreground placeholder:text-muted-foreground"
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
                  className="w-full pl-9 pr-10 py-3 rounded-xl bg-muted/80 border border-transparent focus:border-secondary outline-none text-sm text-foreground placeholder:text-muted-foreground"
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
                <motion.p
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs text-red-400 bg-red-400/10 px-3 py-2 rounded-lg"
                >
                  {error}
                </motion.p>
              )}
              {successMsg && (
                <motion.p
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs text-emerald-400 bg-emerald-400/10 px-3 py-2 rounded-lg"
                >
                  {successMsg}
                </motion.p>
              )}

              <button
                type="submit"
                disabled={loading || !email || !password}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-secondary text-white font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-40"
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

            <div className="mt-5 pt-4 border-t border-border/60 flex justify-center gap-6">
              {[
                { Icon: Cloud, label: 'Sync' },
                { Icon: Smartphone, label: 'Devices' },
                { Icon: Shield, label: 'Private' },
              ].map(({ Icon, label }, i) => (
                <motion.div
                  key={label}
                  className="flex flex-col items-center gap-1 text-muted-foreground"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 + i * 0.06 }}
                >
                  <Icon className="w-4 h-4 text-secondary/80" strokeWidth={1.75} />
                  <span className="text-[10px] tracking-wide">{label}</span>
                </motion.div>
              ))}
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
