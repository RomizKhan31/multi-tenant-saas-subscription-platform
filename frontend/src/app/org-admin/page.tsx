'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  CreditCard,
  ReceiptText,
  UserPlus,
  Users,
  Download,
  X,
  Printer,
  Loader2,
  Filter,
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

type Organization = { name: string; contactEmail: string; billingEmail: string; status: string };
type Member = {
  _id: string;
  name: string;
  email: string;
  role: 'ORGANIZATION_ADMIN' | 'ORGANIZATION_MEMBER';
  status: string;
  createdAt: string;
};
type Plan = { _id: string; name: string; price: number; billingInterval: string; isActive: boolean };
type Subscription = {
  _id: string;
  planId: string;
  status: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
};
type Payment = {
  _id: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  stripePaymentIntentId?: string;
};
type Transaction = {
  _id: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  description?: string;
};

type InvoiceData = {
  invoiceNumber: string;
  date: string;
  dueDate?: string;
  organization: {
    id?: string;
    name: string;
    billingEmail: string;
    contactEmail?: string;
  };
  amount: number;
  currency: string;
  status: string;
  planName?: string;
  billingInterval?: string;
  lineItems: Array<{ description: string; amount: number; quantity: number; unitPrice?: number }>;
  paymentIntentId?: string;
  stripePaymentIntentId?: string;
  subtotal?: number;
  tax?: number;
  total?: number;
};

const getApiMessage = (error: any, fallback: string) => error?.response?.data?.error || fallback;

export default function OrganizationAdminDashboard() {
  const { user, logout, loading } = useAuth();
  const router = useRouter();
  const client = useQueryClient();

  const [profile, setProfile] = useState({ name: '', contactEmail: '', billingEmail: '' });
  const [invite, setInvite] = useState({ email: '', role: 'ORGANIZATION_MEMBER' });
  const [notice, setNotice] = useState('');
  const [transactionStatus, setTransactionStatus] = useState('');

  // Invoice state
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);

  useEffect(() => {
    if (!loading && (!user || user.role !== 'ORGANIZATION_ADMIN')) router.replace('/login');
  }, [loading, user, router]);

  const organization = useQuery({
    queryKey: ['current-organization'],
    queryFn: async () => (await api.get<Organization>('/organizations/current')).data,
    enabled: user?.role === 'ORGANIZATION_ADMIN',
  });

  const members = useQuery({
    queryKey: ['members'],
    queryFn: async () => (await api.get<{ members: Member[] }>('/members')).data.members,
    enabled: user?.role === 'ORGANIZATION_ADMIN',
  });

  const plans = useQuery({
    queryKey: ['active-plans'],
    queryFn: async () => (await api.get<{ plans: Plan[] }>('/plans/active')).data.plans,
    enabled: user?.role === 'ORGANIZATION_ADMIN',
  });

  const subscription = useQuery({
    queryKey: ['subscription'],
    queryFn: async () => (await api.get<Subscription>('/subscriptions')).data,
    enabled: user?.role === 'ORGANIZATION_ADMIN',
    retry: false,
  });

  const payments = useQuery({
    queryKey: ['payments'],
    queryFn: async () => (await api.get<{ payments: Payment[] }>('/payments')).data.payments,
    enabled: user?.role === 'ORGANIZATION_ADMIN',
  });

  const transactions = useQuery({
    queryKey: ['transactions', transactionStatus],
    queryFn: async () =>
      (
        await api.get<{ transactions: Transaction[] }>('/transactions', {
          params: { status: transactionStatus || undefined },
        })
      ).data.transactions,
    enabled: user?.role === 'ORGANIZATION_ADMIN',
  });

  useEffect(() => {
    if (organization.data) {
      setProfile({
        name: organization.data.name,
        contactEmail: organization.data.contactEmail || '',
        billingEmail: organization.data.billingEmail || '',
      });
    }
  }, [organization.data]);

  const invalidate = () =>
    ['current-organization', 'members', 'subscription', 'payments', 'transactions'].forEach((key) =>
      client.invalidateQueries({ queryKey: [key] })
    );

  const saveProfile = useMutation({
    mutationFn: () => api.put('/organizations/profile', profile),
    onSuccess: () => {
      invalidate();
      setNotice('Organization profile saved.');
    },
    onError: (error) =>
      setNotice(getApiMessage(error, 'Could not save the profile. Please review the fields and try again.')),
  });

  const inviteMember = useMutation({
    mutationFn: () => api.post('/members/invite', invite),
    onSuccess: () => {
      setInvite({ email: '', role: 'ORGANIZATION_MEMBER' });
      invalidate();
      setNotice('Invitation created successfully.');
    },
    onError: (error) => setNotice(getApiMessage(error, 'Could not send the invitation.')),
  });

  const updateMember = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      api.put(`/members/${id}/role`, { role }),
    onSuccess: () => {
      invalidate();
      setNotice('Member role updated.');
    },
  });

  const removeMember = useMutation({
    mutationFn: (id: string) => api.delete(`/members/${id}`),
    onSuccess: () => {
      invalidate();
      setNotice('Member removed.');
    },
  });

  const subscriptionAction = useMutation({
    mutationFn: () => api.post('/subscriptions/cancel'),
    onSuccess: () => {
      invalidate();
      setNotice('Subscription cancellation scheduled at period end.');
    },
    onError: () => setNotice('The subscription could not be updated.'),
  });

  const checkout = useMutation({
    mutationFn: async (planId: string) =>
      (await api.post<{ url: string }>('/payments/checkout', { planId })).data,
    onSuccess: (data) => {
      if (data.url) window.location.assign(data.url);
      else setNotice('Checkout could not be started. Please try again.');
    },
    onError: (error) =>
      setNotice(getApiMessage(error, 'Checkout could not be started. Please try again.')),
  });

  // Handle invoice fetch
  const handleViewInvoice = async (paymentId: string) => {
    setSelectedInvoiceId(paymentId);
    setInvoiceLoading(true);
    setInvoiceData(null);
    try {
      const res = await api.get<any>(`/payments/${paymentId}/invoice`);
      const data = res.data?.invoice || res.data;
      setInvoiceData(data);
    } catch (err: any) {
      setNotice(getApiMessage(err, 'Failed to fetch invoice.'));
      setSelectedInvoiceId(null);
    } finally {
      setInvoiceLoading(false);
    }
  };

  const handleDownloadJson = (data: InvoiceData) => {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${data.invoiceNumber || 'invoice'}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadHtml = (data: InvoiceData) => {
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Invoice ${data.invoiceNumber}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 40px; color: #1e293b; background: #fff; }
    .invoice-card { max-width: 650px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; }
    .title { font-size: 24px; font-weight: 800; color: #4338ca; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 700; background: #ecfdf5; color: #047857; margin-top: 4px; }
    .details { display: flex; justify-content: space-between; margin-top: 24px; font-size: 13px; line-height: 1.6; }
    .details-box { background: #f8fafc; padding: 16px; border-radius: 8px; width: 46%; }
    .label { font-size: 11px; text-transform: uppercase; font-weight: 700; color: #64748b; margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 28px; font-size: 13px; }
    th { text-align: left; padding: 12px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; color: #475569; font-weight: 600; text-transform: uppercase; font-size: 11px; }
    td { padding: 12px; border-bottom: 1px solid #f1f5f9; }
    .total-box { margin-top: 24px; background: #eef2ff; padding: 16px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; font-size: 16px; font-weight: 800; color: #312e81; }
    .footer { margin-top: 32px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="invoice-card">
    <div class="header">
      <div>
        <div class="title">INVOICE</div>
        <div style="font-family: monospace; font-weight: 700; color: #475569; margin-top: 4px;">${data.invoiceNumber}</div>
        <div class="badge">${data.status}</div>
      </div>
      <div style="text-align: right;">
        <div style="font-weight: 800; font-size: 16px; color: #0f172a;">SaaS Platform</div>
        <div style="font-size: 12px; color: #64748b; margin-top: 2px;">Billing & Subscriptions</div>
        <div style="font-size: 12px; color: #64748b;">${formatDate(data.date)}</div>
      </div>
    </div>
    <div class="details">
      <div class="details-box">
        <div class="label">Billed To</div>
        <div style="font-weight: 700; color: #0f172a;">${data.organization?.name || organization.data?.name || 'Customer'}</div>
        <div>${data.organization?.billingEmail || organization.data?.billingEmail || ''}</div>
      </div>
      <div class="details-box">
        <div class="label">Payment Details</div>
        <div><strong>Status:</strong> ${data.status}</div>
        <div><strong>Currency:</strong> ${data.currency}</div>
        ${data.paymentIntentId ? `<div style="font-family: monospace; font-size: 11px; word-break: break-all;"><strong>Ref:</strong> ${data.paymentIntentId}</div>` : ''}
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th style="text-align: center;">Qty</th>
          <th style="text-align: right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${(data.lineItems && data.lineItems.length > 0
          ? data.lineItems
          : [{ description: `${data.planName || 'Subscription Plan'} (${data.billingInterval || 'MONTHLY'})`, quantity: 1, amount: data.amount }]
        ).map((item) => `
          <tr>
            <td><strong>${item.description}</strong></td>
            <td style="text-align: center;">${item.quantity || 1}</td>
            <td style="text-align: right; font-weight: 600;">${formatCurrency(item.amount, data.currency)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <div class="total-box">
      <span>Total Paid</span>
      <span>${formatCurrency(data.amount, data.currency)}</span>
    </div>
    <div class="footer">
      This is a verified computer-generated tax invoice for tenant subscriptions. Thank you for your business.
    </div>
  </div>
</body>
</html>`;
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${data.invoiceNumber || 'invoice'}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!user) return null;
  const currentPlan = plans.data?.find((plan) => plan._id === subscription.data?.planId);

  return (
    <DashboardShell
      title="Organization workspace"
      subtitle="Manage your team, subscription, and organization records."
      email={user.email}
      onLogout={() => {
        logout();
        router.replace('/login');
      }}
    >
      {notice && (
        <div
          role="status"
          className="mb-5 flex items-center justify-between rounded-xl bg-indigo-50 px-4 py-3 text-sm font-medium text-indigo-800"
        >
          {notice}
          <button onClick={() => setNotice('')} className="underline">
            Dismiss
          </button>
        </div>
      )}

      <QueryState
        loading={
          organization.isLoading ||
          members.isLoading ||
          plans.isLoading ||
          payments.isLoading ||
          transactions.isLoading
        }
        error={
          organization.error ||
          members.error ||
          plans.error ||
          payments.error ||
          transactions.error
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Organization status"
            value={<StatusBadge value={organization.data?.status} />}
            icon={<Building2 size={21} />}
          />
          <StatCard
            label="Team members"
            value={members.data?.length ?? 0}
            icon={<Users size={21} />}
          />
          <StatCard
            label="Current plan"
            value={currentPlan?.name || 'Not set'}
            icon={<CreditCard size={21} />}
          />
          <StatCard
            label="Payments"
            value={payments.data?.length ?? 0}
            icon={<ReceiptText size={21} />}
          />
        </div>

        <div className="mt-7 grid gap-7 xl:grid-cols-2">
          {/* Organization Profile */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-slate-950">Organization profile</h2>
            <p className="mt-1 text-sm text-slate-500">
              Update the contact details and billing email for your tenant account.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveProfile.mutate();
              }}
              className="mt-5 grid gap-3"
            >
              <div>
                <label className="text-xs font-semibold text-slate-700">Organization Name</label>
                <input
                  required
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  placeholder="Organization name"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Contact Email</label>
                <input
                  required
                  type="email"
                  value={profile.contactEmail}
                  onChange={(e) => setProfile({ ...profile, contactEmail: e.target.value })}
                  placeholder="contact@company.com"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Billing Email</label>
                <input
                  required
                  type="email"
                  value={profile.billingEmail}
                  onChange={(e) => setProfile({ ...profile, billingEmail: e.target.value })}
                  placeholder="billing@company.com"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <button
                disabled={saveProfile.isPending}
                className="justify-self-start rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saveProfile.isPending ? 'Saving…' : 'Save profile'}
              </button>
            </form>
          </section>

          {/* Members Management */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-slate-950">Team members</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Invite teammates and manage roles.
                </p>
              </div>
              <UserPlus className="text-indigo-600" />
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                inviteMember.mutate();
              }}
              className="mt-5 flex flex-col gap-2 sm:flex-row"
            >
              <input
                required
                type="email"
                value={invite.email}
                onChange={(e) => setInvite({ ...invite, email: e.target.value })}
                placeholder="teammate@company.com"
                className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <select
                value={invite.role}
                onChange={(e) => setInvite({ ...invite, role: e.target.value })}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="ORGANIZATION_MEMBER">Member</option>
                <option value="ORGANIZATION_ADMIN">Admin</option>
              </select>
              <button
                disabled={inviteMember.isPending}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {inviteMember.isPending ? 'Sending…' : 'Invite'}
              </button>
            </form>
            <div className="mt-4 divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {members.data?.map((member) => (
                <div
                  key={member._id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div>
                    <p className="font-semibold text-slate-900">{member.name}</p>
                    <p className="text-xs text-slate-500">
                      {member.email} · joined {formatDate(member.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={member.role}
                      onChange={(e) =>
                        updateMember.mutate({ id: member._id, role: e.target.value })
                      }
                      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
                    >
                      <option value="ORGANIZATION_MEMBER">Member</option>
                      <option value="ORGANIZATION_ADMIN">Admin</option>
                    </select>
                    <button
                      onClick={() => {
                        if (window.confirm(`Remove ${member.name} from the organization?`))
                          removeMember.mutate(member._id);
                      }}
                      className="rounded-md px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 hover:text-rose-900"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Subscription & Plans */}
        <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-bold text-slate-950">Subscription & billing</h2>
              <p className="mt-1 text-sm text-slate-500">
                Choose a plan or manage your current subscription.
              </p>
            </div>
            {subscription.data && (
              <div className="flex items-center gap-2">
                <StatusBadge value={subscription.data.status} />
                {subscription.data.currentPeriodEnd && (
                  <span className="text-xs text-slate-500">
                    Renews {formatDate(subscription.data.currentPeriodEnd)}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {plans.data?.map((plan) => {
              const isActivePlan =
                plan._id === subscription.data?.planId && subscription.data?.status === 'ACTIVE';
              return (
                <article
                  key={plan._id}
                  className={`rounded-xl border p-4 ${
                    plan._id === subscription.data?.planId
                      ? 'border-indigo-400 bg-indigo-50/40 ring-1 ring-indigo-400'
                      : 'border-slate-200'
                  }`}
                >
                  <p className="font-bold text-slate-900">{plan.name}</p>
                  <p className="mt-1 text-xl font-bold">
                    {formatCurrency(plan.price)}{' '}
                    <span className="text-sm font-normal text-slate-500">
                      / {plan.billingInterval.toLowerCase()}
                    </span>
                  </p>
                  <button
                    onClick={() => checkout.mutate(plan._id)}
                    disabled={checkout.isPending || isActivePlan}
                    className="mt-4 w-full rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm font-semibold text-indigo-700 hover:border-indigo-500 hover:bg-indigo-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 transition"
                  >
                    {checkout.isPending
                      ? 'Opening secure checkout…'
                      : isActivePlan
                      ? 'Current plan'
                      : 'Switch to this plan'}
                  </button>
                </article>
              );
            })}
          </div>
          {subscription.data?.status === 'ACTIVE' && (
            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Need to cancel? Your access remains active until the end of the current billing cycle.
              </span>
              <button
                onClick={() => {
                  if (
                    window.confirm(
                      'Are you sure you want to cancel this subscription at period end?'
                    )
                  )
                    subscriptionAction.mutate();
                }}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 hover:text-rose-900"
              >
                Cancel subscription
              </button>
            </div>
          )}
        </section>

        {/* Payment History & Transactions */}
        <div className="mt-7 grid gap-7 xl:grid-cols-2">
          {/* Payment History with Invoices */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5">
              <h2 className="font-bold text-slate-950">Payment history & invoices</h2>
              <p className="mt-1 text-xs text-slate-500">
                Download verified tenant invoices for past payments.
              </p>
            </div>
            {payments.data?.length ? (
              <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                {payments.data.map((item) => (
                  <div
                    key={item._id}
                    className="flex items-center justify-between gap-4 p-4 hover:bg-slate-50/50"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">
                        {formatCurrency(item.amount, item.currency.toUpperCase())}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{formatDate(item.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge value={item.status} />
                      <button
                        onClick={() => handleViewInvoice(item._id)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg transition"
                      >
                        <Download size={13} /> Invoice
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="p-8 text-center text-sm text-slate-500">No payment records found.</p>
            )}
          </section>

          {/* Transactions with Status Filter */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <div>
                <h2 className="font-bold text-slate-950">Transactions</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Tenant ledger transactions with status filtering.
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <Filter size={14} className="text-slate-400" />
                <select
                  aria-label="Filter transactions by status"
                  value={transactionStatus}
                  onChange={(e) => setTransactionStatus(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700"
                >
                  <option value="">All statuses</option>
                  <option>SUCCESS</option>
                  <option>PENDING</option>
                  <option>FAILED</option>
                  <option>REFUNDED</option>
                </select>
              </div>
            </div>
            {transactions.data?.length ? (
              <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                {transactions.data.map((item) => (
                  <div
                    key={item._id}
                    className="flex items-center justify-between gap-4 p-4 hover:bg-slate-50/50"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">
                        {formatCurrency(item.amount, item.currency.toUpperCase())}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.description || 'SaaS Subscription'} · {formatDate(item.createdAt)}
                      </p>
                    </div>
                    <StatusBadge value={item.status} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="p-8 text-center text-sm text-slate-500">
                No transactions match the selected filter.
              </p>
            )}
          </section>
        </div>

        {/* Invoice Modal */}
        {selectedInvoiceId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <ReceiptText size={20} className="text-indigo-600" />
                  <h3 className="text-lg font-bold text-slate-900">Payment Invoice</h3>
                </div>
                <button
                  onClick={() => setSelectedInvoiceId(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X size={18} />
                </button>
              </div>

              {invoiceLoading ? (
                <div className="py-12 flex items-center justify-center text-slate-500 text-sm">
                  <Loader2 className="animate-spin mr-2" size={18} /> Generating invoice details...
                </div>
              ) : invoiceData ? (
                <div id="printable-invoice" className="space-y-5 text-sm">
                  {/* Invoice Header */}
                  <div className="flex justify-between items-start bg-slate-50 p-4 rounded-xl">
                    <div>
                      <p className="text-xs uppercase font-semibold text-slate-400">Invoice Number</p>
                      <p className="font-mono font-bold text-slate-800 text-sm mt-0.5">
                        {invoiceData.invoiceNumber}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">{formatDate(invoiceData.date)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs uppercase font-semibold text-slate-400">Billed To</p>
                      <p className="font-bold text-slate-800 text-sm mt-0.5">
                        {invoiceData.organization?.name || organization.data?.name || 'Customer'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {invoiceData.organization?.billingEmail || organization.data?.billingEmail || ''}
                      </p>
                    </div>
                  </div>

                  {/* Line Items */}
                  <div className="border border-slate-100 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase">
                        <tr>
                          <th className="p-3">Description</th>
                          <th className="p-3 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(invoiceData.lineItems && invoiceData.lineItems.length > 0
                          ? invoiceData.lineItems
                          : [
                              {
                                description: `${invoiceData.planName || 'Subscription Plan'} (${invoiceData.billingInterval || 'MONTHLY'})`,
                                amount: invoiceData.amount,
                                quantity: 1,
                              },
                            ]
                        ).map((li, idx) => (
                          <tr key={idx}>
                            <td className="p-3 font-medium text-slate-800">{li.description}</td>
                            <td className="p-3 text-right font-semibold text-slate-900">
                              {formatCurrency(li.amount, invoiceData.currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Payment Details */}
                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-xl text-slate-600">
                    <div>
                      <span className="font-medium text-slate-500">Status: </span>
                      <span className="font-bold text-emerald-700">{invoiceData.status}</span>
                    </div>
                    {invoiceData.paymentIntentId && (
                      <div className="text-right truncate">
                        <span className="font-medium text-slate-500">Ref: </span>
                        <span className="font-mono text-[11px] text-slate-700">
                          {invoiceData.paymentIntentId}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Total & Status */}
                  <div className="flex justify-between items-center p-3 bg-indigo-50/50 rounded-xl">
                    <span className="font-bold text-slate-900">Total Paid</span>
                    <span className="text-lg font-black text-indigo-700">
                      {formatCurrency(invoiceData.amount, invoiceData.currency)}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="no-print pt-2 flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => handleDownloadJson(invoiceData)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      title="Download raw invoice data in JSON format"
                    >
                      <Download size={14} /> Download JSON
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadHtml(invoiceData)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      title="Download formatted HTML invoice document"
                    >
                      <Download size={14} /> Download Invoice
                    </button>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                    >
                      <Printer size={14} /> Print / PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedInvoiceId(null)}
                      className="px-4 py-2 rounded-xl bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-700"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-sm text-rose-600">
                  Could not load invoice data.
                </div>
              )}
            </div>
          </div>
        )}
      </QueryState>
    </DashboardShell>
  );
}
