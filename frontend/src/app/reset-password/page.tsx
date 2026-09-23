'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { KeyRound, CheckCircle2, Loader2, ArrowRight, AlertCircle } from 'lucide-react';
import api from '@/lib/api';

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Invalid or missing password reset token.');
      return;
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      await api.post('/auth/reset-password', {
        token,
        newPassword,
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Password reset failed. The token may be expired or invalid.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 shadow-sm space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center size-12 rounded-xl bg-indigo-50 text-indigo-600 mb-3">
            <KeyRound size={24} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Set New Password</h1>
          <p className="mt-1 text-sm text-slate-600">
            Create a secure new password for your account.
          </p>
        </div>

        {!token && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-sm text-rose-800 flex items-center gap-2">
            <AlertCircle size={18} className="shrink-0 text-rose-600" />
            <span>Missing reset token. Please request a new link from the forgot password page.</span>
          </div>
        )}

        {success ? (
          <div className="space-y-5 text-center">
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800 flex items-center gap-2">
              <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
              <span>Your password has been reset successfully! You can now log in with your new credentials.</span>
            </div>
            <Link
              href="/login"
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition"
            >
              Sign In to Your Account <ArrowRight size={16} />
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-800">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700">
                New Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !token}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={16} /> Updating Password...
                </>
              ) : (
                'Save New Password'
              )}
            </button>

            <div className="text-center pt-2">
              <Link
                href="/login"
                className="text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                Back to Sign In
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
