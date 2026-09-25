'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Eye,
  Search,
  Users,
  X,
  CreditCard,
  Receipt,
  History,
  Download,
} from 'lucide-react';
import axios from 'axios';
import api from '@/lib/api';
import { DashboardHeader } from '@/components/DashboardHeader';
import {
  QueryState,
  StatusBadge,
  InvoiceModal,
  type InvoiceRecord,
  formatCurrency,
  formatDate,
} from '@/components/dashboard-ui';

type Organization = { _id: string; name: string; status: string; createdAt: string };
type Plan = { _id: string; name: string; price: number; billingInterval: 'MONTHLY' | 'YEARLY' };
type Subscription = { _id: string; organizationId: string; planId: string; status: string; createdAt: string };
type Member = { _id: string; name: string; email: string; role: string; status: string };
type Payment = { _id: string; amount: number; currency: string; status: string; createdAt: string };
type Transaction = { _id: string; amount: number; currency: string; status: string; createdAt: string };

type OrgDetailData = {
  organization: Organization;
  members: Member[];
  subscriptions: Subscription[];
  payments: Payment[];
  transactions: Transaction[];
};

export default function PlatformAdminOrganizationsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Invoice state
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceData, setInvoiceData] = useState<InvoiceRecord | null>(null);

  const organizations = useQuery({
    queryKey: ['organizations-list', search, status],
    queryFn: async () =>
      (
        await api.get<{ organizations: Organization[] }>('/organizations', {
          params: { search: search || undefined, status: status || undefined },
        })
      ).data.organizations,
  });

  const subscriptions = useQuery({
    queryKey: ['subscriptions-all'],
    queryFn: async () =>
      (await api.get<{ subscriptions: Subscription[] }>('/subscriptions/all')).data.subscriptions,
  });

  const plans = useQuery({
    queryKey: ['plans-all'],
    queryFn: async () => (await api.get<{ plans: Plan[] }>('/plans')).data.plans,
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

  const orgDetails = useQuery<OrgDetailData>({
    queryKey: ['organization-details', selectedOrgId],
    queryFn: async () => (await api.get(`/organizations/${selectedOrgId}/details`)).data,
    enabled: Boolean(selectedOrgId),
  });

  const organizationAction = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'suspend' | 'reactivate' }) =>
      api.post(`/organizations/${id}/${action}`),
    onSuccess: (_, variables) => {
      setNotice({
        type: 'success',
        message: `Organization ${variables.action === 'suspend' ? 'suspended' : 'reactivated'} successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: ['organizations-list'] });
      if (selectedOrgId) {
        queryClient.invalidateQueries({ queryKey: ['organization-details', selectedOrgId] });
      }
    },
    onError: (error: unknown) => {
      const message =
        axios.isAxiosError(error) && error.response?.data?.error
          ? error.response.data.error
          : 'Organization status update failed.';
      setNotice({
        type: 'error',
        message,
      });
    },
  });

  const handleViewInvoice = async (paymentId: string) => {
    setSelectedInvoiceId(paymentId);
    setInvoiceLoading(true);
    setInvoiceData(null);
    try {
      const res = await api.get<{ invoice?: InvoiceRecord }>(`/payments/${paymentId}/invoice`);
      const data = res.data?.invoice || (res.data as unknown as InvoiceRecord);
      setInvoiceData(data);
    } catch (err: unknown) {
      const message =
        axios.isAxiosError(err) && err.response?.data?.error
          ? err.response.data.error
          : 'Failed to fetch invoice.';
      setNotice({ type: 'error', message });
      setSelectedInvoiceId(null);
    } finally {
      setInvoiceLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Organizations Directory"
        subtitle="Search, inspect tenant profiles, review member quotas, and control tenant access permissions."
        badge={
          <span className="rounded-full bg-indigo-50 border border-indigo-200 px-3 py-1 text-xs font-bold text-indigo-700">
            {organizations.data?.length ?? 0} Tenants
          </span>
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

      {/* Main Organizations Card */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Filters Header */}
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
              <Building2 size={18} />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-base">Active Organizations</h2>
              <p className="text-xs text-slate-500">
                Live multi-tenant accounts registered on this platform.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 sm:flex-row">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3.5 top-2.5 text-slate-400"
                size={16}
              />
              <input
                aria-label="Search organizations"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search organizations..."
                className="w-full sm:w-64 rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
              />
            </div>

            <select
              aria-label="Filter organization status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-600"
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="TRIAL">TRIAL</option>
              <option value="SUSPENDED">SUSPENDED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>
        </div>

        {/* Organizations Table */}
        <QueryState loading={organizations.isLoading} error={organizations.error}>
          {!organizations.data?.length ? (
            <div className="p-12 text-center text-slate-500 text-sm">
              No organizations match the selected search criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="px-5 py-3.5">Organization</th>
                    <th className="px-5 py-3.5">Subscription Plan</th>
                    <th className="px-5 py-3.5">Members</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Signup Date</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {organizations.data.map((organization) => {
                    const subscription = subscriptions.data?.find(
                      (item) => item.organizationId === organization._id
                    );
                    const plan = plans.data?.find((item) => item._id === subscription?.planId);

                    return (
                      <tr key={organization._id} className="hover:bg-slate-50/70 transition">
                        <td className="px-5 py-4 font-bold text-slate-900">
                          {organization.name}
                        </td>
                        <td className="px-5 py-4 text-slate-600">
                          {plan?.name ? (
                            <span className="font-semibold text-slate-800">{plan.name}</span>
                          ) : (
                            <span className="text-xs text-slate-400 italic">No plan assigned</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-slate-600">
                          {memberCounts.data?.[organization._id] ?? '—'}
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge value={organization.status} />
                        </td>
                        <td className="px-5 py-4 text-slate-500">
                          {formatDate(organization.createdAt)}
                        </td>
                        <td className="px-5 py-4 text-right space-x-3 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setSelectedOrgId(organization._id)}
                            className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-700 transition"
                          >
                            <Eye size={15} /> Details
                          </button>

                          {organization.status === 'SUSPENDED' ? (
                            <button
                              type="button"
                              onClick={() =>
                                organizationAction.mutate({
                                  id: organization._id,
                                  action: 'reactivate',
                                })
                              }
                              disabled={organizationAction.isPending}
                              className="font-semibold text-emerald-600 hover:text-emerald-700 transition disabled:opacity-50"
                            >
                              Reactivate
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Suspend ${organization.name}? All members in this tenant will lose access immediately.`
                                  )
                                ) {
                                  organizationAction.mutate({
                                    id: organization._id,
                                    action: 'suspend',
                                  });
                                }
                              }}
                              disabled={organizationAction.isPending}
                              className="font-semibold text-rose-600 hover:text-rose-700 transition disabled:opacity-50"
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
        </QueryState>
      </section>

      {/* Organization Detail Modal */}
      {selectedOrgId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  {orgDetails.data?.organization?.name || 'Organization Details'}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Tenant configuration, member roster, subscription history, and payment transactions
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrgId(null)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                <X size={20} />
              </button>
            </div>

            {orgDetails.isLoading ? (
              <div className="py-12 text-center text-slate-500 text-sm">
                Loading organization profile...
              </div>
            ) : orgDetails.data ? (
              <div className="space-y-6">
                {/* Status & Profile Strip */}
                <div className="grid gap-4 sm:grid-cols-3 bg-slate-50 border border-slate-200 p-4 rounded-xl">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Status
                    </span>
                    <div className="mt-1 flex items-center gap-2">
                      <StatusBadge value={orgDetails.data.organization.status} />
                      {orgDetails.data.organization.status === 'SUSPENDED' ? (
                        <button
                          type="button"
                          onClick={() =>
                            organizationAction.mutate({
                              id: orgDetails.data.organization._id,
                              action: 'reactivate',
                            })
                          }
                          disabled={organizationAction.isPending}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition disabled:opacity-50"
                        >
                          {organizationAction.isPending ? 'Updating...' : 'Reactivate'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              window.confirm(
                                `Suspend ${orgDetails.data.organization.name}? All members in this tenant will lose access immediately.`
                              )
                            ) {
                              organizationAction.mutate({
                                id: orgDetails.data.organization._id,
                                action: 'suspend',
                              });
                            }
                          }}
                          disabled={organizationAction.isPending}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition disabled:opacity-50"
                        >
                          {organizationAction.isPending ? 'Updating...' : 'Suspend'}
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Signup Date
                    </span>
                    <p className="text-sm font-semibold text-slate-800 mt-1">
                      {formatDate(orgDetails.data.organization.createdAt)}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Tenant ID
                    </span>
                    <p className="text-xs font-mono text-slate-700 mt-1 truncate">
                      {orgDetails.data.organization._id}
                    </p>
                  </div>
                </div>

                {/* Team Members */}
                <div>
                  <h4 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
                    <Users size={16} className="text-indigo-600" /> Members (
                    {orgDetails.data.members?.length || 0})
                  </h4>
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                    {orgDetails.data.members?.map((m) => (
                      <div
                        key={m._id}
                        className="p-3 flex items-center justify-between text-xs sm:text-sm"
                      >
                        <div>
                          <span className="font-semibold text-slate-900">{m.name}</span>
                          <span className="text-slate-500 ml-2">({m.email})</span>
                        </div>
                        <span className="font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded text-xs">
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
                  <h4 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
                    <Receipt size={16} className="text-indigo-600" /> Subscription History
                  </h4>
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                    {orgDetails.data.subscriptions?.map((s) => (
                      <div
                        key={s._id}
                        className="p-3 flex items-center justify-between text-xs sm:text-sm"
                      >
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

                {/* Payments & Transactions */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
                      <CreditCard size={16} className="text-indigo-600" /> Payments (
                      {orgDetails.data.payments?.length || 0})
                    </h4>
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl max-h-48 overflow-y-auto bg-white shadow-sm">
                      {orgDetails.data.payments?.map((p) => (
                        <div
                          key={p._id}
                          className="p-3 flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-semibold text-slate-900">
                              {formatCurrency(p.amount, p.currency.toUpperCase())}
                            </span>
                            <span className="text-slate-500 ml-1.5">· {formatDate(p.createdAt)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusBadge value={p.status} />
                            <button
                              type="button"
                              onClick={() => handleViewInvoice(p._id)}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded transition"
                            >
                              <Download size={11} /> Invoice
                            </button>
                          </div>
                        </div>
                      ))}
                      {!orgDetails.data.payments?.length && (
                        <p className="p-3 text-xs text-slate-500">No payment records found.</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
                      <History size={16} className="text-indigo-600" /> Transactions (
                      {orgDetails.data.transactions?.length || 0})
                    </h4>
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl max-h-48 overflow-y-auto bg-white shadow-sm">
                      {orgDetails.data.transactions?.map((t) => (
                        <div
                          key={t._id}
                          className="p-3 flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-semibold text-slate-900">
                              {formatCurrency(t.amount, t.currency.toUpperCase())}
                            </span>
                            <span className="text-slate-500 ml-1.5">· {formatDate(t.createdAt)}</span>
                          </div>
                          <StatusBadge value={t.status} />
                        </div>
                      ))}
                      {!orgDetails.data.transactions?.length && (
                        <p className="p-3 text-xs text-slate-500">No transaction records found.</p>
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

      {/* Invoice Modal */}
      <InvoiceModal
        invoiceId={selectedInvoiceId}
        invoiceData={invoiceData}
        loading={invoiceLoading}
        onClose={() => setSelectedInvoiceId(null)}
      />
    </div>
  );
}
