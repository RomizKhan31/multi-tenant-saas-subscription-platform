'use client';

import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { User, Save } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { DashboardHeader } from '@/components/DashboardHeader';

export default function OrgMemberProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState({ name: '', email: '' });
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (user) {
      queueMicrotask(() => {
        setProfile({ name: user.name || '', email: user.email || '' });
      });
    }
  }, [user]);

  const profileMutation = useMutation({
    mutationFn: () => api.put('/auth/profile', profile),
    onSuccess: () => {
      setNotice({
        type: 'success',
        message: 'Your profile has been updated successfully. Re-login to refresh the top bar.',
      });
    },
    onError: (error: unknown) => {
      const message =
        axios.isAxiosError(error) && error.response?.data?.error
          ? error.response.data.error
          : 'Could not update profile.';
      setNotice({
        type: 'error',
        message,
      });
    },
  });

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Personal Profile"
        subtitle="Manage your personal contact info and workspace identity."
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
            <User size={18} />
          </div>
          <div>
            <h2 className="font-bold text-slate-900 text-base">Account Identity</h2>
            <p className="text-xs text-slate-500">Your details visible to team members.</p>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            profileMutation.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <label className="text-xs font-semibold text-slate-700 uppercase">Your Name</label>
            <input
              required
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 uppercase">Email Address</label>
            <input
              required
              type="email"
              value={profile.email}
              onChange={(e) => setProfile({ ...profile, email: e.target.value })}
              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
            />
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={profileMutation.isPending}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-xs transition active:scale-95 disabled:opacity-50"
            >
              <Save size={16} />
              <span>{profileMutation.isPending ? 'Saving...' : 'Save Profile'}</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
