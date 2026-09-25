'use client';

import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  CreditCard,
  DollarSign,
  ArrowRight,
  UserPlus,
  ShieldCheck,
  Calendar,
  AlertTriangle,
  RotateCcw,
  Check,
  Zap,
  ArrowUpRight,
  ReceiptText,
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

// Type definitions
type Organization = { name: string; contactEmail: string; billingEmail: string; status: string };
type Member = { _id: string; name: string; email: string; role: string; status: string };
type Plan = { _id: string; name: string; price: number; billingInterval: string; features: string[] };
type Subscription = {
  _id: string;
  planId: string;
  status: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
};
type Transaction = {
  _id: string;
  amount: number;
  currency: string;
  status: string;
  description?: string;
  createdAt: string;
};

/**
 * Utility: Extract seat limit quota from plan features and plan name.
 * For Premium, Enterprise, or unlimited plans, member seats are explicitly unlimited.
 */
function getSeatLimit(features?: string[], planName?: string): { limit: number | null; isUnlimited: boolean } {
  const normalizedName = (planName || '').toLowerCase();

  // Premium, Enterprise, or Unlimited plans always have unlimited member limit
  if (
    normalizedName.includes('premium') ||
    normalizedName.includes('enterprise') ||
    normalizedName.includes('unlimited')
  ) {
    return { limit: null, isUnlimited: true };
  }

  if (features && features.length) {
    for (const f of features) {
      if (/unlimited\s+(?:team\s+members|members|seats)/i.test(f)) {
        return { limit: null, isUnlimited: true };
      }
      const match = f.match(/up\s+to\s+(\d+)\s+(?:team\s+members|members|seats)/i);
      if (match) {
        return { limit: parseInt(match[1], 10), isUnlimited: false };
      }
    }
  }
  return { limit: 5, isUnlimited: false };
}

/**
 * Utility: Compute billing renewal dates and progress
 */
function getRenewalSummary(currentPeriodStart?: string, currentPeriodEnd?: string) {
  if (!currentPeriodEnd) {
    return {
      formattedDate: 'Ongoing / Active',
      daysLeft: null,
      percentElapsed: 0,
      isExpired: false,
    };
  }

  const end = new Date(currentPeriodEnd);
  const now = new Date();
  const diffMs = end.getTime() - now.getTime();
  const daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  const isExpired = diffMs <= 0;

  let percentElapsed = 0;
  if (currentPeriodStart) {
    const start = new Date(currentPeriodStart);
    const totalCycle = end.getTime() - start.getTime();
    const elapsed = now.getTime() - start.getTime();
    if (totalCycle > 0) {
      percentElapsed = Math.min(100, Math.max(0, Math.round((elapsed / totalCycle) * 100)));
    }
  }

  return {
    formattedDate: formatDate(currentPeriodEnd),
    daysLeft,
    percentElapsed,
    isExpired,
  };
}

export default function OrgAdminDashboardPage() {
  const queryClient = useQueryClient();

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

  // Reactivate subscription mutation
  const reactivateSubscription = useMutation({
    mutationFn: () => api.post('/subscriptions/reactivate'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-overview'] });
      queryClient.invalidateQueries({ queryKey: ['subscription-page'] });
    },
  });

  const activePlan = plans.data?.find((p) => p._id === subscription.data?.planId);
  const memberList = members.data || [];
  const txList = transactions.data || [];

  const totalSpend = txList
    .filter((t) => t.status === 'SUCCESS')
    .reduce((acc, curr) => acc + curr.amount, 0);

  // Seat metrics: Premium tier has unlimited member seats
  const seatQuota = getSeatLimit(activePlan?.features, activePlan?.name);
  const seatsUsed = memberList.length;
  const seatPercent = seatQuota.limit
    ? Math.min(100, Math.round((seatsUsed / seatQuota.limit) * 100))
    : 0;

  // Renewal metrics
  const renewalInfo = getRenewalSummary(
    subscription.data?.currentPeriodStart,
    subscription.data?.currentPeriodEnd
  );

  // Admin vs Member breakdown
  const adminCount = memberList.filter((m) => m.role === 'ORGANIZATION_ADMIN').length;
  const regularCount = memberList.filter((m) => m.role === 'ORGANIZATION_MEMBER').length;

  return (
    <div className="space-y-8">
      <DashboardHeader
        title={`${organization.data?.name || 'Workspace'} Dashboard`}
        subtitle="Workspace telemetry, subscription status, renewal schedule, and team member management."
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
              href="/org-admin/subscription"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm hover:shadow transition"
            >
              <CreditCard size={15} />
              <span>Manage Subscription</span>
            </Link>
          </div>
        }
      />

      <QueryState
        loading={organization.isLoading || members.isLoading || transactions.isLoading}
        error={organization.error}
      >
        {/* Cancellation Scheduled Alert Banner */}
        {subscription.data?.cancelAtPeriodEnd && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-800">
                <AlertTriangle size={18} />
              </div>
              <div>
                <p className="text-xs font-bold text-amber-900">
                  Subscription Scheduled for Cancellation
                </p>
                <p className="text-xs text-amber-800 mt-0.5">
                  Your plan remains active until <strong>{renewalInfo.formattedDate}</strong>. Automatic billing is paused.
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={reactivateSubscription.isPending}
              onClick={() => reactivateSubscription.mutate()}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-900 text-white hover:bg-amber-950 text-xs font-bold transition shadow-sm shrink-0"
            >
              <RotateCcw size={13} />
              <span>{reactivateSubscription.isPending ? 'Resuming...' : 'Resume Subscription'}</span>
            </button>
          </div>
        )}

        {/* Top 4 Stat Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Team Seats"
            value={
              <span className="flex items-baseline gap-1.5">
                <span>{seatsUsed}</span>
                <span className="text-base font-normal text-slate-500">
                  / {seatQuota.isUnlimited ? '∞' : seatQuota.limit}
                </span>
              </span>
            }
            detail={
              seatQuota.isUnlimited
                ? 'Unlimited seats entitlement'
                : `${seatPercent}% quota used (${Math.max(0, seatQuota.limit! - seatsUsed)} remaining)`
            }
            icon={<Users size={20} />}
            iconColor={seatPercent > 85 ? 'amber' : 'indigo'}
          />

          <StatCard
            label="Active Tier"
            value={activePlan?.name || (subscription.data?.status === 'TRIAL' ? '14-Day Trial' : 'No Plan')}
            detail={activePlan ? `${formatCurrency(activePlan.price)}/${activePlan.billingInterval.toLowerCase()}` : 'Select a subscription plan'}
            icon={<CreditCard size={20} />}
            iconColor="cyan"
          />

          <StatCard
            label="Renewal Schedule"
            value={renewalInfo.formattedDate}
            detail={
              subscription.data?.cancelAtPeriodEnd
                ? 'Terminates at period end'
                : renewalInfo.daysLeft !== null
                ? `Renews in ${renewalInfo.daysLeft} day${renewalInfo.daysLeft === 1 ? '' : 's'}`
                : 'Active tenant schedule'
            }
            icon={<Calendar size={20} />}
            iconColor="emerald"
          />

          <StatCard
            label="Recorded Spend"
            value={formatCurrency(totalSpend)}
            detail="Lifetime successful charges"
            icon={<DollarSign size={20} />}
            iconColor="teal"
          />
        </div>

        {/* Detailed Middle Grid: Subscription Overview & Resource Usage */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Card 1: Subscription & Renewal Deep Dive */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="grid size-9 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
                    <Zap size={18} />
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-900 text-base">Subscription & Renewal</h2>
                    <p className="text-xs text-slate-500">Plan tier, rates, and renewal progress</p>
                  </div>
                </div>
                <StatusBadge value={subscription.data?.status || organization.data?.status} />
              </div>

              <div className="mt-5 space-y-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="text-xs uppercase font-semibold text-slate-500">Active Tier</span>
                      <p className="text-lg font-bold text-slate-900">
                        {activePlan?.name || '14-Day Free Trial'}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-base font-extrabold text-indigo-600">
                        {activePlan ? formatCurrency(activePlan.price) : 'Free'}
                      </span>
                      <span className="text-xs text-slate-500">
                        /{activePlan ? activePlan.billingInterval.toLowerCase() : 'trial'}
                      </span>
                    </div>
                  </div>

                  {/* Billing Cycle Progress */}
                  {renewalInfo.daysLeft !== null && (
                    <div className="pt-2 border-t border-slate-200/60">
                      <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
                        <span>Cycle Duration Elapsed</span>
                        <span className="font-bold">{renewalInfo.percentElapsed}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                          style={{ width: `${renewalInfo.percentElapsed}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1.5">
                        <span>Started: {formatDate(subscription.data?.currentPeriodStart)}</span>
                        <span>Renews: {renewalInfo.formattedDate}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Plan Features Preview */}
                {activePlan?.features && activePlan.features.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Included Entitlements
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {activePlan.features.slice(0, 4).map((f, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-xs text-slate-700">
                          <Check size={13} className="text-emerald-600 shrink-0" />
                          <span className="truncate">{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
              <Link
                href="/org-admin/transactions"
                className="font-semibold text-slate-600 hover:text-slate-900 transition flex items-center gap-1"
              >
                <ReceiptText size={14} className="text-slate-400" />
                <span>View Invoices</span>
              </Link>
              <Link
                href="/org-admin/subscription"
                className="inline-flex items-center gap-1.5 font-bold text-indigo-600 hover:text-indigo-700 transition"
              >
                <span>Upgrade or Change Plan</span>
                <ArrowUpRight size={14} />
              </Link>
            </div>
          </div>

          {/* Card 2: Resource Limits & Team Utilization */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="grid size-9 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
                    <ShieldCheck size={18} />
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-900 text-base">Resource Usage & Quotas</h2>
                    <p className="text-xs text-slate-500">Seat limits and team roster breakdown</p>
                  </div>
                </div>
                <Link
                  href="/org-admin/members"
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                >
                  Manage Roster
                </Link>
              </div>

              <div className="mt-5 space-y-4">
                {/* Seat Meter */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-semibold text-slate-700">Seat Allocation</span>
                    <span className="font-bold text-slate-900">
                      {seatsUsed} / {seatQuota.isUnlimited ? '∞ Unlimited' : `${seatQuota.limit} seats`}
                    </span>
                  </div>
                  {!seatQuota.isUnlimited && seatQuota.limit && (
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          seatPercent > 90
                            ? 'bg-rose-500'
                            : seatPercent > 70
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${seatPercent}%` }}
                      />
                    </div>
                  )}
                  <p className="text-[11px] text-slate-500 mt-1">
                    {seatQuota.isUnlimited
                      ? 'No hard ceiling on team seats.'
                      : seatQuota.limit! - seatsUsed <= 0
                      ? 'Seat capacity reached. Upgrade plan to invite more team members.'
                      : `${seatQuota.limit! - seatsUsed} seat slot${seatQuota.limit! - seatsUsed === 1 ? '' : 's'} available to invite.`}
                  </p>
                </div>

                {/* Role Breakdown */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase">Org Admins</p>
                    <p className="text-lg font-bold text-indigo-700 mt-0.5">{adminCount}</p>
                    <p className="text-[10px] text-slate-400">Full billing & team access</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase">Members</p>
                    <p className="text-lg font-bold text-slate-800 mt-0.5">{regularCount}</p>
                    <p className="text-[10px] text-slate-400">Standard workspace access</p>
                  </div>
                </div>

                {/* Recent Members snippet */}
                <div className="divide-y divide-slate-100 pt-1">
                  {memberList.slice(0, 3).map((m) => (
                    <div key={m._id} className="py-2 flex items-center justify-between text-xs">
                      <div className="truncate max-w-[180px]">
                        <p className="font-semibold text-slate-900 truncate">{m.name}</p>
                        <p className="text-slate-500 text-[11px] truncate">{m.email}</p>
                      </div>
                      <span className="font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-[10px]">
                        {m.role === 'ORGANIZATION_ADMIN' ? 'Admin' : 'Member'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
              <Link
                href="/org-admin/members"
                className="font-bold text-indigo-600 hover:text-indigo-700 transition flex items-center gap-1"
              >
                <span>View Full Team Roster</span>
                <ArrowRight size={13} />
              </Link>
              {!seatQuota.isUnlimited && seatQuota.limit && seatsUsed >= seatQuota.limit && (
                <Link
                  href="/org-admin/subscription"
                  className="text-[11px] font-bold text-amber-700 hover:underline"
                >
                  Need more seats? Upgrade &rarr;
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Recent Transactions / Invoices Snapshot */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="grid size-9 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
                <ReceiptText size={18} />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 text-base">Recent Invoices & Transactions</h2>
                <p className="text-xs text-slate-500">Latest payment records and charge history</p>
              </div>
            </div>
            <Link
              href="/org-admin/transactions"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
            >
              View All Invoices
            </Link>
          </div>

          <div className="mt-4">
            {txList.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No payment history recorded yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {txList.slice(0, 5).map((t) => (
                  <div key={t._id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {t.description || 'Subscription Payment'}
                      </p>
                      <p className="text-[11px] text-slate-500">{formatDate(t.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-slate-900">
                        {formatCurrency(t.amount, t.currency || 'USD')}
                      </span>
                      <StatusBadge value={t.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </QueryState>
    </div>
  );
}
