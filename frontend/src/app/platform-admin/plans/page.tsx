'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCard, Plus, Edit2, Check, X } from 'lucide-react';
import axios from 'axios';
import api from '@/lib/api';
import { DashboardHeader } from '@/components/DashboardHeader';
import {
  QueryState,
  StatusBadge,
  formatCurrency,
} from '@/components/dashboard-ui';

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
  planId: string;
  status: string;
};

export default function PlatformAdminPlansPage() {
  const queryClient = useQueryClient();
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [form, setForm] = useState({
    name: '',
    price: '',
    billingInterval: 'MONTHLY',
    features: '',
  });

  const plans = useQuery({
    queryKey: ['plans-list'],
    queryFn: async () => (await api.get<{ plans: Plan[] }>('/plans')).data.plans,
  });

  const subscriptions = useQuery({
    queryKey: ['subscriptions-all'],
    queryFn: async () =>
      (await api.get<{ subscriptions: Subscription[] }>('/subscriptions/all')).data.subscriptions,
  });

  const planAction = useMutation({
    mutationFn: async (data: { id?: string; payload: typeof form }) => {
      const payload = {
        name: data.payload.name.trim(),
        price: Number(data.payload.price),
        billingInterval: data.payload.billingInterval,
        features: data.payload.features
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      };
      return data.id ? api.put(`/plans/${data.id}`, payload) : api.post('/plans', payload);
    },
    onSuccess: (_, variables) => {
      setEditingPlan(null);
      setShowCreateForm(false);
      setForm({ name: '', price: '', billingInterval: 'MONTHLY', features: '' });
      setNotice({
        type: 'success',
        message: variables.id ? 'Plan updated successfully.' : 'New plan created successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['plans-list'] });
    },
    onError: (error: unknown) => {
      const message =
        axios.isAxiosError(error) && error.response?.data?.error
          ? error.response.data.error
          : error instanceof Error
            ? error.message
            : 'Failed to save plan.';
      setNotice({
        type: 'error',
        message,
      });
    },
  });

  const togglePlan = useMutation({
    mutationFn: async (plan: Plan) =>
      api.post(`/plans/${plan._id}/${plan.isActive ? 'disable' : 'enable'}`),
    onSuccess: (_, plan) => {
      setNotice({
        type: 'success',
        message: `Plan "${plan.name}" ${plan.isActive ? 'disabled' : 'enabled'} successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: ['plans-list'] });
    },
    onError: (error: unknown) => {
      const message =
        axios.isAxiosError(error) && error.response?.data?.error
          ? error.response.data.error
          : 'Failed to toggle plan status.';
      setNotice({
        type: 'error',
        message,
      });
    },
  });

  const startEdit = (plan: Plan) => {
    setEditingPlan(plan);
    setShowCreateForm(true);
    setForm({
      name: plan.name,
      price: String(plan.price),
      billingInterval: plan.billingInterval,
      features: plan.features?.join(', ') || '',
    });
  };

  const cancelEdit = () => {
    setEditingPlan(null);
    setShowCreateForm(false);
    setForm({ name: '', price: '', billingInterval: 'MONTHLY', features: '' });
  };

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Subscription Plans"
        subtitle="Configure SaaS subscription tiers, pricing, billing intervals, and feature entitlements."
        actions={
          <button
            type="button"
            onClick={() => {
              if (showCreateForm && !editingPlan) setShowCreateForm(false);
              else {
                cancelEdit();
                setShowCreateForm(true);
              }
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm hover:shadow transition active:scale-95"
          >
            <Plus size={16} />
            <span>{showCreateForm && !editingPlan ? 'Hide Form' : 'New Plan'}</span>
          </button>
        }
      />

      {notice && (
        <div
          role="status"
          className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium ${
            notice.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          <span>{notice.message}</span>
          <button onClick={() => setNotice(null)} className="underline ml-4 text-xs font-bold">
            Dismiss
          </button>
        </div>
      )}

      {/* Plan Form */}
      {showCreateForm && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
            <div>
              <h2 className="font-bold text-slate-900 text-base">
                {editingPlan ? `Edit Plan: ${editingPlan.name}` : 'Create New Subscription Plan'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Plans become immediately available for tenant onboarding and checkout.
              </p>
            </div>
            <button
              type="button"
              onClick={cancelEdit}
              className="text-slate-400 hover:text-slate-700"
            >
              <X size={18} />
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              planAction.mutate({ id: editingPlan?._id, payload: form });
            }}
            className="grid gap-4 sm:grid-cols-2"
          >
            <div>
              <label className="text-xs font-semibold text-slate-700 uppercase">Plan Name</label>
              <input
                required
                placeholder="e.g. Pro Growth"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 uppercase">Price (USD)</label>
              <input
                required
                min="0"
                step="0.01"
                type="number"
                placeholder="e.g. 49.00"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 uppercase">Billing Interval</label>
              <select
                value={form.billingInterval}
                onChange={(e) => setForm({ ...form, billingInterval: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-600"
              >
                <option value="MONTHLY">Monthly</option>
                <option value="YEARLY">Yearly</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 uppercase">Features (Comma-separated)</label>
              <input
                placeholder="e.g. 10 Members, 50GB Storage, Priority Support"
                value={form.features}
                onChange={(e) => setForm({ ...form, features: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
              />
            </div>

            <div className="flex gap-3 sm:col-span-2 pt-2">
              <button
                type="submit"
                disabled={planAction.isPending}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:shadow transition active:scale-95 disabled:opacity-50"
              >
                {planAction.isPending ? 'Saving...' : editingPlan ? 'Update Plan' : 'Publish Plan'}
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Plans List */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
              <CreditCard size={18} />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-base">Configured Plans</h2>
              <p className="text-xs text-slate-500">Active and disabled SaaS subscription options.</p>
            </div>
          </div>
          <span className="rounded-full bg-indigo-50 border border-indigo-200 px-3 py-1 text-xs font-bold text-indigo-700">
            {plans.data?.length ?? 0} Plans
          </span>
        </div>

        <QueryState loading={plans.isLoading} error={plans.error}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {plans.data?.map((plan) => {
              const subscriberCount =
                subscriptions.data?.filter(
                  (s) => s.planId === plan._id && s.status === 'ACTIVE'
                ).length ?? 0;

              return (
                <div
                  key={plan._id}
                  className="rounded-xl border border-slate-200 bg-slate-50/60 p-5 flex flex-col justify-between hover:bg-slate-50 hover:border-slate-300 shadow-sm transition"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-bold text-slate-900 text-lg">{plan.name}</h3>
                      <StatusBadge value={plan.isActive ? 'ACTIVE' : 'SUSPENDED'} />
                    </div>

                    <div className="mt-3 flex items-baseline gap-1">
                      <span className="text-2xl font-black text-slate-900">
                        {formatCurrency(plan.price)}
                      </span>
                      <span className="text-xs text-slate-500">
                        /{plan.billingInterval.toLowerCase()}
                      </span>
                    </div>

                    <p className="mt-2 text-xs font-semibold text-indigo-600">
                      {subscriberCount} active {subscriberCount === 1 ? 'tenant' : 'tenants'}
                    </p>

                    <div className="mt-4 pt-3 border-t border-slate-200/80 space-y-1.5">
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Included Features
                      </p>
                      {plan.features?.length > 0 ? (
                        plan.features.map((feat, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs text-slate-700">
                            <Check size={13} className="text-indigo-600 shrink-0" />
                            <span>{feat}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-400 italic">No features specified</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-200/80 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(plan)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm"
                    >
                      <Edit2 size={12} /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => togglePlan.mutate(plan)}
                      disabled={togglePlan.isPending}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        plan.isActive
                          ? 'border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                          : 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      }`}
                    >
                      {plan.isActive ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                </div>
              );
            })}
            {!plans.data?.length && (
              <p className="col-span-full py-12 text-center text-sm text-slate-500">
                No plans found. Click &quot;New Plan&quot; to configure your first tier.
              </p>
            )}
          </div>
        </QueryState>
      </section>
    </div>
  );
}
