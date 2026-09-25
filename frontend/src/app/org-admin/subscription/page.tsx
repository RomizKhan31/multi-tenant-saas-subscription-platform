'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Zap,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  Users,
  Calendar,
  CreditCard,
  RotateCcw,
  Check,
  X,
  ShieldCheck,
  AlertTriangle,
  Receipt,
  Sparkles,
} from 'lucide-react';
import axios from 'axios';
import api from '@/lib/api';
import { DashboardHeader } from '@/components/DashboardHeader';
import {
  QueryState,
  StatusBadge,
  formatCurrency,
  formatDate,
} from '@/components/dashboard-ui';

// Type definitions matching backend schema
type Plan = {
  _id: string;
  name: string;
  price: number;
  billingInterval: string;
  features: string[];
  isActive: boolean;
};

type Subscription = {
  _id: string;
  planId: string;
  status: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
};

type Member = {
  _id: string;
  role: string;
};

type Transaction = {
  _id: string;
  amount: number;
  status: string;
};

/**
 * Utility: Extract seat quota limit from plan features string array and plan name.
 * For any Premium plan, Enterprise plan, or plans with unlimited features,
 * the member limit is explicitly UNLIMITED (limit: null, isUnlimited: true).
 */
function getPlanSeatLimit(features?: string[], planName?: string): { limit: number | null; isUnlimited: boolean } {
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
 * Utility: Compute cycle renewal metrics, days remaining, and percent elapsed.
 */
function getCycleMetrics(currentPeriodStart?: string, currentPeriodEnd?: string) {
  if (!currentPeriodEnd) {
    return {
      renewalDateFormatted: 'Ongoing / Active',
      daysRemaining: null,
      percentElapsed: 0,
      isExpired: false,
    };
  }

  const end = new Date(currentPeriodEnd);
  const now = new Date();
  const diffMs = end.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
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
    renewalDateFormatted: formatDate(currentPeriodEnd),
    daysRemaining,
    percentElapsed,
    isExpired,
  };
}

export default function OrgAdminSubscriptionPage() {
  const queryClient = useQueryClient();

  // Notification state
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal states for plan actions
  const [selectedPlanForModal, setSelectedPlanForModal] = useState<{
    plan: Plan;
    actionType: 'upgrade' | 'downgrade';
  } | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // 1. Fetch current subscription
  const subscription = useQuery({
    queryKey: ['subscription-page'],
    queryFn: async () => (await api.get<Subscription>('/subscriptions')).data,
    retry: false,
  });

  // 2. Fetch available active plans
  const plans = useQuery({
    queryKey: ['active-plans-page'],
    queryFn: async () => (await api.get<{ plans: Plan[] }>('/plans/active')).data.plans,
  });

  // 3. Fetch members to compute seat usage vs limit
  const members = useQuery({
    queryKey: ['members-usage-rep'],
    queryFn: async () => (await api.get<{ members: Member[] }>('/members')).data.members,
  });

  // 4. Fetch transactions to compute recorded spend
  const transactions = useQuery({
    queryKey: ['transactions-usage-rep'],
    queryFn: async () =>
      (await api.get<{ transactions: Transaction[] }>('/transactions')).data.transactions,
  });

  // Current active plan object
  const currentPlan = plans.data?.find((p) => p._id === subscription.data?.planId);

  // Seat metrics - checks plan name and features for unlimited premium allocation
  const seatQuota = getPlanSeatLimit(currentPlan?.features, currentPlan?.name);
  const memberCount = members.data?.length ?? 0;
  const seatUsagePercent = seatQuota.limit
    ? Math.min(100, Math.round((memberCount / seatQuota.limit) * 100))
    : 0;

  // Billing cycle metrics
  const cycleMetrics = getCycleMetrics(
    subscription.data?.currentPeriodStart,
    subscription.data?.currentPeriodEnd
  );

  // Total recorded spend
  const totalSpend = (transactions.data || [])
    .filter((t) => t.status === 'SUCCESS')
    .reduce((sum, t) => sum + t.amount, 0);

  // -------------------------------------------------------------
  // Mutations: Stripe Checkout, Cancel, Reactivate
  // -------------------------------------------------------------

  /**
   * Stripe Checkout Session Mutation
   * Starts Stripe hosted checkout session for all plan upgrades and downgrades.
   */
  const checkoutStripe = useMutation({
    mutationFn: async (planId: string) =>
      (await api.post<{ url: string }>('/payments/checkout', { planId })).data,
    onSuccess: (data) => {
      if (data.url) {
        window.location.assign(data.url);
      } else {
        setNotice({ type: 'error', message: 'Stripe checkout session could not be created.' });
      }
    },
    onError: (error: unknown) => {
      const message =
        axios.isAxiosError(error) && error.response?.data?.error
          ? error.response.data.error
          : 'Failed to start Stripe checkout session.';
      setNotice({ type: 'error', message });
    },
  });

  /**
   * Cancel Subscription Mutation
   * Calls POST /api/subscriptions/cancel
   * Retains active service until currentPeriodEnd while stopping recurring renewals.
   */
  const cancelSubscription = useMutation({
    mutationFn: () => api.post('/subscriptions/cancel'),
    onSuccess: () => {
      setShowCancelModal(false);
      queryClient.invalidateQueries({ queryKey: ['subscription-page'] });
      queryClient.invalidateQueries({ queryKey: ['subscription-overview'] });
      setNotice({
        type: 'success',
        message: 'Subscription scheduled to cancel at the end of the current billing cycle.',
      });
    },
    onError: (error: unknown) => {
      const message =
        axios.isAxiosError(error) && error.response?.data?.error
          ? error.response.data.error
          : 'Could not cancel subscription.';
      setNotice({ type: 'error', message });
    },
  });

  /**
   * Reactivate Subscription Mutation
   * Calls POST /api/subscriptions/reactivate
   * Resumes automatic renewal if subscription was scheduled to cancel at period end.
   */
  const reactivateSubscription = useMutation({
    mutationFn: () => api.post('/subscriptions/reactivate'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-page'] });
      queryClient.invalidateQueries({ queryKey: ['subscription-overview'] });
      setNotice({
        type: 'success',
        message: 'Subscription reactivated! Automatic recurring billing has been restored.',
      });
    },
    onError: (error: unknown) => {
      const message =
        axios.isAxiosError(error) && error.response?.data?.error
          ? error.response.data.error
          : 'Could not reactivate subscription.';
      setNotice({ type: 'error', message });
    },
  });

  const isPendingAction =
    checkoutStripe.isPending ||
    cancelSubscription.isPending ||
    reactivateSubscription.isPending;

  return (
    <div className="space-y-8">
      <DashboardHeader
        title="Subscription & Billing"
        subtitle="Manage your active plan, monitor seat and usage limits, review your renewal date, and upgrade or downgrade tiers."
      />

      {/* Dismissible Feedback Banner */}
      {notice && (
        <div
          role="status"
          className={`flex items-center justify-between rounded-xl px-4 py-3.5 text-sm font-medium transition ${
            notice.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {notice.type === 'success' ? (
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle size={18} className="text-rose-600 shrink-0" />
            )}
            <span>{notice.message}</span>
          </div>
          <button
            onClick={() => setNotice(null)}
            className="text-xs font-bold underline hover:opacity-75 ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Cancellation Scheduled Warning Banner */}
      {subscription.data?.cancelAtPeriodEnd && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-800">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 className="font-bold text-amber-900 text-sm">
                Subscription Scheduled for Cancellation
              </h3>
              <p className="text-xs text-amber-800 mt-0.5">
                Your workspace retains full access to active plan features until{' '}
                <strong>{cycleMetrics.renewalDateFormatted}</strong>. You will not be billed again.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={reactivateSubscription.isPending}
            onClick={() => reactivateSubscription.mutate()}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-amber-900 text-white hover:bg-amber-950 text-xs font-bold transition shadow-sm shrink-0"
          >
            <RotateCcw size={14} />
            <span>{reactivateSubscription.isPending ? 'Reactivating...' : 'Resume Subscription'}</span>
          </button>
        </div>
      )}

      {/* Top 3 Metric Cards: Current Plan, Renewal Date, Usage & Quotas */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Card 1: Current Plan Details */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="grid size-9 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
                  <Zap size={18} />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 text-sm">Current Plan</h2>
                  <p className="text-[11px] text-slate-500">Active subscription tier</p>
                </div>
              </div>
              <StatusBadge value={subscription.data?.status || 'TRIAL'} />
            </div>

            <div className="mt-5 space-y-3">
              <div>
                <span className="text-xs uppercase font-semibold text-slate-500">Tier Name</span>
                <p className="text-2xl font-black text-slate-900 mt-0.5">
                  {currentPlan?.name || '14-Day Free Trial'}
                </p>
              </div>

              <div className="flex items-baseline gap-1.5 pt-1">
                <span className="text-xl font-extrabold text-indigo-600">
                  {currentPlan ? formatCurrency(currentPlan.price) : 'Free'}
                </span>
                <span className="text-xs text-slate-500">
                  /{currentPlan ? currentPlan.billingInterval.toLowerCase() : 'trial'}
                </span>
              </div>

              {currentPlan?.features && currentPlan.features.length > 0 && (
                <div className="pt-3 border-t border-slate-100">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Key Entitlements
                  </p>
                  <ul className="space-y-1.5">
                    {currentPlan.features.slice(0, 3).map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs text-slate-700">
                        <Check size={14} className="text-emerald-600 shrink-0" />
                        <span className="truncate">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Billing Provider:</span>
            <span className="font-semibold text-slate-800 flex items-center gap-1.5">
              <CreditCard size={14} className="text-indigo-600" />
              Stripe Secure Billing
            </span>
          </div>
        </section>

        {/* Card 2: Renewal Date & Billing Cycle */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="grid size-9 place-items-center rounded-xl bg-sky-50 text-sky-600">
                  <Calendar size={18} />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 text-sm">Billing Cycle & Renewal</h2>
                  <p className="text-[11px] text-slate-500">Upcoming renewal date schedule</p>
                </div>
              </div>
              {cycleMetrics.daysRemaining !== null && (
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-700">
                  {cycleMetrics.daysRemaining} days left
                </span>
              )}
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <span className="text-xs uppercase font-semibold text-slate-500">
                  Next Renewal Date
                </span>
                <p className="text-xl font-extrabold text-slate-900 mt-0.5">
                  {cycleMetrics.renewalDateFormatted}
                </p>
              </div>

              {/* Cycle Progress Bar */}
              <div>
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                  <span>Cycle Progress</span>
                  <span className="font-semibold">{cycleMetrics.percentElapsed}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                    style={{ width: `${cycleMetrics.percentElapsed}%` }}
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Period Started:</span>
                  <span className="font-medium text-slate-800">
                    {formatDate(subscription.data?.currentPeriodStart)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Renewal Mode:</span>
                  <span
                    className={`font-semibold ${
                      subscription.data?.cancelAtPeriodEnd
                        ? 'text-amber-700'
                        : 'text-emerald-700'
                    }`}
                  >
                    {subscription.data?.cancelAtPeriodEnd
                      ? 'Cancels at Period End'
                      : 'Auto-Renews'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action to Cancel or Reactivate */}
          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-end">
            {subscription.data?.cancelAtPeriodEnd ? (
              <button
                type="button"
                onClick={() => reactivateSubscription.mutate()}
                disabled={reactivateSubscription.isPending}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 transition"
              >
                Resume Auto-Renewal
              </button>
            ) : subscription.data?.status === 'ACTIVE' ? (
              <button
                type="button"
                onClick={() => setShowCancelModal(true)}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 transition"
              >
                Cancel Subscription
              </button>
            ) : (
              <span className="text-xs text-slate-400">Trial Period Active</span>
            )}
          </div>
        </section>

        {/* Card 3: Usage & Limits Telemetry */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="grid size-9 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
                  <Users size={18} />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 text-sm">Resource Limits & Usage</h2>
                  <p className="text-[11px] text-slate-500">Workspace quota utilization</p>
                </div>
              </div>
              <Link
                href="/org-admin/members"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
              >
                Manage
              </Link>
            </div>

            <div className="mt-5 space-y-4">
              {/* Seat Quota Meter */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-semibold text-slate-700">Team Member Seats</span>
                  <span className="font-bold text-slate-900">
                    {memberCount} / {seatQuota.isUnlimited ? '∞ Unlimited' : `${seatQuota.limit} seats`}
                  </span>
                </div>
                {!seatQuota.isUnlimited && seatQuota.limit ? (
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        seatUsagePercent > 90
                          ? 'bg-rose-500'
                          : seatUsagePercent > 70
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${seatUsagePercent}%` }}
                    />
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                    <span>Unlimited member seats unlocked on this plan.</span>
                  </div>
                )}
                <p className="text-[11px] text-slate-500 mt-1">
                  {seatQuota.isUnlimited
                    ? 'Your premium tier includes unlimited team member seat invitations.'
                    : `${Math.max(0, seatQuota.limit! - memberCount)} seat${seatQuota.limit! - memberCount === 1 ? '' : 's'} remaining on this tier.`}
                </p>
              </div>

              {/* Spend Metric */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Receipt size={16} className="text-slate-400" />
                  <span className="text-slate-600">Lifetime Invoiced Spend</span>
                </div>
                <span className="font-bold text-slate-900">{formatCurrency(totalSpend)}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
            <Link
              href="/org-admin/reports"
              className="text-xs font-bold text-slate-600 hover:text-indigo-600 transition flex items-center gap-1"
            >
              <span>View Usage Reports</span>
              <ArrowRight size={13} />
            </Link>
            <Link
              href="/org-admin/transactions"
              className="text-xs font-bold text-indigo-600 hover:text-indigo-700 transition"
            >
              Billing History
            </Link>
          </div>
        </section>
      </div>

      {/* Available Plans Comparison & Upgrade / Downgrade Section */}
      <section className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Sparkles size={20} className="text-indigo-600" />
              <span>Available Subscription Tiers</span>
            </h2>
            <p className="text-xs text-slate-500">
              Upgrade to unlock more seats and enterprise features, or adjust to an optimal tier.
            </p>
          </div>
        </div>

        <QueryState loading={plans.isLoading} error={plans.error}>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {plans.data?.map((plan) => {
              const isCurrent = currentPlan?._id === plan._id;
              // Determine whether this plan is an upgrade or a downgrade relative to current
              const isUpgrade = currentPlan ? plan.price > currentPlan.price : true;

              return (
                <div
                  key={plan._id}
                  className={`rounded-2xl p-6 flex flex-col justify-between transition relative ${
                    isCurrent
                      ? 'border-2 border-indigo-600 bg-indigo-50/20 shadow-md shadow-indigo-600/10'
                      : 'border border-slate-200 bg-white hover:border-slate-300 shadow-sm'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-extrabold text-slate-900 text-lg">{plan.name}</h3>
                      {isCurrent ? (
                        <span className="rounded-full bg-indigo-100 border border-indigo-200 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
                          Current Plan
                        </span>
                      ) : isUpgrade ? (
                        <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                          <ArrowUpRight size={12} /> Upgrade
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-600 flex items-center gap-1">
                          <ArrowDownRight size={12} /> Downgrade
                        </span>
                      )}
                    </div>

                    <div className="mt-4 flex items-baseline gap-1">
                      <span className="text-3xl font-black text-slate-900">
                        {formatCurrency(plan.price)}
                      </span>
                      <span className="text-xs text-slate-500">
                        /{plan.billingInterval.toLowerCase()}
                      </span>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-100 space-y-2.5">
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Plan Entitlements
                      </p>
                      {plan.features?.map((f, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-slate-700">
                          <Check size={14} className="text-indigo-600 shrink-0" />
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-8 pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      disabled={isCurrent || isPendingAction}
                      onClick={() => {
                        setSelectedPlanForModal({
                          plan,
                          actionType: isUpgrade ? 'upgrade' : 'downgrade',
                        });
                      }}
                      className={`w-full py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                        isCurrent
                          ? 'border border-slate-200 bg-slate-100 text-slate-400 cursor-default'
                          : isUpgrade
                          ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm hover:shadow active:scale-95'
                          : 'border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 shadow-sm active:scale-95'
                      }`}
                    >
                      {isCurrent ? (
                        <>
                          <CheckCircle2 size={14} /> Active Plan
                        </>
                      ) : isUpgrade ? (
                        <>
                          Upgrade to {plan.name} <ArrowUpRight size={14} />
                        </>
                      ) : (
                        <>
                          Downgrade to {plan.name} <ArrowDownRight size={14} />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </QueryState>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* MODAL: Plan Upgrade / Downgrade Confirmation Dialog */}
      {/* ------------------------------------------------------------- */}
      {selectedPlanForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="max-w-md w-full rounded-2xl bg-white p-6 shadow-xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div
                  className={`grid size-9 place-items-center rounded-xl ${
                    selectedPlanForModal.actionType === 'upgrade'
                      ? 'bg-indigo-50 text-indigo-600'
                      : 'bg-amber-50 text-amber-600'
                  }`}
                >
                  {selectedPlanForModal.actionType === 'upgrade' ? (
                    <ArrowUpRight size={18} />
                  ) : (
                    <ArrowDownRight size={18} />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {selectedPlanForModal.actionType === 'upgrade'
                      ? 'Upgrade Subscription Plan'
                      : 'Downgrade Subscription Plan'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Switching to {selectedPlanForModal.plan.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPlanForModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            {/* Plan Comparison Summary */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
              <div className="flex items-center justify-between text-slate-600">
                <span>Current Plan:</span>
                <span className="font-semibold text-slate-900">
                  {currentPlan?.name || '14-Day Free Trial'} (
                  {currentPlan ? formatCurrency(currentPlan.price) : 'Free'})
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>New Tier:</span>
                <span className="font-extrabold text-indigo-600">
                  {selectedPlanForModal.plan.name} (
                  {formatCurrency(selectedPlanForModal.plan.price)}/
                  {selectedPlanForModal.plan.billingInterval.toLowerCase()})
                </span>
              </div>
            </div>

            {/* Downgrade Warning Notice */}
            {selectedPlanForModal.actionType === 'downgrade' && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2.5">
                <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-600" />
                <p>
                  <strong>Downgrade Note:</strong> Your current team membership and features will adjust to the limits of the {selectedPlanForModal.plan.name}.
                </p>
              </div>
            )}

            {/* Action Buttons: Stripe Payment Checkout Only */}
            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                disabled={isPendingAction}
                onClick={() => checkoutStripe.mutate(selectedPlanForModal.plan._id)}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-sm hover:shadow flex items-center justify-center gap-2"
              >
                <CreditCard size={15} />
                <span>
                  {checkoutStripe.isPending
                    ? 'Connecting to Stripe Checkout...'
                    : `Pay with Stripe (${formatCurrency(selectedPlanForModal.plan.price)}/${selectedPlanForModal.plan.billingInterval.toLowerCase()})`}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedPlanForModal(null)}
                className="w-full py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold transition text-center"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: Cancel Subscription Confirmation Dialog */}
      {/* ------------------------------------------------------------- */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="max-w-md w-full rounded-2xl bg-white p-6 shadow-xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="grid size-9 place-items-center rounded-xl bg-rose-50 text-rose-600">
                  <AlertCircle size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Cancel Recurring Subscription</h3>
                  <p className="text-xs text-slate-500">Scheduled cancellation at cycle end</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <p>
                Are you sure you want to cancel automatic renewals for your{' '}
                <strong>{currentPlan?.name || 'current subscription'}</strong>?
              </p>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="flex items-center gap-2 text-slate-700">
                  <ShieldCheck size={15} className="text-emerald-600 shrink-0" />
                  <span>Access remains active until {cycleMetrics.renewalDateFormatted}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <Check size={15} className="text-emerald-600 shrink-0" />
                  <span>No further recurring charges will be incurred</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <RotateCcw size={15} className="text-indigo-600 shrink-0" />
                  <span>You can resume your subscription anytime before the renewal date</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"
              >
                Keep Subscription
              </button>
              <button
                type="button"
                disabled={cancelSubscription.isPending}
                onClick={() => cancelSubscription.mutate()}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-sm"
              >
                {cancelSubscription.isPending ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
