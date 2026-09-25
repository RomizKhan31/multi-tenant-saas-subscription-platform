'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Save } from 'lucide-react';
import axios from 'axios';
import api from '@/lib/api';
import { DashboardHeader } from '@/components/DashboardHeader';
import { QueryState } from '@/components/dashboard-ui';

type Organization = {
  name: string;
  contactEmail: string;
  billingEmail: string;
  status: string;
};

export default function OrgAdminSettingsPage() {
  const queryClient = useQueryClient();
  const [profile, setProfile] = useState({ name: '', contactEmail: '', billingEmail: '' });
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const organization = useQuery({
    queryKey: ['org-settings-profile'],
    queryFn: async () => (await api.get<Organization>('/organizations/current')).data,
  });

  useEffect(() => {
    if (organization.data) {
      queueMicrotask(() => {
        setProfile({
          name: organization.data.name || '',
          contactEmail: organization.data.contactEmail || '',
          billingEmail: organization.data.billingEmail || '',
        });
      });
    }
  }, [organization.data]);

  const saveProfile = useMutation({
    mutationFn: () => api.put('/organizations/profile', profile),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-settings-profile'] });
      queryClient.invalidateQueries({ queryKey: ['current-org-header'] });
      setNotice({ type: 'success', message: 'Organization profile updated successfully.' });
    },
    onError: (error: unknown) => {
      const message =
        axios.isAxiosError(error) && error.response?.data?.error
          ? error.response.data.error
          : 'Failed to update organization profile.';
      setNotice({
        type: 'error',
        message,
      });
    },
  });

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Organization Settings"
        subtitle="Manage company profile, primary contact email, and billing recipient details."
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

      <QueryState loading={organization.isLoading} error={organization.error}>
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm max-w-2xl">
          <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 mb-6">
            <div className="grid size-9 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
              <Building2 size={18} />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-base">Company Profile</h2>
              <p className="text-xs text-slate-500">Public and billing details for this tenant.</p>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveProfile.mutate();
            }}
            className="space-y-4"
          >
            <div>
              <label className="text-xs font-semibold text-slate-700 uppercase">
                Organization Name
              </label>
              <input
                required
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 uppercase">
                Primary Contact Email
              </label>
              <input
                type="email"
                placeholder="contact@company.com"
                value={profile.contactEmail}
                onChange={(e) => setProfile({ ...profile, contactEmail: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 uppercase">
                Billing & Invoice Email
              </label>
              <input
                type="email"
                placeholder="billing@company.com"
                value={profile.billingEmail}
                onChange={(e) => setProfile({ ...profile, billingEmail: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Stripe receipts and automated invoices are sent to this address.
              </p>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={saveProfile.isPending}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm hover:shadow transition active:scale-95 disabled:opacity-50"
              >
                <Save size={16} />
                <span>{saveProfile.isPending ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          </form>
        </section>
      </QueryState>
    </div>
  );
}
