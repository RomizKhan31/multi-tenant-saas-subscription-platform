'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, TrendingUp, DollarSign, CheckCircle2 } from 'lucide-react';
import api from '@/lib/api';
import { DashboardHeader } from '@/components/DashboardHeader';
import {
  StatCard,
  QueryState,
  formatCurrency,
} from '@/components/dashboard-ui';

type Organization = { _id: string; name: string; status: string };
type Plan = { _id: string; name: string; price: number };
type Subscription = { _id: string; planId: string; status: string };
type Transaction = { _id: string; amount: number; status: string; currency: string };

export default function PlatformAdminReportsPage() {
  const organizations = useQuery({
    queryKey: ['orgs-report'],
    queryFn: async () =>
      (await api.get<{ organizations: Organization[] }>('/organizations')).data.organizations,
  });

  const transactions = useQuery({
    queryKey: ['tx-report'],
    queryFn: async () =>
      (await api.get<{ transactions: Transaction[] }>('/transactions/all')).data.transactions,
  });

  const plans = useQuery({
    queryKey: ['plans-report'],
    queryFn: async () => (await api.get<{ plans: Plan[] }>('/plans')).data.plans,
  });

  const subscriptions = useQuery({
    queryKey: ['subs-report'],
    queryFn: async () =>
      (await api.get<{ subscriptions: Subscription[] }>('/subscriptions/all')).data.subscriptions,
  });

  const analytics = useMemo(() => {
    const orgs = organizations.data || [];
    const txs = transactions.data || [];
    const subs = subscriptions.data || [];

    const totalRevenue = txs
      .filter((t) => t.status === 'SUCCESS')
      .reduce((sum, t) => sum + t.amount, 0);

    const successfulPayments = txs.filter((t) => t.status === 'SUCCESS').length;

    const activeOrgs = orgs.filter((o) => o.status === 'ACTIVE').length;
    const arpu = activeOrgs > 0 ? totalRevenue / activeOrgs : 0;

    return {
      totalRevenue,
      successfulPayments,
      arpu,
      totalTenants: orgs.length,
      activeSubs: subs.filter((s) => s.status === 'ACTIVE').length,
    };
  }, [organizations.data, transactions.data, subscriptions.data]);

  return (
    <div className="space-y-8">
      <DashboardHeader
        title="Platform Analytics & Reports"
        subtitle="Cross-tenant revenue aggregates, billing success metrics, and portfolio growth health."
      />

      <QueryState
        loading={transactions.isLoading || organizations.isLoading || subscriptions.isLoading}
        error={transactions.error || organizations.error}
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Gross Volume"
            value={formatCurrency(analytics.totalRevenue)}
            detail="Lifetime settled payments"
            icon={<DollarSign size={20} />}
            iconColor="emerald"
          />
          <StatCard
            label="Avg. Revenue Per Tenant"
            value={formatCurrency(analytics.arpu)}
            detail="Active accounts average"
            icon={<TrendingUp size={20} />}
            iconColor="cyan"
          />
          <StatCard
            label="Successful Payments"
            value={analytics.successfulPayments}
            detail="Settled payment attempts"
            icon={<CheckCircle2 size={20} />}
            iconColor="teal"
          />
          <StatCard
            label="Active Subscriptions"
            value={analytics.activeSubs}
            detail="Paying tenant seats"
            icon={<BarChart3 size={20} />}
            iconColor="indigo"
          />
        </div>

        {/* Summary Card */}
        <div className="rounded-2xl border border-slate-800 bg-[#0e1629] p-6 shadow-sm">
          <div className="flex items-center gap-2.5 pb-4 border-b border-slate-800 mb-5">
            <div className="grid size-9 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <BarChart3 size={18} />
            </div>
            <div>
              <h2 className="font-bold text-white text-base">Plan Subscription Overview</h2>
              <p className="text-xs text-slate-400">Active tenant subscriptions by pricing tier.</p>
            </div>
          </div>

          <div className="space-y-4">
            {plans.data?.map((p) => {
              const assigned =
                subscriptions.data?.filter((s) => s.planId === p._id && s.status === 'ACTIVE')
                  .length || 0;
              return (
                <div
                  key={p._id}
                  className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex items-center justify-between"
                >
                  <div>
                    <p className="font-bold text-white text-sm">{p.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {formatCurrency(p.price)} · {assigned} active subscribers
                    </p>
                  </div>
                  <span className="text-sm font-bold text-emerald-400">
                    {assigned} active {assigned === 1 ? 'subscription' : 'subscriptions'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </QueryState>
    </div>
  );
}
