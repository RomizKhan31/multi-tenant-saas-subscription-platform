'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Mail, Loader2, CheckCircle2 } from 'lucide-react';
import api from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.post('/auth/forgot-password', { email });
      setSubmitted(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to request password reset.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 shadow-sm space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center size-12 rounded-xl bg-indigo-50 text-indigo-600 mb-3">
            <Mail size={24} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Forgot Password</h1>
          <p className="mt-1 text-sm text-slate-600">
            Enter your account email to receive a password reset link.
          </p>
        </div>

        {submitted ? (
          <div className="space-y-5 text-center">
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800 flex items-center gap-2">
              <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
              <span>
                If an account exists for <strong className="text-emerald-950">{email}</strong>, a secure password reset link has been dispatched to your email.
              </span>
            </div>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-800"
            >
              <ArrowLeft size={16} /> Return to Sign In
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
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={16} /> Sending Link...
                </>
              ) : (
                'Send Reset Instructions'
              )}
            </button>

            <div className="text-center pt-2">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                <ArrowLeft size={14} /> Back to Sign In
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
