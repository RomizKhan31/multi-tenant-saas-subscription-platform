'use client';

import { useQuery } from '@tanstack/react-query';
import { Building2, ShieldCheck, Calendar, CreditCard } from 'lucide-react';
import api from '@/lib/api';
import { DashboardHeader } from '@/components/DashboardHeader';
import { QueryState, StatusBadge, formatDate } from '@/components/dashboard-ui';

type Organization = { name: string; status: string; createdAt: string };
type Plan = { name: string; billingInterval: string };

export default function OrgMemberOrganizationPage() {
  const organization = useQuery({
    queryKey: ['member-org-details'],
    queryFn: async () => (await api.get<Organization>('/organizations/current')).data,
  });

  const plan = useQuery({
    queryKey: ['member-plan-details'],
    queryFn: async () => (await api.get<Plan>('/subscriptions/current-plan')).data,
    retry: false,
  });

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Organization Information"
        subtitle="Read-only tenant profile and workspace details."
      />

      <QueryState loading={organization.isLoading} error={organization.error}>
        <section className="rounded-2xl border border-slate-800 bg-[#0e1629] p-6 shadow-sm max-w-3xl">
          <div className="flex items-center gap-2.5 pb-4 border-b border-slate-800 mb-6">
            <div className="grid size-9 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <Building2 size={18} />
            </div>
            <div>
              <h2 className="font-bold text-white text-base">Tenant Details</h2>
              <p className="text-xs text-slate-400">Information verified by your workspace administrator.</p>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <p className="text-xs font-semibold uppercase text-slate-400">Company Name</p>
              <p className="text-lg font-bold text-white mt-1">
                {organization.data?.name || 'Workspace'}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <p className="text-xs font-semibold uppercase text-slate-400">Tenant Status</p>
              <div className="mt-2">
                <StatusBadge value={organization.data?.status} />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <p className="text-xs font-semibold uppercase text-slate-400">Current Plan Tier</p>
              <p className="text-sm font-semibold text-emerald-400 mt-1">
                {plan.data
                  ? `${plan.data.name} (${plan.data.billingInterval.toLowerCase()})`
                  : 'Organization Plan Active'}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <p className="text-xs font-semibold uppercase text-slate-400">Tenant Created</p>
              <p className="text-sm font-semibold text-slate-300 mt-1">
                {formatDate(organization.data?.createdAt)}
              </p>
            </div>
          </div>
        </section>
      </QueryState>
    </div>
  );
}
