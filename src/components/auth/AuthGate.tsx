import React, { useState } from 'react';
import { Store, Lock, Mail, Loader2, ShieldAlert, ArrowRight, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  signInShopAccount,
  signUpShopAccount,
  claimShopForCurrentUser,
} from '../../services/supabase';

const slugify = (value: string): string => {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '');
  return slug || `shop-${Date.now()}`;
};

const AuthShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen w-full flex items-center justify-center bg-[#F1F5F9] px-4 py-10">
    <div className="w-full max-w-md">
      <div className="flex items-center justify-center gap-2 mb-6">
        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-lg">
          S
        </div>
        <span className="text-xl font-bold text-slate-800">Sellora POS</span>
      </div>
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 sm:p-8">{children}</div>
      <p className="text-center text-xs text-slate-400 mt-6">
        Sellora POS &middot; Secure business login
      </p>
    </div>
  </div>
);

const FieldError: React.FC<{ message: string | null }> = ({ message }) =>
  message ? (
    <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
      <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  ) : null;

const inputClass =
  'w-full pl-10 pr-3 py-2.5 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm text-slate-800 placeholder:text-slate-400';

/** Sign in with an existing email/password shop account. */
const SignInForm: React.FC<{ onSwitchToSignUp: () => void }> = ({ onSwitchToSignUp }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const result = await signInShopAccount(email.trim(), password);
    setBusy(false);
    if (!result.success) {
      setError(result.message);
    }
    // On success, AuthContext's onAuthStateChange listener picks up the
    // new session automatically and re-renders past this screen.
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-slate-800">Sign in to your shop</h1>
        <p className="text-sm text-slate-500 mt-1">Enter the email and password for your business account.</p>
      </div>

      <FieldError message={error} />

      <div className="relative">
        <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="email"
          required
          autoComplete="email"
          placeholder="you@business.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="relative">
        <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="password"
          required
          autoComplete="current-password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
      </div>

      <button
        type="submit"
        disabled={busy}
        className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-colors"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
        Sign In
      </button>

      <p className="text-center text-sm text-slate-500">
        New business?{' '}
        <button type="button" onClick={onSwitchToSignUp} className="text-blue-600 font-semibold hover:underline">
          Create your shop account
        </button>
      </p>
    </form>
  );
};

/** Create a brand-new shop + owner account. */
const SignUpForm: React.FC<{ onSwitchToSignIn: () => void }> = ({ onSwitchToSignIn }) => {
  const [shopName, setShopName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const shopId = shopName.trim() ? slugify(shopName) : '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!shopId) {
      setError('Enter your business name.');
      return;
    }

    setBusy(true);
    const result = await signUpShopAccount(email.trim(), password, shopId);
    setBusy(false);

    if (!result.success) {
      setError(result.message);
      return;
    }
    if (!result.userId) {
      // Email confirmation required before a session exists.
      setInfo(result.message);
      return;
    }
    // Session exists immediately — AuthContext's listener will pick it up
    // and move past this screen once it resolves the new shop membership.
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-slate-800">Create your shop account</h1>
        <p className="text-sm text-slate-500 mt-1">Set up Sellora POS for your business in a minute.</p>
      </div>

      <FieldError message={error} />
      {info && (
        <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          {info}
        </div>
      )}

      <div className="relative">
        <Store className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          required
          placeholder="Business name (e.g. Mama Justo Shop)"
          value={shopName}
          onChange={(e) => setShopName(e.target.value)}
          className={inputClass}
        />
      </div>
      {shopId && (
        <p className="text-xs text-slate-400 -mt-2 pl-1">
          Your unique Shop ID will be <span className="font-mono text-slate-600">{shopId}</span>
        </p>
      )}

      <div className="relative">
        <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="email"
          required
          autoComplete="email"
          placeholder="Owner email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="relative">
        <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="password"
          required
          autoComplete="new-password"
          placeholder="Password (min. 6 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="relative">
        <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="password"
          required
          autoComplete="new-password"
          placeholder="Confirm password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className={inputClass}
        />
      </div>

      <button
        type="submit"
        disabled={busy}
        className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-colors"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
        Create Account
      </button>

      <p className="text-center text-sm text-slate-500">
        Already have a shop?{' '}
        <button type="button" onClick={onSwitchToSignIn} className="text-blue-600 font-semibold hover:underline">
          Sign in
        </button>
      </p>
    </form>
  );
};

/**
 * Shown when a user is signed in via Supabase Auth but has no shop_members
 * row yet (e.g. their sign-up's automatic claim step failed). Lets them
 * link their account to a Shop ID instead of getting stuck.
 */
const LinkShopScreen: React.FC = () => {
  const { userEmail, signOut, refresh } = useAuth();
  const [shopId, setShopId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const clean = slugify(shopId);
    if (!clean) {
      setError('Enter a Shop ID.');
      return;
    }
    setBusy(true);
    const result = await claimShopForCurrentUser(clean);
    setBusy(false);
    if (!result.success) {
      setError(result.message);
      return;
    }
    await refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-slate-800">Link your account to a shop</h1>
        <p className="text-sm text-slate-500 mt-1">
          Signed in as <span className="font-medium text-slate-700">{userEmail}</span>, but this account isn't
          linked to a shop yet.
        </p>
      </div>

      <FieldError message={error} />

      <div className="relative">
        <Store className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          required
          placeholder="Shop ID (e.g. mama-justo-shop)"
          value={shopId}
          onChange={(e) => setShopId(e.target.value)}
          className={inputClass}
        />
      </div>

      <button
        type="submit"
        disabled={busy}
        className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-colors"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
        Link Shop
      </button>

      <button
        type="button"
        onClick={() => signOut()}
        className="w-full inline-flex items-center justify-center gap-2 text-slate-500 hover:text-slate-700 text-sm font-medium py-2"
      >
        <LogOut className="w-3.5 h-3.5" />
        Sign out
      </button>
    </form>
  );
};

const LoadingScreen: React.FC = () => (
  <div className="min-h-screen w-full flex items-center justify-center bg-[#F1F5F9]">
    <div className="flex flex-col items-center gap-3 text-slate-500">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      <span className="text-sm font-medium">Loading Sellora POS…</span>
    </div>
  </div>
);

const UnconfiguredNotice: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen w-full flex flex-col">
    <div className="bg-amber-50 border-b border-amber-200 text-amber-800 text-xs sm:text-sm px-4 py-2 flex items-center gap-2 justify-center text-center">
      <ShieldAlert className="w-4 h-4 shrink-0" />
      <span>
        Cloud backend not configured (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing) — running in local-only
        mode. Multi-tenant data isolation and subscription enforcement are <strong>not active</strong>.
      </span>
    </div>
    <div className="flex-1">{children}</div>
  </div>
);

/**
 * Top-level authentication gate. Wrap the app with this OUTSIDE POSProvider
 * so that by the time POSProvider mounts and reads the current tenant id
 * from storage, AuthContext has already resolved the real authenticated
 * shop and pointed the tenant system at it (see ensureTenantForShop).
 */
export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { configured, loading, userId, shopId } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');

  if (!configured) {
    // Don't silently grant access without saying so - but don't hard-block
    // local development/demo use either. See UnconfiguredNotice.
    return <UnconfiguredNotice>{children}</UnconfiguredNotice>;
  }

  if (loading) {
    return <LoadingScreen />;
  }

  if (!userId) {
    return (
      <AuthShell>
        {mode === 'signin' ? (
          <SignInForm onSwitchToSignUp={() => setMode('signup')} />
        ) : (
          <SignUpForm onSwitchToSignIn={() => setMode('signin')} />
        )}
      </AuthShell>
    );
  }

  if (!shopId) {
    return (
      <AuthShell>
        <LinkShopScreen />
      </AuthShell>
    );
  }

  return <>{children}</>;
};
