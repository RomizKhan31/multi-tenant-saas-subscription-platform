'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ReceiptText, Eye } from 'lucide-react';
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

type Organization = { _id: string; name: string };
type Transaction = {
  _id: string;
  organizationId: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
};

export default function PlatformAdminTransactionsPage() {
  const [transactionStatus, setTransactionStatus] = useState('');
  const [transactionOrgId, setTransactionOrgId] = useState('');

  // Invoice modal state
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceData, setInvoiceData] = useState<InvoiceRecord | null>(null);

  const organizations = useQuery({
    queryKey: ['organizations-names'],
    queryFn: async () =>
      (await api.get<{ organizations: Organization[] }>('/organizations')).data.organizations,
  });

  const transactions = useQuery({
    queryKey: ['transactions-all-page', transactionStatus, transactionOrgId],
    queryFn: async () =>
      (
        await api.get<{ transactions: Transaction[] }>('/transactions/all', {
          params: {
            status: transactionStatus || undefined,
            organizationId: transactionOrgId || undefined,
          },
        })
      ).data.transactions,
  });

  const handleViewInvoice = async (paymentId: string) => {
    setSelectedInvoiceId(paymentId);
    setInvoiceLoading(true);
    setInvoiceData(null);
    try {
      const res = await api.get<{ invoice?: InvoiceRecord }>(`/payments/${paymentId}/invoice`);
      const data = res.data?.invoice || (res.data as unknown as InvoiceRecord);
      setInvoiceData(data);
    } catch {
      setSelectedInvoiceId(null);
    } finally {
      setInvoiceLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Platform Transactions"
        subtitle="Complete cross-tenant financial audit trail and payment activity ledger."
        badge={
          <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs font-bold text-emerald-400">
            {transactions.data?.length ?? 0} Recorded Charges
          </span>
        }
      />

      <section className="rounded-2xl border border-slate-800 bg-[#0e1629] p-6 shadow-sm overflow-hidden">
        {/* Filters bar */}
        <div className="flex flex-col gap-4 border-b border-slate-800 pb-5 mb-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <ReceiptText size={18} />
            </div>
            <div>
              <h2 className="font-bold text-white text-base">Recorded Transactions</h2>
              <p className="text-xs text-slate-400">Real-time payment records & settlement status.</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <select
              aria-label="Filter transactions by organization"
              value={transactionOrgId}
              onChange={(e) => setTransactionOrgId(e.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
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
              onChange={(e) => setTransactionStatus(e.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="">All statuses</option>
              <option value="SUCCESS">SUCCESS</option>
              <option value="PENDING">PENDING</option>
              <option value="FAILED">FAILED</option>
              <option value="REFUNDED">REFUNDED</option>
              <option value="ROLLED_BACK">ROLLED_BACK</option>
            </select>
          </div>
        </div>

        <QueryState loading={transactions.isLoading} error={transactions.error}>
          {!transactions.data?.length ? (
            <div className="p-12 text-center text-slate-500 text-sm">
              No transactions match the selected filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="px-5 py-3.5">Transaction ID</th>
                    <th className="px-5 py-3.5">Organization</th>
                    <th className="px-5 py-3.5">Amount</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Date</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {transactions.data.map((transaction) => {
                    const org = organizations.data?.find(
                      (o) => o._id === transaction.organizationId
                    );

                    return (
                      <tr key={transaction._id} className="hover:bg-slate-800/40 transition">
                        <td className="px-5 py-4 font-mono text-xs text-slate-400">
                          {transaction._id.slice(-8)}
                        </td>
                        <td className="px-5 py-4 font-semibold text-white">
                          {org?.name || 'Tenant Organization'}
                        </td>
                        <td className="px-5 py-4 font-bold text-white">
                          {formatCurrency(
                            transaction.amount,
                            transaction.currency.toUpperCase()
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge value={transaction.status} />
                        </td>
                        <td className="px-5 py-4 text-slate-400">
                          {formatDate(transaction.createdAt)}
                        </td>
                        <td className="px-5 py-4 text-right space-x-2 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleViewInvoice(transaction._id)}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5 rounded-lg transition"
                          >
                            <Eye size={12} /> View Invoice
                          </button>
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
