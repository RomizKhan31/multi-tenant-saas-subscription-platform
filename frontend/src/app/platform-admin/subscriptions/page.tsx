'use client';

import { useQuery } from '@tanstack/react-query';
import { Layers } from 'lucide-react';
import api from '@/lib/api';
import { DashboardHeader } from '@/components/DashboardHeader';
import {
  QueryState,
  StatusBadge,
  formatCurrency,
  formatDate,
} from '@/components/dashboard-ui';

type Organization = { _id: string; name: string; status: string };
type Plan = { _id: string; name: string; price: number; billingInterval: string };
type Subscription = {
  _id: string;
  organizationId: string;
  planId: string;
  status: string;
  createdAt: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
};

export default function PlatformAdminSubscriptionsPage() {
  const subscriptions = useQuery({
    queryKey: ['subscriptions-full'],
    queryFn: async () =>
      (await api.get<{ subscriptions: Subscription[] }>('/subscriptions/all')).data.subscriptions,
  });

  const organizations = useQuery({
    queryKey: ['organizations-all'],
    queryFn: async () =>
      (await api.get<{ organizations: Organization[] }>('/organizations')).data.organizations,
  });

  const plans = useQuery({
    queryKey: ['plans-all'],
    queryFn: async () => (await api.get<{ plans: Plan[] }>('/plans')).data.plans,
  });

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Tenant Subscriptions"
        subtitle="Cross-tenant subscription lifecycles, billing renewal dates, and plan assignments."
        badge={
          <span className="rounded-full bg-indigo-50 border border-indigo-200 px-3 py-1 text-xs font-bold text-indigo-700">
            {subscriptions.data?.length ?? 0} Total Records
          </span>
        }
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 mb-5">
          <div className="grid size-9 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
            <Layers size={18} />
          </div>
          <div>
            <h2 className="font-bold text-slate-900 text-base">All Subscriptions</h2>
            <p className="text-xs text-slate-500">Active and past subscription records for all organizations.</p>
          </div>
        </div>

        <QueryState
          loading={subscriptions.isLoading || organizations.isLoading || plans.isLoading}
          error={subscriptions.error || organizations.error || plans.error}
        >
          {!subscriptions.data?.length ? (
            <div className="p-12 text-center text-slate-500 text-sm">
              No subscription records found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="px-5 py-3.5">Organization</th>
                    <th className="px-5 py-3.5">Assigned Plan</th>
                    <th className="px-5 py-3.5">Price & Interval</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Started</th>
                    <th className="px-5 py-3.5">Current Period End</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {subscriptions.data.map((sub) => {
                    const org = organizations.data?.find((o) => o._id === sub.organizationId);
                    const plan = plans.data?.find((p) => p._id === sub.planId);

                    return (
                      <tr key={sub._id} className="hover:bg-slate-50/70 transition">
                        <td className="px-5 py-4 font-bold text-slate-900">
                          {org?.name || sub.organizationId}
                        </td>
                        <td className="px-5 py-4 text-slate-700 font-medium">
                          {plan?.name || 'Custom Plan'}
                        </td>
                        <td className="px-5 py-4 text-slate-500">
                          {plan ? `${formatCurrency(plan.price)} / ${plan.billingInterval.toLowerCase()}` : '—'}
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge value={sub.status} />
                          {sub.cancelAtPeriodEnd && (
                            <span className="block text-[11px] text-amber-600 font-medium mt-1">Cancels at end</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-slate-500">
                          {formatDate(sub.createdAt)}
                        </td>
                        <td className="px-5 py-4 text-slate-700">
                          {sub.currentPeriodEnd ? formatDate(sub.currentPeriodEnd) : 'Ongoing'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </QueryState>
      </section>
    </div>
  );
}
