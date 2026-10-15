import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react';
import { api } from '../services/api';

export const AdminLogin: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const token = localStorage.getItem('whisperledger_access_token');
    if (token) {
      api.getMe().then((res) => {
        if (active && res.success && res.data) {
          const role = res.data.role;
          if (role === 'platform_admin') {
            navigate('/', { replace: true });
          }
        }
      }).catch(() => null);
    }
    return () => { active = false; };
  }, [navigate]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await api.login(email.trim(), password);
      if (res.success && res.data?.tokens?.access_token) {
        const user = res.data.user;
        if (user.role !== 'platform_admin') {
          setError('This account does not have platform administrator privileges.');
          setLoading(false);
          return;
        }

        localStorage.setItem('whisperledger_access_token', res.data.tokens.access_token);
        localStorage.setItem('whisperledger_admin_user', JSON.stringify(user));
        navigate('/', { replace: true });
      } else {
        setError(res.error?.message || 'Invalid administrator credentials.');
      }
    } catch {
      setError('Cannot reach the secure sign-in service. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-12 flex items-center justify-center">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5 sm:p-8">
        <div className="flex items-start gap-3 border-b border-slate-100 pb-6">
          <img src="/assets/logo.png" alt="WhisperLedger" className="h-11 w-11 rounded-xl object-cover" />
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">WhisperLedger</p>
            </div>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-950">Operator Console</h1>
          </div>
        </div>

        <p className="mt-5 text-sm leading-6 text-slate-600">
          Restricted access for authorised WhisperLedger operators. This console manages account access, subscriptions and product communications.
        </p>

        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <div>
            <label htmlFor="admin-email" className="mb-1.5 block text-sm font-semibold text-slate-800">
              Administrator Email
            </label>
            <div className="relative">
              <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="admin-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@whisperledger.com"
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-950 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="admin-password" className="mb-1.5 block text-sm font-semibold text-slate-800">
              Password
            </label>
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••••••"
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-11 text-sm text-slate-950 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 py-3 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition disabled:opacity-60"
          >
            <ShieldCheck className="h-4 w-4" />
            {loading ? 'Signing in…' : 'Sign in securely'}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-5 text-xs text-slate-500">
          <span>WhisperLedger Admin</span>
          <span className="text-[11px] text-slate-400">Platform administrators only</span>
        </div>
      </section>
    </main>
  );
};
