'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Settings, Building2, Save } from 'lucide-react';
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
      setProfile({
        name: organization.data.name || '',
        contactEmail: organization.data.contactEmail || '',
        billingEmail: organization.data.billingEmail || '',
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
    onError: (error: any) => {
      setNotice({
        type: 'error',
        message: error?.response?.data?.error || 'Failed to update organization profile.',
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

      <QueryState loading={organization.isLoading} error={organization.error}>
        <section className="rounded-2xl border border-slate-800 bg-[#0e1629] p-6 shadow-sm max-w-2xl">
          <div className="flex items-center gap-2.5 pb-4 border-b border-slate-800 mb-6">
            <div className="grid size-9 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <Building2 size={18} />
            </div>
            <div>
              <h2 className="font-bold text-white text-base">Company Profile</h2>
              <p className="text-xs text-slate-400">Public and billing details for this tenant.</p>
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
              <label className="text-xs font-semibold text-slate-300 uppercase">
                Organization Name
              </label>
              <input
                required
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 uppercase">
                Primary Contact Email
              </label>
              <input
                type="email"
                placeholder="contact@company.com"
                value={profile.contactEmail}
                onChange={(e) => setProfile({ ...profile, contactEmail: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 uppercase">
                Billing & Invoice Email
              </label>
              <input
                type="email"
                placeholder="billing@company.com"
                value={profile.billingEmail}
                onChange={(e) => setProfile({ ...profile, billingEmail: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Stripe receipts and automated invoices are sent to this address.
              </p>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={saveProfile.isPending}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-bold shadow-lg shadow-emerald-500/20 transition active:scale-95 disabled:opacity-50"
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
