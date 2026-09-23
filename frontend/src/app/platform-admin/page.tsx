'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  CheckCircle2,
  CircleDollarSign,
  CreditCard,
  Plus,
  Search,
  Users,
  X,
  Eye,
  Calendar,
  Receipt,
  History,
  ShieldAlert,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import {
  DashboardShell,
  formatCurrency,
  formatDate,
  QueryState,
  StatCard,
  StatusBadge,
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
type Subscription = { _id: string; organizationId: string; planId: string; status: string; createdAt: string; currentPeriodEnd?: string };
type Transaction = {
  _id: string;
  organizationId: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
};
type Member = { _id: string; name: string; email: string; role: string; status: string };
type Payment = { _id: string; amount: number; currency: string; status: string; createdAt: string };

type OrgDetailData = {
  organization: Organization;
  members: Member[];
  subscriptions: Subscription[];
  payments: Payment[];
  transactions: Transaction[];
};

export default function PlatformAdminDashboard() {
  const { user, logout, loading } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [transactionStatus, setTransactionStatus] = useState('');
  const [transactionOrgId, setTransactionOrgId] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [planForm, setPlanForm] = useState({
    name: '',
    price: '',
    billingInterval: 'MONTHLY',
    features: '',
  });

  useEffect(() => {
    if (!loading && (!user || user.role !== 'PLATFORM_ADMIN')) router.replace('/login');
  }, [loading, router, user]);

  const organizations = useQuery({
    queryKey: ['organizations', search, status],
    queryFn: async () =>
      (
        await api.get<{ organizations: Organization[] }>('/organizations', {
          params: { search: search || undefined, status: status || undefined },
        })
      ).data.organizations,
    enabled: user?.role === 'PLATFORM_ADMIN',
  });

  const plans = useQuery({
    queryKey: ['plans'],
    queryFn: async () => (await api.get<{ plans: Plan[] }>('/plans')).data.plans,
    enabled: user?.role === 'PLATFORM_ADMIN',
  });

  const subscriptions = useQuery({
    queryKey: ['subscriptions'],
    queryFn: async () =>
      (await api.get<{ subscriptions: Subscription[] }>('/subscriptions/all')).data.subscriptions,
    enabled: user?.role === 'PLATFORM_ADMIN',
  });

  const transactions = useQuery({
    queryKey: ['transactions', transactionStatus, transactionOrgId],
    queryFn: async () =>
      (
        await api.get<{ transactions: Transaction[] }>('/transactions/all', {
          params: {
            status: transactionStatus || undefined,
            organizationId: transactionOrgId || undefined,
          },
        })
      ).data.transactions,
    enabled: user?.role === 'PLATFORM_ADMIN',
  });

  const memberCounts = useQuery({
    queryKey: ['organization-member-counts', organizations.data?.map((org) => org._id).join(',')],
    queryFn: async () =>
      Object.fromEntries(
        await Promise.all(
          (organizations.data || []).map(async (organization) => [
            organization._id,
            (await api.get<{ count: number }>(`/organizations/${organization._id}/members`)).data
              .count,
          ])
        )
      ),
    enabled: Boolean(organizations.data?.length),
  });

  // Selected organization full details query
  const orgDetails = useQuery<OrgDetailData>({
    queryKey: ['organization-details', selectedOrgId],
    queryFn: async () => (await api.get(`/organizations/${selectedOrgId}/details`)).data,
    enabled: Boolean(selectedOrgId && user?.role === 'PLATFORM_ADMIN'),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['organizations'] });
    queryClient.invalidateQueries({ queryKey: ['plans'] });
    queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
    queryClient.invalidateQueries({ queryKey: ['transactions'] });
    if (selectedOrgId) {
      queryClient.invalidateQueries({ queryKey: ['organization-details', selectedOrgId] });
    }
  };

  const organizationAction = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'suspend' | 'reactivate' }) =>
      api.post(`/organizations/${id}/${action}`),
    onSuccess: (_, variables) => {
      setNotice({
        type: 'success',
        message: `Organization ${variables.action === 'suspend' ? 'suspended' : 'reactivated'} successfully.`,
      });
      invalidate();
    },
    onError: (error: any) => {
      setNotice({
        type: 'error',
        message: error?.response?.data?.error || 'Organization status update failed.',
      });
    },
  });

  const planAction = useMutation({
    mutationFn: async (data: { id?: string; payload: typeof planForm }) => {
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
      setPlanForm({ name: '', price: '', billingInterval: 'MONTHLY', features: '' });
      setNotice({
        type: 'success',
        message: variables.id
          ? 'Plan updated successfully.'
          : 'Plan created successfully! It is now listed below and available for onboarding.',
      });
      invalidate();
    },
    onError: (error: any) => {
      setNotice({
        type: 'error',
        message: error?.response?.data?.error || error?.message || 'Failed to save plan.',
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
      invalidate();
    },
    onError: (error: any) => {
      setNotice({
        type: 'error',
        message: error?.response?.data?.error || 'Failed to toggle plan status.',
      });
    },
  });

  const overview = useMemo(
    () => ({
      revenue: (transactions.data || [])
        .filter((item) => item.status === 'SUCCESS')
        .reduce((total, item) => total + item.amount, 0),
      totalUsers: (Object.values(memberCounts.data || {}) as number[]).reduce(
        (total, count) => total + count,
        0
      ),
      activeSubscriptions: (subscriptions.data || []).filter((item) => item.status === 'ACTIVE')
        .length,
      failedPayments: (transactions.data || []).filter((item) => item.status === 'FAILED').length,
    }),
    [memberCounts.data, subscriptions.data, transactions.data]
  );

  // Recent signups (sorted by creation date descending)
  const recentSignups = useMemo(() => {
    return [...(organizations.data || [])]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [organizations.data]);

  if (!user) return null;

  return (
    <DashboardShell
      title="Platform control center"
      subtitle="Monitor every organization, plan, and transaction from one secure workspace."
      email={user.email}
      onLogout={() => {
        logout();
        router.replace('/login');
      }}
    >
      {notice && (
        <div
          role="status"
          className={`mb-5 flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium ${
            notice.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <span>{notice.message}</span>
          <button onClick={() => setNotice(null)} className="underline ml-4">
            Dismiss
          </button>
        </div>
      )}

      <QueryState
        loading={
          organizations.isLoading ||
          plans.isLoading ||
          subscriptions.isLoading ||
          transactions.isLoading
        }
        error={
          organizations.error || plans.error || subscriptions.error || transactions.error
        }
      >
        {/* Top Metric Cards */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard
            label="Organizations"
            value={organizations.data?.length ?? 0}
            icon={<Building2 size={21} />}
            detail="Matching current filters"
          />
          <StatCard
            label="Total users"
            value={overview.totalUsers}
            icon={<Users size={21} />}
          />
          <StatCard
            label="Active subscriptions"
            value={overview.activeSubscriptions}
            icon={<CheckCircle2 size={21} />}
          />
          <StatCard
            label="Recorded revenue"
            value={formatCurrency(overview.revenue)}
            icon={<CircleDollarSign size={21} />}
          />
          <StatCard
            label="Failed payments"
            value={overview.failedPayments}
            icon={<CreditCard size={21} />}
          />
        </div>

        {/* Organizations Table */}
        <section className="mt-7 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-bold text-slate-950">Organizations</h2>
              <p className="mt-1 text-sm text-slate-500">
                Search, inspect details, and control tenant access.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-2.5 text-slate-400"
                  size={17}
                />
                <input
                  aria-label="Search organizations"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search organizations"
                  className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none ring-indigo-500 focus:ring-2 sm:w-56"
                />
              </label>
              <select
                aria-label="Filter organization status"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">All statuses</option>
                <option>ACTIVE</option>
                <option>TRIAL</option>
                <option>SUSPENDED</option>
                <option>CANCELLED</option>
              </select>
            </div>
          </div>
          {!organizations.data?.length ? (
            <p className="p-8 text-center text-sm text-slate-500">
              No organizations match the selected filters.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Organization</th>
                    <th className="px-5 py-3">Plan</th>
                    <th className="px-5 py-3">Members</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Joined</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {organizations.data.map((organization) => {
                    const subscription = subscriptions.data?.find(
                      (item) => item.organizationId === organization._id
                    );
                    const plan = plans.data?.find((item) => item._id === subscription?.planId);
                    return (
                      <tr key={organization._id} className="hover:bg-slate-50/60">
                        <td className="px-5 py-4 font-semibold text-slate-900">
                          {organization.name}
                        </td>
                        <td className="px-5 py-4 text-slate-600">
                          {plan?.name ? (
                            <span className="font-semibold text-slate-900">{plan.name}</span>
                          ) : (
                            <span className="text-xs text-slate-400 italic">No active subscription</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-slate-600">
                          {memberCounts.data?.[organization._id] ?? '—'}
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge value={organization.status} />
                        </td>
                        <td className="px-5 py-4 text-slate-600">
                          {formatDate(organization.createdAt)}
                        </td>
                        <td className="px-5 py-4 text-right space-x-3">
                          <button
                            onClick={() => setSelectedOrgId(organization._id)}
                            className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-900"
                            title="View full organization profile, members, subscriptions, and history"
                          >
                            <Eye size={15} /> Details
                          </button>
                          {organization.status === 'SUSPENDED' ? (
                            <button
                              onClick={() =>
                                organizationAction.mutate({
                                  id: organization._id,
                                  action: 'reactivate',
                                })
                              }
                              className="font-semibold text-emerald-700 hover:text-emerald-900"
                            >
                              Reactivate
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Suspend ${organization.name}? Members will lose access.`
                                  )
                                )
                                  organizationAction.mutate({
                                    id: organization._id,
                                    action: 'suspend',
                                  });
                              }}
                              className="font-semibold text-rose-700 hover:text-rose-900"
                            >
                              Suspend
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Recent Signups & Quick Overview */}
        <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={18} className="text-indigo-600" />
            <h2 className="font-bold text-slate-950">Recent Signups</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {recentSignups.map((org) => {
              const sub = subscriptions.data?.find((s) => s.organizationId === org._id);
              const plan = plans.data?.find((p) => p._id === sub?.planId);
              return (
                <div key={org._id} className="p-3 rounded-xl border border-slate-100 bg-slate-50">
                  <p className="font-semibold text-slate-900 text-sm truncate">{org.name}</p>
                  <p className="text-xs text-slate-500 mt-1">{plan?.name || 'Pending Plan'}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <StatusBadge value={org.status} />
                    <span className="text-[11px] text-slate-400">{formatDate(org.createdAt)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Plans Management & Transactions */}
        <div className="mt-7 grid gap-7 xl:grid-cols-[1.1fr_.9fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-slate-950">Plan management</h2>
                  <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-700">
                    {plans.data?.length ?? 0} plans
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  Create, update, and activate subscription plans for tenant onboarding.
                </p>
              </div>
              <Plus className="text-indigo-600" />
            </div>
            <form
              id="plan-form"
              onSubmit={(event) => {
                event.preventDefault();
                planAction.mutate({ id: editingPlan?._id, payload: planForm });
              }}
              className="mt-5 grid gap-3 sm:grid-cols-2"
            >
              <input
                required
                placeholder="Plan name"
                value={planForm.name}
                onChange={(event) => setPlanForm({ ...planForm, name: event.target.value })}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                required
                min="0"
                step="0.01"
                type="number"
                placeholder="Price (USD)"
                value={planForm.price}
                onChange={(event) => setPlanForm({ ...planForm, price: event.target.value })}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <select
                value={planForm.billingInterval}
                onChange={(event) =>
                  setPlanForm({ ...planForm, billingInterval: event.target.value })
                }
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="MONTHLY">Monthly</option>
                <option value="YEARLY">Yearly</option>
              </select>
              <input
                placeholder="Features, comma separated"
                value={planForm.features}
                onChange={(event) => setPlanForm({ ...planForm, features: event.target.value })}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="flex gap-2 sm:col-span-2">
                <button
                  type="submit"
                  disabled={planAction.isPending}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition"
                >
                  {planAction.isPending ? 'Saving plan...' : editingPlan ? 'Save changes' : 'Create plan'}
                </button>
                {editingPlan && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPlan(null);
                      setPlanForm({
                        name: '',
                        price: '',
                        billingInterval: 'MONTHLY',
                        features: '',
                      });
                    }}
                    className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
            <div className="mt-5 divide-y divide-slate-100">
              {plans.data && plans.data.length > 0 ? (
                plans.data.map((plan) => {
                  const subscriberCount =
                    subscriptions.data?.filter(
                      (s) => s.planId === plan._id && s.status === 'ACTIVE'
                    ).length ?? 0;
                  return (
                    <div
                      key={plan._id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-slate-900">{plan.name}</p>
                          <StatusBadge value={plan.isActive ? 'ACTIVE' : 'SUSPENDED'} />
                          <span className="text-xs text-slate-400">
                            ({subscriberCount} active {subscriberCount === 1 ? 'tenant' : 'tenants'})
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 mt-0.5">
                          {formatCurrency(plan.price)} / {plan.billingInterval === 'MONTHLY' ? 'month' : 'year'}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {plan.features?.length > 0 ? plan.features.join(' · ') : 'No features specified'}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => {
                            setEditingPlan(plan);
                            setPlanForm({
                              name: plan.name,
                              price: String(plan.price),
                              billingInterval: plan.billingInterval,
                              features: plan.features?.join(', ') || '',
                            });
                          }}
                          className="text-sm font-semibold text-indigo-700 hover:text-indigo-900"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => togglePlan.mutate(plan)}
                          disabled={togglePlan.isPending}
                          className={`text-sm font-semibold ${
                            plan.isActive
                              ? 'text-amber-700 hover:text-amber-900'
                              : 'text-emerald-700 hover:text-emerald-900'
                          }`}
                        >
                          {plan.isActive ? 'Disable' : 'Enable'}
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-6 text-center text-sm text-slate-500 bg-slate-50 rounded-xl mt-3">
                  No plans created yet. Use the form above to create your first subscription plan.
                </div>
              )}
            </div>
          </section>

          {/* Platform Transactions with Organization & Status filters */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
              <div>
                <h2 className="font-bold text-slate-950">Platform transactions</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Cross-organization recorded payment activity.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  aria-label="Filter transactions by organization"
                  value={transactionOrgId}
                  onChange={(event) => setTransactionOrgId(event.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700"
                >
                  <option value="">All Organizations</option>
                  {organizations.data?.map((org) => (
                    <option key={org._id} value={org._id}>
                      {org.name}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Filter transactions by status"
                  value={transactionStatus}
                  onChange={(event) => setTransactionStatus(event.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700"
                >
                  <option value="">All statuses</option>
                  <option>SUCCESS</option>
                  <option>PENDING</option>
                  <option>FAILED</option>
                  <option>REFUNDED</option>
                  <option>ROLLED_BACK</option>
                </select>
              </div>
            </div>
            <div className="divide-y divide-slate-100 max-h-[460px] overflow-y-auto">
              {transactions.data?.slice(0, 15).map((transaction) => (
                <div
                  key={transaction._id}
                  className="flex items-center justify-between gap-4 p-4 hover:bg-slate-50/50"
                >
                  <div>
                    <p className="font-semibold text-slate-900">
                      {formatCurrency(transaction.amount, transaction.currency.toUpperCase())}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {organizations.data?.find((org) => org._id === transaction.organizationId)
                        ?.name || 'Organization'}{' '}
                      · {formatDate(transaction.createdAt)}
                    </p>
                  </div>
                  <StatusBadge value={transaction.status} />
                </div>
              ))}
              {!transactions.data?.length && (
                <p className="p-8 text-center text-sm text-slate-500">
                  No transactions match the selected filters.
                </p>
              )}
            </div>
          </section>
        </div>

        {/* Organization Detail Modal */}
        {selectedOrgId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">
                    {orgDetails.data?.organization?.name || 'Organization Details'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Complete profile, member directory, subscriptions, and financial history
                  </p>
                </div>
                <button
                  onClick={() => setSelectedOrgId(null)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X size={20} />
                </button>
              </div>

              {orgDetails.isLoading ? (
                <div className="py-12 text-center text-slate-500 text-sm">
                  Loading organization data...
                </div>
              ) : orgDetails.data ? (
                <div className="space-y-6">
                  {/* Status & Profile */}
                  <div className="grid gap-4 sm:grid-cols-3 bg-slate-50 p-4 rounded-xl">
                    <div>
                      <span className="text-xs font-semibold text-slate-400 uppercase">Status</span>
                      <div className="mt-1">
                        <StatusBadge value={orgDetails.data.organization.status} />
                      </div>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-slate-400 uppercase">Signup Date</span>
                      <p className="text-sm font-medium text-slate-800 mt-1">
                        {formatDate(orgDetails.data.organization.createdAt)}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-slate-400 uppercase">Tenant ID</span>
                      <p className="text-xs font-mono text-slate-700 mt-1">
                        {orgDetails.data.organization._id}
                      </p>
                    </div>
                  </div>

                  {/* Members */}
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                      <Users size={16} className="text-indigo-600" /> Members ({orgDetails.data.members?.length || 0})
                    </h4>
                    <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                      {orgDetails.data.members?.map((m) => (
                        <div key={m._id} className="p-3 flex items-center justify-between text-xs sm:text-sm">
                          <div>
                            <span className="font-semibold text-slate-800">{m.name}</span>
                            <span className="text-slate-500 ml-2">({m.email})</span>
                          </div>
                          <span className="font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded text-xs">
                            {m.role}
                          </span>
                        </div>
                      ))}
                      {!orgDetails.data.members?.length && (
                        <p className="p-3 text-xs text-slate-500">No members found.</p>
                      )}
                    </div>
                  </div>

                  {/* Subscription History */}
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                      <Receipt size={16} className="text-indigo-600" /> Subscription History
                    </h4>
                    <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                      {orgDetails.data.subscriptions?.map((s) => (
                        <div key={s._id} className="p-3 flex items-center justify-between text-xs sm:text-sm">
                          <div>
                            <span className="font-semibold text-slate-800">
                              {plans.data?.find((p) => p._id === s.planId)?.name || 'Subscription'}
                            </span>
                            <span className="text-slate-500 ml-2">Created {formatDate(s.createdAt)}</span>
                          </div>
                          <StatusBadge value={s.status} />
                        </div>
                      ))}
                      {!orgDetails.data.subscriptions?.length && (
                        <p className="p-3 text-xs text-slate-500">No subscription history.</p>
                      )}
                    </div>
                  </div>

                  {/* Payment & Transaction History */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                        <CreditCard size={16} className="text-indigo-600" /> Payments ({orgDetails.data.payments?.length || 0})
                      </h4>
                      <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl max-h-48 overflow-y-auto">
                        {orgDetails.data.payments?.map((p) => (
                          <div key={p._id} className="p-2.5 flex items-center justify-between text-xs">
                            <span>{formatCurrency(p.amount, p.currency.toUpperCase())} · {formatDate(p.createdAt)}</span>
                            <StatusBadge value={p.status} />
                          </div>
                        ))}
                        {!orgDetails.data.payments?.length && (
                          <p className="p-3 text-xs text-slate-500">No payment records.</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                        <History size={16} className="text-indigo-600" /> Transactions ({orgDetails.data.transactions?.length || 0})
                      </h4>
                      <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl max-h-48 overflow-y-auto">
                        {orgDetails.data.transactions?.map((t) => (
                          <div key={t._id} className="p-2.5 flex items-center justify-between text-xs">
                            <span>{formatCurrency(t.amount, t.currency.toUpperCase())} · {formatDate(t.createdAt)}</span>
                            <StatusBadge value={t.status} />
                          </div>
                        ))}
                        {!orgDetails.data.transactions?.length && (
                          <p className="p-3 text-xs text-slate-500">No transaction records.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-rose-600 text-sm">
                  Could not load organization details.
                </div>
              )}
            </div>
          </div>
        )}
      </QueryState>
    </DashboardShell>
  );
}
