'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, AlertCircle, ArrowRight, Zap, CheckCircle2 } from 'lucide-react';
import axios from 'axios';
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
    onError: (error: unknown) => {
      const message =
        axios.isAxiosError(error) && error.response?.data?.error
          ? error.response.data.error
          : 'Could not cancel subscription.';
      setNotice({
        type: 'error',
        message,
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
    onError: (error: unknown) => {
      const message =
        axios.isAxiosError(error) && error.response?.data?.error
          ? error.response.data.error
          : 'Failed to start Stripe checkout.';
      setNotice({
        type: 'error',
        message,
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
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
              <Zap size={18} />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-base">Active Subscription</h2>
              <p className="text-xs text-slate-500">Current tier and billing renewal schedule.</p>
            </div>
          </div>
          <StatusBadge value={subscription.data?.status || 'TRIAL'} />
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <p className="text-xs font-semibold uppercase text-slate-500">Plan</p>
            <p className="text-lg font-bold text-slate-900 mt-1">
              {currentPlan?.name || '14-Day Free Trial'}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <p className="text-xs font-semibold uppercase text-slate-500">Rate</p>
            <p className="text-lg font-bold text-indigo-600 mt-1">
              {currentPlan
                ? `${formatCurrency(currentPlan.price)} / ${currentPlan.billingInterval.toLowerCase()}`
                : 'Free'}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <p className="text-xs font-semibold uppercase text-slate-500">Period End</p>
            <p className="text-lg font-bold text-slate-900 mt-1">
              {subscription.data?.currentPeriodEnd
                ? formatDate(subscription.data.currentPeriodEnd)
                : 'Ongoing'}
            </p>
          </div>
        </div>

        {subscription.data?.status === 'ACTIVE' && !subscription.data?.cancelAtPeriodEnd && (
          <div className="mt-5 pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Cancel recurring billing at the end of the current period?')) {
                  cancelSubscription.mutate();
                }
              }}
              disabled={cancelSubscription.isPending}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 transition"
            >
              Cancel Subscription at Period End
            </button>
          </div>
        )}

        {subscription.data?.cancelAtPeriodEnd && (
          <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
            <AlertCircle size={15} />
            <span>This subscription is scheduled to cancel at the end of the current billing cycle.</span>
          </div>
        )}
      </section>

      {/* Available Plans Grid */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Upgrade or Change Plan</h2>
          <p className="text-xs text-slate-500">
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
                  className={`rounded-2xl p-6 flex flex-col justify-between transition ${
                    isCurrent
                      ? 'border-2 border-indigo-600 bg-indigo-50/20 shadow-md shadow-indigo-600/10'
                      : 'border border-slate-200 bg-white hover:border-slate-300 shadow-sm'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-extrabold text-slate-900 text-lg">{plan.name}</h3>
                      {isCurrent && (
                        <span className="rounded-full bg-indigo-100 border border-indigo-200 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
                          Current Plan
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

                    <div className="mt-6 pt-4 border-t border-slate-100 space-y-2">
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Features
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
                      disabled={isCurrent || checkout.isPending}
                      onClick={() => checkout.mutate(plan._id)}
                      className={`w-full py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                        isCurrent
                          ? 'border border-slate-200 bg-slate-100 text-slate-400 cursor-default'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm hover:shadow active:scale-95'
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
