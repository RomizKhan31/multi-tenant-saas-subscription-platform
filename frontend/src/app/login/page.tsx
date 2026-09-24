'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import axios from 'axios';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

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
              <div className="relative">
                <input
                  type={isPasswordVisible ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 pr-10 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setIsPasswordVisible((visible) => !visible)}
                  className="absolute inset-y-0 right-0 inline-flex w-10 items-center justify-center rounded-r-lg text-slate-400 transition hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
                  aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
                  title={isPasswordVisible ? 'Hide password' : 'Show password'}
                >
                  {isPasswordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
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

        </div>
      </div>
    </div>
  );
}
