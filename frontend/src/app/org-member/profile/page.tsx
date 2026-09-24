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
          <div className="grid size-9 place-items-center rounded-xl bg-cyan-500/10 text-cyan-400">
            <User size={18} />
          </div>
          <div>
            <h2 className="font-bold text-white text-base">Account Identity</h2>
            <p className="text-xs text-slate-400">Your details visible to team members.</p>
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
            <label className="text-xs font-semibold text-slate-300 uppercase">Your Name</label>
            <input
              required
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 uppercase">Email Address</label>
            <input
              required
              type="email"
              value={profile.email}
              onChange={(e) => setProfile({ ...profile, email: e.target.value })}
              className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={profileMutation.isPending}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-bold shadow-lg shadow-emerald-500/20 transition active:scale-95 disabled:opacity-50"
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
