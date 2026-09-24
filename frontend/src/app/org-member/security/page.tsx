'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { KeyRound, Lock, ShieldCheck } from 'lucide-react';
import api from '@/lib/api';
import { DashboardHeader } from '@/components/DashboardHeader';

export default function OrgMemberSecurityPage() {
  const [password, setPassword] = useState({ currentPassword: '', newPassword: '' });
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const passwordMutation = useMutation({
    mutationFn: () => api.post('/auth/change-password', password),
    onSuccess: () => {
      setPassword({ currentPassword: '', newPassword: '' });
      setNotice({ type: 'success', message: 'Your password has been changed successfully.' });
    },
    onError: (error: any) => {
      setNotice({
        type: 'error',
        message:
          error?.response?.data?.error ||
          'Could not change password. Please check your current password.',
      });
    },
  });

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Security & Credentials"
        subtitle="Manage your password and protect your workspace login."
      />

      {notice && (
        <div
          role="status"
          className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium ${
            notice.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
          }`}
        >
          <span>{notice.message}</span>
          <button onClick={() => setNotice(null)} className="underline ml-4 text-xs font-bold">
            Dismiss
          </button>
        </div>
      )}

      <section className="rounded-2xl border border-slate-800 bg-[#0e1629] p-6 shadow-sm max-w-xl">
        <div className="flex items-center gap-2.5 pb-4 border-b border-slate-800 mb-6">
          <div className="grid size-9 place-items-center rounded-xl bg-indigo-500/10 text-indigo-400">
            <KeyRound size={18} />
          </div>
          <div>
            <h2 className="font-bold text-white text-base">Change Password</h2>
            <p className="text-xs text-slate-400">Use at least 8 characters including numbers.</p>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            passwordMutation.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <label className="text-xs font-semibold text-slate-300 uppercase">
              Current Password
            </label>
            <div className="relative mt-1.5">
              <Lock className="absolute left-3.5 top-3 text-slate-500" size={15} />
              <input
                required
                type="password"
                placeholder="••••••••"
                value={password.currentPassword}
                onChange={(e) =>
                  setPassword({ ...password, currentPassword: e.target.value })
                }
                className="w-full rounded-xl border border-slate-700 bg-slate-900/80 py-2.5 pl-9 pr-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 uppercase">
              New Password
            </label>
            <div className="relative mt-1.5">
              <Lock className="absolute left-3.5 top-3 text-slate-500" size={15} />
              <input
                required
                minLength={8}
                type="password"
                placeholder="At least 8 characters"
                value={password.newPassword}
                onChange={(e) =>
                  setPassword({ ...password, newPassword: e.target.value })
                }
                className="w-full rounded-xl border border-slate-700 bg-slate-900/80 py-2.5 pl-9 pr-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={passwordMutation.isPending}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-bold shadow-lg shadow-emerald-500/20 transition active:scale-95 disabled:opacity-50"
            >
              <ShieldCheck size={16} />
              <span>{passwordMutation.isPending ? 'Updating...' : 'Update Password'}</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
