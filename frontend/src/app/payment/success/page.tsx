'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, Loader2, AlertCircle, ArrowRight } from 'lucide-react';
import api from '@/lib/api';

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');

  const [status, setStatus] = useState<'polling' | 'active' | 'failed'>('polling');
  const [errorMessage, setErrorMessage] = useState('');
  const [details, setDetails] = useState<{ organizationName?: string; email?: string } | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setStatus('active');
      return;
    }

    let intervalId: NodeJS.Timeout;
    let attempts = 0;
    const maxAttempts = 30; // 30 * 2.5s = 75 seconds

    const checkStatus = async () => {
      attempts++;
      try {
        const response = await api.get(`/auth/onboard-status?sessionId=${sessionId}`);
        const data = response.data;
        const normalizedStatus = (data.status || '').toUpperCase();

        if (normalizedStatus === 'ACTIVE' || normalizedStatus === 'COMPLETED') {
          setStatus('active');
          setDetails({
            organizationName: data.organizationName,
            email: data.email,
          });
          clearInterval(intervalId);
        } else if (normalizedStatus === 'FAILED' || normalizedStatus === 'EXPIRED') {
          setStatus('failed');
          setErrorMessage(data.message || 'Payment processing failed or registration expired.');
          clearInterval(intervalId);
        } else {
          // Still pending
          if (attempts >= maxAttempts) {
            clearInterval(intervalId);
            setStatus('active'); // Webhook may take a bit longer or email confirmation was sent
          }
        }
      } catch (err: any) {
        if (attempts >= maxAttempts) {
          clearInterval(intervalId);
          setStatus('active');
        }
      }
    };

    // First check immediately
    checkStatus();
    intervalId = setInterval(checkStatus, 2500);

    return () => clearInterval(intervalId);
  }, [sessionId]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 shadow-sm text-center">
        {status === 'polling' && (
          <div className="space-y-4">
            <div className="size-14 rounded-full bg-indigo-50 text-indigo-600 mx-auto flex items-center justify-center">
              <Loader2 className="animate-spin" size={28} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Confirming Payment</h1>
            <p className="text-sm text-slate-600">
              We are waiting for Stripe’s authoritative webhook to confirm your payment and securely provision your tenant account.
            </p>
            <div className="text-xs text-slate-400 bg-slate-50 rounded-lg p-3">
              Session ID: <span className="font-mono">{sessionId?.substring(0, 16)}...</span>
            </div>
          </div>
        )}

        {status === 'active' && (
          <div className="space-y-4">
            <div className="size-14 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
              <CheckCircle2 size={32} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Organization Activated!</h1>
            <p className="text-sm text-slate-600">
              {details?.organizationName ? (
                <>
                  <strong className="text-slate-800">{details.organizationName}</strong> is now active.
                  A confirmation email has been dispatched.
                </>
              ) : (
                'Your payment was confirmed and your organization has been activated.'
              )}
            </p>
            <div className="pt-4">
              <Link
                href="/login"
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition"
              >
                Sign In to Your Workspace <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        )}

        {status === 'failed' && (
          <div className="space-y-4">
            <div className="size-14 rounded-full bg-rose-50 text-rose-600 mx-auto flex items-center justify-center">
              <AlertCircle size={32} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Payment Unsuccessful</h1>
            <p className="text-sm text-slate-600">
              {errorMessage || 'The payment could not be confirmed. Your organization was not activated.'}
            </p>
            <div className="pt-4 flex flex-col gap-2">
              <Link
                href="/register"
                className="w-full inline-flex items-center justify-center rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition"
              >
                Try Registration Again
              </Link>
              <Link
                href="/login"
                className="text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                Back to Sign In
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    }>
      <PaymentSuccessContent />
    </Suspense>
  );
}
