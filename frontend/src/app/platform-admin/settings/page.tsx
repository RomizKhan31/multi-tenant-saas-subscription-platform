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
        <section className="rounded-2xl border border-slate-800 bg-[#0e1629] p-6 shadow-sm">
          <div className="flex items-center gap-2.5 pb-4 border-b border-slate-800 mb-5">
            <div className="grid size-9 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <Settings size={18} />
            </div>
            <div>
              <h2 className="font-bold text-white text-base">Administrator Profile</h2>
              <p className="text-xs text-slate-400">Current platform owner identity.</p>
            </div>
          </div>

          <div className="space-y-4 text-sm">
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase">Name</label>
              <p className="mt-1 font-bold text-white text-base">{user?.name || 'Romiz'}</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase">Email Address</label>
              <p className="mt-1 font-mono text-sm text-slate-300">{user?.email}</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase">Security Role</label>
              <div className="mt-1">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                  <ShieldCheck size={14} /> PLATFORM_ADMIN (Root Access)
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* System Architecture & Status */}
        <section className="rounded-2xl border border-slate-800 bg-[#0e1629] p-6 shadow-sm">
          <div className="flex items-center gap-2.5 pb-4 border-b border-slate-800 mb-5">
            <div className="grid size-9 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <Server size={18} />
            </div>
            <div>
              <h2 className="font-bold text-white text-base">Infrastructure & Security</h2>
              <p className="text-xs text-slate-400">Active protection mechanisms & tenancy rules.</p>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-slate-900/60">
              <div className="flex items-center gap-2.5">
                <Database size={16} className="text-emerald-400" />
                <span className="font-semibold text-slate-200">Tenant Isolation Filter</span>
              </div>
              <span className="font-bold text-emerald-400">ENFORCED</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-slate-900/60">
              <div className="flex items-center gap-2.5">
                <Key size={16} className="text-emerald-400" />
                <span className="font-semibold text-slate-200">Stripe Webhook Signature Verification</span>
              </div>
              <span className="font-bold text-emerald-400">ACTIVE</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-slate-900/60">
              <div className="flex items-center gap-2.5">
                <ShieldCheck size={16} className="text-emerald-400" />
                <span className="font-semibold text-slate-200">Idempotency & Compensating Transactions</span>
              </div>
              <span className="font-bold text-emerald-400">ACTIVE</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
