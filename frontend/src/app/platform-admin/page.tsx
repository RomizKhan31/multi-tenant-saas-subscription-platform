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
type SubscriptionSummary = {
  total: number;
  active: number;
  activeByPlan: Array<{ planId: string; count: number }>;
};
type OrganizationSummary = { total: number; trialOrPending: number };
type TransactionSummary = { totalRevenue: number; pending: number; failed: number };

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

  const organizationSummary = useQuery({
    queryKey: ['organization-summary-overview'],
    queryFn: async () => (await api.get<OrganizationSummary>('/organizations/summary')).data,
  });

  const subscriptions = useQuery({
    queryKey: ['subscriptions-overview'],
    queryFn: async () =>
      (await api.get<{ subscriptions: Subscription[] }>('/subscriptions/all')).data.subscriptions,
  });

  const subscriptionSummary = useQuery({
    queryKey: ['subscription-summary-overview'],
    queryFn: async () => (await api.get<SubscriptionSummary>('/subscriptions/summary')).data,
  });

  const transactionSummary = useQuery({
    queryKey: ['transaction-summary-overview'],
    queryFn: async () => (await api.get<TransactionSummary>('/transactions/summary')).data,
  });

  const metrics = useMemo(() => {
    // The summary is calculated in MongoDB across every current tenant
    // subscription. The list endpoint is paginated and must not drive metrics.
    const activeSubs = subscriptionSummary.data?.active ?? 0;

    return {
      totalOrganizations: organizationSummary.data?.total ?? 0,
      totalRevenue: transactionSummary.data?.totalRevenue ?? 0,
      activeSubs,
      trialOrPending: organizationSummary.data?.trialOrPending ?? 0,
      pendingInvoices: transactionSummary.data?.pending ?? 0,
      failedPayments: transactionSummary.data?.failed ?? 0,
    };
  }, [organizationSummary.data, subscriptionSummary.data, transactionSummary.data]);

  const recentSignups = useMemo(() => {
    return [...(organizations.data || [])]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [organizations.data]);

  return (
    <div className="space-y-8">
      {/* Header matching Image 1 styling */}
      <DashboardHeader
        title="Owner Dashboard"
        subtitle="Tenant account health, subscription activity, and verification queue."
        actions={
          <>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 shadow-sm">
              <span className="size-2 rounded-full bg-emerald-500" />
              <span>Pending Audits ({metrics.pendingInvoices})</span>
            </div>
            <Link
              href="/platform-admin/plans"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm hover:shadow transition active:scale-95"
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
          organizationSummary.isLoading ||
          subscriptionSummary.isLoading ||
          transactionSummary.isLoading
        }
        error={organizations.error || plans.error || subscriptions.error || organizationSummary.error || subscriptionSummary.error || transactionSummary.error}
      >
        {/* Stat Cards Grid matching Image 1 */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Total Organizations"
            value={metrics.totalOrganizations}
            detail="Registered tenant accounts"
            icon={<Users size={20} />}
            iconColor="indigo"
          />
          <StatCard
            label="Platform Revenue"
            value={formatCurrency(metrics.totalRevenue)}
            detail="Active platform revenue"
            icon={<CircleDollarSign size={20} />}
            iconColor="emerald"
          />
          <StatCard
            label="Active Subscriptions"
            value={`${metrics.activeSubs} active`}
            detail="Active tenant billing subscriptions"
            icon={<Layers size={20} />}
            iconColor="cyan"
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
            detail="Awaiting payment review"
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

        {/* Plan subscription activity */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between pb-5 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="grid size-8 place-items-center rounded-lg bg-indigo-50 text-indigo-600">
                <Layers size={18} />
              </div>
              <h2 className="text-base font-bold text-slate-900">Plan Subscription Activity</h2>
            </div>
            <Link
              href="/platform-admin/plans"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition"
            >
              <span>Manage Plans</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          <div className="mt-5 space-y-4">
            {plans.data && plans.data.length > 0 ? (
              plans.data.map((plan) => {
                const subCount = subscriptionSummary.data?.activeByPlan.find(
                  (item) => item.planId === plan._id
                )?.count || 0;
                return (
                  <div
                    key={plan._id}
                    className="p-4 rounded-xl border border-slate-200/90 bg-slate-50/60 transition hover:bg-slate-50 hover:border-slate-300"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-900 text-sm">{plan.name}</p>
                          <StatusBadge value={plan.isActive ? 'ACTIVE' : 'SUSPENDED'} />
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          {formatCurrency(plan.price)} /{' '}
                          {plan.billingInterval === 'MONTHLY' ? 'month' : 'year'} ·{' '}
                          {plan.features?.join(', ') || 'Standard tenant package'}
                        </p>
                      </div>

                      <div className="text-left sm:text-right">
                        <span className="text-xs font-bold text-indigo-600">
                          {subCount} active {subCount === 1 ? 'tenant' : 'tenants'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-slate-500 text-sm">
                No subscription plans configured yet.{' '}
                <Link href="/platform-admin/plans" className="text-indigo-600 underline font-medium">
                  Create your first plan
                </Link>
                .
              </div>
            )}
          </div>
        </div>

        {/* Recent Tenant Signups */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between pb-5 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="grid size-8 place-items-center rounded-lg bg-indigo-50 text-indigo-600">
                <Building2 size={18} />
              </div>
              <h2 className="text-base font-bold text-slate-900">Recent Tenant Signups</h2>
            </div>
            <Link
              href="/platform-admin/organizations"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition"
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
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between hover:bg-slate-50 hover:border-slate-300 transition"
                >
                  <div>
                    <p className="font-bold text-slate-900 text-sm truncate">{org.name}</p>
                    <p className="text-xs text-slate-500 mt-1 truncate">
                      {plan?.name || 'Pending Plan'}
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-200/80 flex items-center justify-between">
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
