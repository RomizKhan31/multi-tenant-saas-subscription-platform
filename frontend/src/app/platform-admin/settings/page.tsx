'use client';

import { useAuth } from '@/contexts/AuthContext';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Settings, ShieldCheck, Server, Key, Database } from 'lucide-react';

export default function PlatformAdminSettingsPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Platform Settings"
        subtitle="System configurations, security policies, and platform owner controls."
      />

      <div className="grid gap-6 md:grid-cols-2">
        {/* Admin Profile */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 mb-5">
            <div className="grid size-9 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
              <Settings size={18} />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-base">Administrator Profile</h2>
              <p className="text-xs text-slate-500">Current platform owner identity.</p>
            </div>
          </div>

          <div className="space-y-4 text-sm">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Name</label>
              <p className="mt-1 font-bold text-slate-900 text-base">{user?.name || 'Romiz'}</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Email Address</label>
              <p className="mt-1 font-mono text-sm text-slate-700">{user?.email}</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Security Role</label>
              <div className="mt-1">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold">
                  <ShieldCheck size={14} /> PLATFORM_ADMIN (Root Access)
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* System Architecture & Status */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 mb-5">
            <div className="grid size-9 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
              <Server size={18} />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-base">Infrastructure & Security</h2>
              <p className="text-xs text-slate-500">Active protection mechanisms & tenancy rules.</p>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50/60">
              <div className="flex items-center gap-2.5">
                <Database size={16} className="text-indigo-600" />
                <span className="font-semibold text-slate-800">Tenant Isolation Filter</span>
              </div>
              <span className="font-bold text-emerald-600">ENFORCED</span>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50/60">
              <div className="flex items-center gap-2.5">
                <Key size={16} className="text-indigo-600" />
                <span className="font-semibold text-slate-800">Stripe Webhook Signature Verification</span>
              </div>
              <span className="font-bold text-emerald-600">ACTIVE</span>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50/60">
              <div className="flex items-center gap-2.5">
                <ShieldCheck size={16} className="text-indigo-600" />
                <span className="font-semibold text-slate-800">Idempotency & Compensating Transactions</span>
              </div>
              <span className="font-bold text-emerald-600">ACTIVE</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
