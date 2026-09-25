'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  CreditCard,
  DollarSign,
  ArrowRight,
  UserPlus,
  ShieldCheck,
} from 'lucide-react';
import api from '@/lib/api';
import { DashboardHeader } from '@/components/DashboardHeader';
import {
  StatCard,
  StatusBadge,
  QueryState,
  formatCurrency,
  formatDate,
} from '@/components/dashboard-ui';

type Organization = { name: string; contactEmail: string; billingEmail: string; status: string };
type Member = { _id: string; name: string; email: string; role: string; status: string };
type Plan = { _id: string; name: string; price: number; billingInterval: string };
type Subscription = { _id: string; planId: string; status: string; currentPeriodEnd?: string };
type Transaction = { _id: string; amount: number; currency: string; status: string; createdAt: string };

export default function OrgAdminDashboardPage() {
  const organization = useQuery({
    queryKey: ['current-org-overview'],
    queryFn: async () => (await api.get<Organization>('/organizations/current')).data,
  });

  const members = useQuery({
    queryKey: ['members-overview'],
    queryFn: async () => (await api.get<{ members: Member[] }>('/members')).data.members,
  });

  const subscription = useQuery({
    queryKey: ['subscription-overview'],
    queryFn: async () => (await api.get<Subscription>('/subscriptions')).data,
    retry: false,
  });

  const plans = useQuery({
    queryKey: ['active-plans-overview'],
    queryFn: async () => (await api.get<{ plans: Plan[] }>('/plans/active')).data.plans,
  });

  const transactions = useQuery({
    queryKey: ['transactions-overview-org'],
    queryFn: async () =>
      (await api.get<{ transactions: Transaction[] }>('/transactions')).data.transactions,
  });

  const activePlan = plans.data?.find((p) => p._id === subscription.data?.planId);
  const totalSpend = (transactions.data || [])
    .filter((t) => t.status === 'SUCCESS')
    .reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="space-y-8">
      <DashboardHeader
        title={`${organization.data?.name || 'Organization'} Dashboard`}
        subtitle="Workspace telemetry, subscription status, and team management overview."
        actions={
          <div className="flex items-center gap-3">
            <Link
              href="/org-admin/members"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-sm transition"
            >
              <UserPlus size={15} />
              <span>Invite Member</span>
            </Link>
            <Link
              href="/org-admin/plans"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm hover:shadow transition"
            >
              <CreditCard size={15} />
              <span>Manage Plan</span>
            </Link>
          </div>
        }
      />

      <QueryState
        loading={organization.isLoading || members.isLoading || transactions.isLoading}
        error={organization.error}
      >
        {/* Stat Cards Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Team Members"
            value={members.data?.length ?? 0}
            detail="Active seats in organization"
            icon={<Users size={20} />}
            iconColor="indigo"
          />
          <StatCard
            label="Current Plan"
            value={activePlan?.name || (subscription.data?.status === 'TRIAL' ? '14-Day Trial' : 'No Plan')}
            detail={activePlan ? `${formatCurrency(activePlan.price)}/${activePlan.billingInterval.toLowerCase()}` : 'Select a subscription plan'}
            icon={<CreditCard size={20} />}
            iconColor="cyan"
          />
          <StatCard
            label="Subscription Status"
            value={subscription.data?.status || organization.data?.status || 'ACTIVE'}
            detail={subscription.data?.currentPeriodEnd ? `Renews ${formatDate(subscription.data.currentPeriodEnd)}` : 'Tenant active'}
            icon={<ShieldCheck size={20} />}
            iconColor="emerald"
          />
          <StatCard
            label="Recorded Spend"
            value={formatCurrency(totalSpend)}
            detail="Total invoiced & paid"
            icon={<DollarSign size={20} />}
            iconColor="indigo"
          />
        </div>

        {/* Current Plan Banner & Team Summary */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Subscription Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="grid size-9 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
                    <CreditCard size={18} />
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-900 text-base">Subscription Plan</h2>
                    <p className="text-xs text-slate-500">Active tenant entitlement.</p>
                  </div>
                </div>
                <StatusBadge value={subscription.data?.status || organization.data?.status} />
              </div>

              <div className="mt-5 space-y-3">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-xs uppercase font-semibold text-slate-500">Plan Tier</p>
                  <p className="text-xl font-extrabold text-slate-900 mt-1">
                    {activePlan?.name || 'Free Trial / Starter'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {activePlan
                      ? `${formatCurrency(activePlan.price)} per ${activePlan.billingInterval.toLowerCase()}`
                      : 'Upgrade to an active paid plan to unlock more seats.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
              <Link
                href="/org-admin/plans"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition"
              >
                <span>Change or Upgrade Plan</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>

          {/* Team Members Snapshot */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="grid size-9 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
                    <Users size={18} />
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-900 text-base">Team Members</h2>
                    <p className="text-xs text-slate-500">Active accounts ({members.data?.length ?? 0})</p>
                  </div>
                </div>
                <Link
                  href="/org-admin/members"
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                >
                  Manage Roster
                </Link>
              </div>

              <div className="mt-4 divide-y divide-slate-100">
                {members.data?.slice(0, 4).map((m) => (
                  <div key={m._id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-slate-900">{m.name}</p>
                      <p className="text-slate-500 text-[11px]">{m.email}</p>
                    </div>
                    <span className="font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded text-[11px]">
                      {m.role === 'ORGANIZATION_ADMIN' ? 'Admin' : 'Member'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
              <Link
                href="/org-admin/members"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition"
              >
                <span>View All Team Members</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </QueryState>
    </div>
  );
}
