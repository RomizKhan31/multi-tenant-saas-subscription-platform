'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { KeyRound, Lock, ShieldCheck } from 'lucide-react';
import axios from 'axios';
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
    onError: (error: unknown) => {
      const message =
        axios.isAxiosError(error) && error.response?.data?.error
          ? error.response.data.error
          : 'Could not change password. Please check your current password.';
      setNotice({
        type: 'error',
        message,
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
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          <span>{notice.message}</span>
          <button onClick={() => setNotice(null)} className="underline ml-4 text-xs font-bold">
            Dismiss
          </button>
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs max-w-xl">
        <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 mb-6">
          <div className="grid size-9 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
            <KeyRound size={18} />
          </div>
          <div>
            <h2 className="font-bold text-slate-900 text-base">Change Password</h2>
            <p className="text-xs text-slate-500">Use at least 8 characters including numbers.</p>
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
            <label className="text-xs font-semibold text-slate-700 uppercase">
              Current Password
            </label>
            <div className="relative mt-1.5">
              <Lock className="absolute left-3.5 top-3 text-slate-400" size={15} />
              <input
                required
                type="password"
                placeholder="••••••••"
                value={password.currentPassword}
                onChange={(e) =>
                  setPassword({ ...password, currentPassword: e.target.value })
                }
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 uppercase">
              New Password
            </label>
            <div className="relative mt-1.5">
              <Lock className="absolute left-3.5 top-3 text-slate-400" size={15} />
              <input
                required
                minLength={8}
                type="password"
                placeholder="At least 8 characters"
                value={password.newPassword}
                onChange={(e) =>
                  setPassword({ ...password, newPassword: e.target.value })
                }
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={passwordMutation.isPending}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-xs transition active:scale-95 disabled:opacity-50"
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
