'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, Loader2, AlertCircle, ArrowRight, ArrowLeft } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const { user } = useAuth();

  const [status, setStatus] = useState<'polling' | 'active' | 'failed'>('polling');
  const [errorMessage, setErrorMessage] = useState('');
  const [details, setDetails] = useState<{
    organizationName?: string;
    email?: string;
    planName?: string;
    flow?: 'ONBOARDING' | 'PLAN_CHANGE';
  } | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setStatus('active');
      return;
    }

    let intervalId: NodeJS.Timeout;
    let attempts = 0;
    const maxAttempts = 30; // 30 * 2s = 60 seconds

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
            planName: data.planName,
            flow: data.flow,
          });
          clearInterval(intervalId);
        } else if (normalizedStatus === 'FAILED' || normalizedStatus === 'EXPIRED') {
          setStatus('failed');
          setErrorMessage(data.message || 'Payment processing failed or session expired.');
          clearInterval(intervalId);
        } else {
          // Still pending
          if (attempts >= maxAttempts) {
            clearInterval(intervalId);
            setStatus('failed');
            setErrorMessage('Payment confirmation is taking longer than expected. If your card was charged, please refresh this page in a moment.');
          }
        }
      } catch (err: any) {
        if (attempts >= maxAttempts) {
          clearInterval(intervalId);
          setStatus('failed');
          setErrorMessage('Could not verify payment status. Please refresh this page or contact support.');
        }
      }
    };

    // First check immediately
    checkStatus();
    intervalId = setInterval(checkStatus, 2000);

    return () => clearInterval(intervalId);
  }, [sessionId]);

  const isPlanChange = details?.flow === 'PLAN_CHANGE' || Boolean(user);

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
              We are confirming your payment and updating your subscription plan with Stripe.
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
            <h1 className="text-2xl font-bold text-slate-900">
              {isPlanChange ? 'Subscription Updated!' : 'Organization Activated!'}
            </h1>
            <p className="text-sm text-slate-600">
              {isPlanChange ? (
                <>
                  Your subscription for <strong className="text-slate-800">{details?.organizationName || 'your organization'}</strong> has been upgraded{details?.planName ? ` to the ${details.planName}` : ''}.
                  Your workspace features are now active.
                </>
              ) : details?.organizationName ? (
                <>
                  <strong className="text-slate-800">{details.organizationName}</strong> is now active.
                  A confirmation email has been dispatched.
                </>
              ) : (
                'Your payment was confirmed and your subscription has been updated.'
              )}
            </p>
            <div className="pt-4 flex flex-col gap-2">
              <Link
                href={user?.role === 'ORGANIZATION_ADMIN' ? '/org-admin' : user ? '/' : '/login'}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition"
              >
                {user ? 'Return to Workspace' : 'Sign In to Your Workspace'} <ArrowRight size={16} />
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
              {errorMessage || 'The payment could not be confirmed. Your subscription was not updated.'}
            </p>
            <div className="pt-4 flex flex-col gap-2">
              {user ? (
                <Link
                  href="/org-admin"
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition"
                >
                  <ArrowLeft size={16} /> Return to Organization Dashboard
                </Link>
              ) : (
                <>
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
                </>
              )}
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
