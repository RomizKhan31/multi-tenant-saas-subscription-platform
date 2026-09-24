'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  CircleDollarSign,
  Layers,
  Clock,
  Wallet,
  ShieldAlert,
  ArrowRight,
  Plus,
  Building2,
} from 'lucide-react';
import api from '@/lib/api';
import {
  DashboardHeader,
} from '@/components/DashboardHeader';
import {
  StatCard,
  StatusBadge,
  QueryState,
  formatCurrency,
  formatDate,
} from '@/components/dashboard-ui';

type Organization = { _id: string; name: string; status: string; createdAt: string };
type Plan = {
  _id: string;
  name: string;
  price: number;
  billingInterval: 'MONTHLY' | 'YEARLY';
  features: string[];
  isActive: boolean;
};
type Subscription = {
  _id: string;
  organizationId: string;
  planId: string;
  status: string;
  createdAt: string;
};
type Transaction = {
  _id: string;
  organizationId: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
};

export default function PlatformAdminOverview() {
  const organizations = useQuery({
    queryKey: ['organizations-overview'],
    queryFn: async () =>
      (await api.get<{ organizations: Organization[] }>('/organizations')).data.organizations,
  });

  const plans = useQuery({
    queryKey: ['plans-overview'],
    queryFn: async () => (await api.get<{ plans: Plan[] }>('/plans')).data.plans,
  });

  const subscriptions = useQuery({
    queryKey: ['subscriptions-overview'],
    queryFn: async () =>
      (await api.get<{ subscriptions: Subscription[] }>('/subscriptions/all')).data.subscriptions,
  });

  const transactions = useQuery({
    queryKey: ['transactions-overview'],
    queryFn: async () =>
      (await api.get<{ transactions: Transaction[] }>('/transactions/all')).data.transactions,
  });

  const metrics = useMemo(() => {
    const orgList = organizations.data || [];
    const txList = transactions.data || [];
    const subList = subscriptions.data || [];

    const totalRevenue = txList
      .filter((t) => t.status === 'SUCCESS')
      .reduce((acc, curr) => acc + curr.amount, 0);

    const activeSubs = subList.filter((s) => s.status === 'ACTIVE').length;
    const trialOrPending = orgList.filter((o) => o.status === 'TRIAL' || o.status === 'PENDING').length;
    const pendingInvoices = txList.filter((t) => t.status === 'PENDING').length;
    const failedPayments = txList.filter((t) => t.status === 'FAILED').length;

    return {
      totalOrganizations: orgList.length,
      totalRevenue,
      activeSubs,
      trialOrPending,
      pendingInvoices,
      failedPayments,
    };
  }, [organizations.data, subscriptions.data, transactions.data]);

  const recentSignups = useMemo(() => {
    return [...(organizations.data || [])]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [organizations.data]);

  return (
    <div className="space-y-8">
      {/* Header matching Image 2 */}
      <DashboardHeader
        title="Owner Dashboard"
        subtitle="Platform share allocation, capital overview, and verification queue"
        actions={
          <>
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700/80 text-xs font-semibold text-slate-300">
              <span className="size-2 rounded-full bg-emerald-400" />
              <span>Pending Audits ({metrics.pendingInvoices})</span>
            </div>
            <Link
              href="/platform-admin/plans"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-bold shadow-lg shadow-emerald-500/20 transition active:scale-95"
            >
              <Plus size={16} />
              <span>New Plan</span>
            </Link>
          </>
        }
      />

      <QueryState
        loading={
          organizations.isLoading ||
          plans.isLoading ||
          subscriptions.isLoading ||
          transactions.isLoading
        }
        error={organizations.error || plans.error || subscriptions.error || transactions.error}
      >
        {/* Stat Cards Grid matching Image 2 */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Total Organizations"
            value={metrics.totalOrganizations}
            detail="Registered tenant accounts"
            icon={<Users size={20} />}
            iconColor="emerald"
          />
          <StatCard
            label="Total Invested / Revenue"
            value={formatCurrency(metrics.totalRevenue)}
            detail="Active platform revenue"
            icon={<CircleDollarSign size={20} />}
            iconColor="emerald"
          />
          <StatCard
            label="Shares Allocated / Subscriptions"
            value={`${metrics.activeSubs} active`}
            detail="Total active shares & subscriptions"
            icon={<Layers size={20} />}
            iconColor="teal"
          />
          <StatCard
            label="Pending Review / Trials"
            value={metrics.trialOrPending}
            detail="Awaiting document verification"
            icon={<Clock size={20} />}
            iconColor="amber"
          />
          <StatCard
            label="Pending Invoices"
            value={metrics.pendingInvoices}
            detail="Awaiting owner allocation review"
            icon={<Wallet size={20} />}
            iconColor="amber"
          />
          <StatCard
            label="Payment Verification / Failed"
            value={metrics.failedPayments}
            detail="Receipts awaiting bank verification"
            icon={<ShieldAlert size={20} />}
            iconColor="rose"
          />
        </div>

        {/* Plan-wise Share Allocation section matching Image 2 bottom */}
        <div className="rounded-2xl border border-slate-800 bg-[#0e1629] p-6 shadow-sm">
          <div className="flex items-center justify-between pb-5 border-b border-slate-800/80">
            <div className="flex items-center gap-2.5">
              <div className="grid size-8 place-items-center rounded-lg bg-emerald-500/10 text-emerald-400">
                <Layers size={18} />
              </div>
              <h2 className="text-base font-bold text-white">Plan-wise Share Allocation</h2>
            </div>
            <Link
              href="/platform-admin/plans"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition"
            >
              <span>Manage Plans</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          <div className="mt-5 space-y-4">
            {plans.data && plans.data.length > 0 ? (
              plans.data.map((plan) => {
                const subCount =
                  subscriptions.data?.filter(
                    (s) => s.planId === plan._id && s.status === 'ACTIVE'
                  ).length || 0;
                const totalSubs = subscriptions.data?.length || 1;
                const percentage = Math.min(100, Math.round((subCount / totalSubs) * 100));

                return (
                  <div
                    key={plan._id}
                    className="p-4 rounded-xl border border-slate-800/90 bg-slate-900/60 transition hover:border-slate-700"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-white text-sm">{plan.name}</p>
                          <StatusBadge value={plan.isActive ? 'ACTIVE' : 'SUSPENDED'} />
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          {formatCurrency(plan.price)} /{' '}
                          {plan.billingInterval === 'MONTHLY' ? 'month' : 'year'} ·{' '}
                          {plan.features?.join(', ') || 'Standard tenant package'}
                        </p>
                      </div>

                      <div className="text-left sm:text-right">
                        <span className="text-xs font-bold text-emerald-400">
                          {subCount} active {subCount === 1 ? 'tenant' : 'tenants'}
                        </span>
                        <p className="text-[11px] text-slate-500">
                          {percentage}% of platform subscriptions
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 w-full bg-slate-800/80 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(5, percentage)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-slate-500 text-sm">
                No subscription plans configured yet.{' '}
                <Link href="/platform-admin/plans" className="text-emerald-400 underline">
                  Create your first plan
                </Link>
                .
              </div>
            )}
          </div>
        </div>

        {/* Recent Tenant Signups */}
        <div className="rounded-2xl border border-slate-800 bg-[#0e1629] p-6 shadow-sm">
          <div className="flex items-center justify-between pb-5 border-b border-slate-800/80">
            <div className="flex items-center gap-2.5">
              <div className="grid size-8 place-items-center rounded-lg bg-emerald-500/10 text-emerald-400">
                <Building2 size={18} />
              </div>
              <h2 className="text-base font-bold text-white">Recent Tenant Signups</h2>
            </div>
            <Link
              href="/platform-admin/organizations"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition"
            >
              <span>View All Organizations</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {recentSignups.map((org) => {
              const sub = subscriptions.data?.find((s) => s.organizationId === org._id);
              const plan = plans.data?.find((p) => p._id === sub?.planId);

              return (
                <div
                  key={org._id}
                  className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col justify-between"
                >
                  <div>
                    <p className="font-bold text-white text-sm truncate">{org.name}</p>
                    <p className="text-xs text-slate-400 mt-1 truncate">
                      {plan?.name || 'Pending Plan'}
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between">
                    <StatusBadge value={org.status} />
                    <span className="text-[11px] text-slate-500">{formatDate(org.createdAt)}</span>
                  </div>
                </div>
              );
            })}
            {!recentSignups.length && (
              <p className="col-span-full py-8 text-center text-sm text-slate-500">
                No organizations registered yet.
              </p>
            )}
          </div>
        </div>
      </QueryState>
    </div>
  );
}
