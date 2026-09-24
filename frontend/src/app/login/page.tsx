'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import axios from 'axios';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleQuickFill = (e: string, p: string) => {
    setEmail(e);
    setPassword(p);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);

      // Redirect based on role
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (user.role === 'PLATFORM_ADMIN') {
        router.push('/platform-admin');
      } else if (user.role === 'ORGANIZATION_ADMIN') {
        router.push('/org-admin');
      } else {
        router.push('/org-member');
      }
    } catch (err: unknown) {
      const message =
        axios.isAxiosError(err) && err.response?.data?.error
          ? (err.response.data.error as string)
          : 'Login failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center size-12 rounded-xl bg-indigo-600 text-white font-black text-xl mb-3">
            O
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Sign in to your account
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Access your multi-tenant organization dashboard
          </p>
        </div>

        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Email address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="name@company.com"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-slate-700">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  Forgot password?
                </Link>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={16} /> Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          <div className="pt-4 border-t border-slate-100 text-center">
            <p className="text-sm text-slate-600">
              New to the platform?{' '}
              <Link href="/register" className="font-semibold text-indigo-600 hover:text-indigo-800">
                Register & subscribe
              </Link>
            </p>
          </div>

          {/* Quick login helper for evaluation */}
          <div className="pt-2 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 text-center">
              Quick Fill Demo Credentials
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQuickFill('platform-admin@example.com', 'PlatformAdmin123!')}
                className="text-xs py-1.5 px-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 font-medium text-slate-700 truncate"
                title="platform-admin@example.com"
              >
                Platform Admin
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('org-admin@example.com', 'OrgAdmin123!')}
                className="text-xs py-1.5 px-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 font-medium text-slate-700 truncate"
                title="org-admin@example.com"
              >
                Org Admin
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('org-member@example.com', 'OrgMember123!')}
                className="text-xs py-1.5 px-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 font-medium text-slate-700 truncate"
                title="org-member@example.com"
              >
                Org Member
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
