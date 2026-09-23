'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { UserCheck, CheckCircle2, Loader2, ArrowRight, AlertCircle } from 'lucide-react';
import api from '@/lib/api';

function AcceptInvitationContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Invalid or missing invitation token.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      await api.post('/members/accept', {
        token,
        name,
        password,
      });
      setSuccess(true);
    } catch (err: any) {
      const errorData = err.response?.data;
      let message = errorData?.error || 'Failed to accept invitation. The link may be expired or already used.';
      if (errorData?.details && Array.isArray(errorData.details) && errorData.details.length > 0) {
        const detailMsg = errorData.details.map((d: any) => d.message).filter(Boolean).join('. ');
        if (detailMsg) message = detailMsg;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 shadow-sm space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center size-12 rounded-xl bg-indigo-50 text-indigo-600 mb-3">
            <UserCheck size={24} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Accept Team Invitation</h1>
          <p className="mt-1 text-sm text-slate-600">
            Set up your name and password to join your organization.
          </p>
        </div>

        {!token && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-sm text-rose-800 flex items-center gap-2">
            <AlertCircle size={18} className="shrink-0 text-rose-600" />
            <span>Missing invitation token. Please check the invitation email you received.</span>
          </div>
        )}

        {success ? (
          <div className="space-y-5 text-center">
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800 flex items-center gap-2">
              <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
              <span>You have joined the team! Your account is active.</span>
            </div>
            <Link
              href="/login"
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition"
            >
              Sign In to Your Workspace <ArrowRight size={16} />
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
                Your Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Smith"
                className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Create Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Confirm Password
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
                  <Loader2 className="animate-spin" size={16} /> Setting up account...
                </>
              ) : (
                'Accept & Join Organization'
              )}
            </button>

            <div className="text-center pt-2">
              <Link
                href="/login"
                className="text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                Already have an active account? Sign In
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    }>
      <AcceptInvitationContent />
    </Suspense>
  );
}
