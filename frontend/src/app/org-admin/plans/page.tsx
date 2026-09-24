'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCard, Check, AlertCircle, ArrowRight, Zap, CheckCircle2 } from 'lucide-react';
import api from '@/lib/api';
import { DashboardHeader } from '@/components/DashboardHeader';
import {
  QueryState,
  StatusBadge,
  formatCurrency,
  formatDate,
} from '@/components/dashboard-ui';

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
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
};

export default function OrgAdminPlansPage() {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const subscription = useQuery({
    queryKey: ['subscription-page'],
    queryFn: async () => (await api.get<Subscription>('/subscriptions')).data,
    retry: false,
  });

  const plans = useQuery({
    queryKey: ['active-plans-page'],
    queryFn: async () => (await api.get<{ plans: Plan[] }>('/plans/active')).data.plans,
  });

  const cancelSubscription = useMutation({
    mutationFn: () => api.post('/subscriptions/cancel'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-page'] });
      setNotice({
        type: 'success',
        message: 'Subscription set to cancel at end of current billing period.',
      });
    },
    onError: (error: any) => {
      setNotice({
        type: 'error',
        message: error?.response?.data?.error || 'Could not cancel subscription.',
      });
    },
  });

  const checkout = useMutation({
    mutationFn: async (planId: string) =>
      (await api.post<{ url: string }>('/payments/checkout', { planId })).data,
    onSuccess: (data) => {
      if (data.url) window.location.assign(data.url);
      else setNotice({ type: 'error', message: 'Checkout session could not be established.' });
    },
    onError: (error: any) => {
      setNotice({
        type: 'error',
        message: error?.response?.data?.error || 'Failed to start Stripe checkout.',
      });
    },
  });

  const currentPlan = plans.data?.find((p) => p._id === subscription.data?.planId);

  return (
    <div className="space-y-8">
      <DashboardHeader
        title="Subscription & Billing"
        subtitle="Review active subscription tier, upgrade plan, or adjust your billing preferences."
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

      {/* Current Active Plan Card */}
      <section className="rounded-2xl border border-slate-800 bg-[#0e1629] p-6 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <Zap size={18} />
            </div>
            <div>
              <h2 className="font-bold text-white text-base">Active Subscription</h2>
              <p className="text-xs text-slate-400">Current tier and billing renewal schedule.</p>
            </div>
          </div>
          <StatusBadge value={subscription.data?.status || 'TRIAL'} />
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <p className="text-xs font-semibold uppercase text-slate-400">Plan</p>
            <p className="text-lg font-bold text-white mt-1">
              {currentPlan?.name || '14-Day Free Trial'}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <p className="text-xs font-semibold uppercase text-slate-400">Rate</p>
            <p className="text-lg font-bold text-emerald-400 mt-1">
              {currentPlan
                ? `${formatCurrency(currentPlan.price)} / ${currentPlan.billingInterval.toLowerCase()}`
                : 'Free'}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <p className="text-xs font-semibold uppercase text-slate-400">Period End</p>
            <p className="text-lg font-bold text-white mt-1">
              {subscription.data?.currentPeriodEnd
                ? formatDate(subscription.data.currentPeriodEnd)
                : 'Ongoing'}
            </p>
          </div>
        </div>

        {subscription.data?.status === 'ACTIVE' && !subscription.data?.cancelAtPeriodEnd && (
          <div className="mt-5 pt-4 border-t border-slate-800 flex justify-end">
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Cancel recurring billing at the end of the current period?')) {
                  cancelSubscription.mutate();
                }
              }}
              disabled={cancelSubscription.isPending}
              className="text-xs font-semibold text-rose-400 hover:text-rose-300 transition"
            >
              Cancel Subscription at Period End
            </button>
          </div>
        )}

        {subscription.data?.cancelAtPeriodEnd && (
          <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
            <AlertCircle size={15} />
            <span>This subscription is scheduled to cancel at the end of the current billing cycle.</span>
          </div>
        )}
      </section>

      {/* Available Plans Grid */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-white">Upgrade or Change Plan</h2>
          <p className="text-xs text-slate-400">
            Choose a plan that fits your growing organization. Stripe handles secure payment checkout.
          </p>
        </div>

        <QueryState loading={plans.isLoading} error={plans.error}>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {plans.data?.map((plan) => {
              const isCurrent = currentPlan?._id === plan._id;

              return (
                <div
                  key={plan._id}
                  className={`rounded-2xl border p-6 flex flex-col justify-between transition ${
                    isCurrent
                      ? 'border-emerald-500/50 bg-[#0e1f2f] shadow-lg shadow-emerald-500/10'
                      : 'border-slate-800 bg-[#0e1629] hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-extrabold text-white text-lg">{plan.name}</h3>
                      {isCurrent && (
                        <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-0.5 text-xs font-bold text-emerald-400">
                          Current Plan
                        </span>
                      )}
                    </div>

                    <div className="mt-4 flex items-baseline gap-1">
                      <span className="text-3xl font-black text-white">
                        {formatCurrency(plan.price)}
                      </span>
                      <span className="text-xs text-slate-400">
                        /{plan.billingInterval.toLowerCase()}
                      </span>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-800/80 space-y-2">
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Features
                      </p>
                      {plan.features?.map((f, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-slate-200">
                          <Check size={14} className="text-emerald-400 shrink-0" />
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-8 pt-4 border-t border-slate-800">
                    <button
                      type="button"
                      disabled={isCurrent || checkout.isPending}
                      onClick={() => checkout.mutate(plan._id)}
                      className={`w-full py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                        isCurrent
                          ? 'bg-slate-800 text-slate-400 cursor-default'
                          : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20 active:scale-95'
                      }`}
                    >
                      {isCurrent ? (
                        <>
                          <CheckCircle2 size={14} /> Active Plan
                        </>
                      ) : checkout.isPending ? (
                        'Connecting Stripe...'
                      ) : (
                        <>
                          Select {plan.name} <ArrowRight size={14} />
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
    </div>
  );
}
