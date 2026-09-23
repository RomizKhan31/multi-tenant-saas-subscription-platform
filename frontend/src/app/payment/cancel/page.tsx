'use client';

import Link from 'next/link';
import { XCircle, ArrowLeft, RefreshCw } from 'lucide-react';

export default function PaymentCancelPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 shadow-sm text-center space-y-6">
        <div className="size-14 rounded-full bg-amber-50 text-amber-600 mx-auto flex items-center justify-center">
          <XCircle size={32} />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-900">Checkout Cancelled</h1>
          <p className="text-sm text-slate-600">
            You exited the checkout session before completing payment. No charges were made, and your organization has not been activated.
          </p>
        </div>

        <div className="space-y-3 pt-2">
          <Link
            href="/register"
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition"
          >
            <RefreshCw size={16} /> Resume Registration
          </Link>

          <Link
            href="/login"
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            <ArrowLeft size={16} /> Return to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
