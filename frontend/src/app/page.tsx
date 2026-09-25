'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { ShieldCheck, Users, CreditCard, ArrowRight } from 'lucide-react';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      if (user.role === 'PLATFORM_ADMIN') {
        router.push('/platform-admin');
      } else if (user.role === 'ORGANIZATION_ADMIN') {
        router.push('/org-admin');
      } else {
        router.push('/org-member');
      }
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-500 font-medium">Loading platform...</div>
      </div>
    );
  }

  if (user) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-9 rounded-xl bg-indigo-600 text-white font-black text-lg flex items-center justify-center">
              O
            </div>
            <span className="font-bold text-slate-900 text-lg">Octopi Digital LLC</span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-semibold text-slate-700 hover:text-slate-900 px-3 py-2"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-xl shadow-sm transition"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-4xl mx-auto px-4 py-16 sm:py-24 text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold ring-1 ring-inset ring-indigo-600/20 mb-6">
          <ShieldCheck size={14} /> Production-Grade Multi-Tenant SaaS
        </div>

        <h1 className="text-4xl sm:text-6xl font-black text-slate-950 tracking-tight leading-tight">
          Secure, Isolated Multi-Tenant Subscription Platform
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Complete tenant isolation, Stripe webhook verification, atomic database transactions, role-based access control, and automated billing.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/register"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-indigo-600 text-white font-semibold shadow-md hover:bg-indigo-700 transition"
          >
            Register Organization <ArrowRight size={18} />
          </Link>
          <Link
            href="/login"
            className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3.5 rounded-xl border border-slate-300 bg-white text-slate-700 font-semibold hover:bg-slate-50 transition"
          >
            Sign In to Existing Workspace
          </Link>
        </div>

        {/* Feature Grid */}
        <div className="mt-16 grid gap-6 sm:grid-cols-3 text-left">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="size-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
              <ShieldCheck size={20} />
            </div>
            <h3 className="font-bold text-slate-900">Strict Tenant Isolation</h3>
            <p className="mt-2 text-sm text-slate-600">
              Database and API level enforcement preventing cross-tenant access or IDOR vulnerabilities.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="size-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
              <CreditCard size={20} />
            </div>
            <h3 className="font-bold text-slate-900">Stripe Webhook Sync</h3>
            <p className="mt-2 text-sm text-slate-600">
              Idempotent webhook processing with atomic database transactions and compensating rollback.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="size-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
              <Users size={20} />
            </div>
            <h3 className="font-bold text-slate-900">3-Tier RBAC</h3>
            <p className="mt-2 text-sm text-slate-600">
              Platform Admin, Organization Admin, and Organization Member panels with strict authorization.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
        Octopi Digital LLC. All Right Reserved.
      </footer>
    </div>
  );
}
