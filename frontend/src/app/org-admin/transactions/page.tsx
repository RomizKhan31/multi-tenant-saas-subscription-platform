'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ReceiptText, Download, Eye, FileText, CheckCircle2 } from 'lucide-react';
import api from '@/lib/api';
import { DashboardHeader } from '@/components/DashboardHeader';
import {
  QueryState,
  StatusBadge,
  InvoiceModal,
  downloadInvoiceHtml,
  type InvoiceRecord,
  formatCurrency,
  formatDate,
} from '@/components/dashboard-ui';

type Payment = {
  _id: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  stripePaymentIntentId?: string;
  stripeCheckoutSessionId?: string;
};

type Transaction = {
  _id: string;
  paymentId?: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  description?: string;
};

export default function OrgAdminTransactionsPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceData, setInvoiceData] = useState<InvoiceRecord | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Fetch payments (primary invoice sources)
  const payments = useQuery({
    queryKey: ['org-payments-list', statusFilter],
    queryFn: async () =>
      (
        await api.get<{ payments: Payment[] }>('/payments', {
          params: { status: statusFilter || undefined },
        })
      ).data.payments,
  });

  // Fetch transactions (ledger audit trail)
  const transactions = useQuery({
    queryKey: ['org-transactions-list', statusFilter],
    queryFn: async () =>
      (
        await api.get<{ transactions: Transaction[] }>('/transactions', {
          params: { status: statusFilter || undefined },
        })
      ).data.transactions,
  });

  const handleViewInvoice = async (recordId: string, fallbackPaymentId?: string) => {
    const idToUse = fallbackPaymentId || recordId;
    setSelectedInvoiceId(idToUse);
    setInvoiceLoading(true);
    setInvoiceData(null);
    setNotice(null);

    try {
      let res;
      try {
        res = await api.get<any>(`/payments/${idToUse}/invoice`);
      } catch (err) {
        if (fallbackPaymentId && recordId !== fallbackPaymentId) {
          res = await api.get<any>(`/payments/${recordId}/invoice`);
        } else {
          throw err;
        }
      }
      const data = res.data?.invoice || res.data;
      setInvoiceData(data);
    } catch (err: any) {
      setNotice({
        type: 'error',
        message: err?.response?.data?.error || 'Failed to fetch invoice. Please try again.',
      });
    } finally {
      setInvoiceLoading(false);
    }
  };

  const handleDirectDownload = async (recordId: string, fallbackPaymentId?: string) => {
    const idToUse = fallbackPaymentId || recordId;
    setDownloadingId(recordId);
    setNotice(null);

    try {
      let res;
      try {
        res = await api.get<any>(`/payments/${idToUse}/invoice`);
      } catch (err) {
        if (fallbackPaymentId && recordId !== fallbackPaymentId) {
          res = await api.get<any>(`/payments/${recordId}/invoice`);
        } else {
          throw err;
        }
      }
      const data = res.data?.invoice || res.data;
      if (data) {
        downloadInvoiceHtml(data);
        setNotice({
          type: 'success',
          message: `Invoice ${data.invoiceNumber || ''} downloaded successfully.`,
        });
      }
    } catch (err: any) {
      setNotice({
        type: 'error',
        message: err?.response?.data?.error || 'Failed to download invoice document.',
      });
    } finally {
      setDownloadingId(null);
    }
  };

  // Combine payments and transactions into unified list if needed, prioritizing payments
  const paymentList = payments.data || [];
  const transactionList = transactions.data || [];

  const invoiceRecords = paymentList.length > 0 ? paymentList : transactionList;

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Invoices & Payment History"
        subtitle="Official billing receipts, transaction audit log, and Stripe payment verification."
        badge={
          <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs font-bold text-emerald-400">
            {invoiceRecords.length} Records
          </span>
        }
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

      <section className="rounded-2xl border border-slate-800 bg-[#0e1629] p-6 shadow-sm overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-slate-800 pb-5 mb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <ReceiptText size={18} />
            </div>
            <div>
              <h2 className="font-bold text-white text-base">Invoices & Receipts</h2>
              <p className="text-xs text-slate-400">
                View detailed breakdown, print tax receipts, or download HTML invoices.
              </p>
            </div>
          </div>

          <div>
            <select
              aria-label="Filter status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-900/80 px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="">All statuses</option>
              <option value="SUCCESS">SUCCESS</option>
              <option value="PENDING">PENDING</option>
              <option value="FAILED">FAILED</option>
            </select>
          </div>
        </div>

        <QueryState
          loading={payments.isLoading && transactions.isLoading}
          error={payments.error && transactions.error}
        >
          {invoiceRecords.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-sm">
              No invoice or payment records found for this organization.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="px-5 py-3.5">Invoice #</th>
                    <th className="px-5 py-3.5">Amount</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Date</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {invoiceRecords.map((item: any) => {
                    const paymentId = item.paymentId || item._id;
                    const isDownloading = downloadingId === item._id;

                    return (
                      <tr key={item._id} className="hover:bg-slate-800/40 transition">
                        <td className="px-5 py-4 font-mono text-xs text-slate-300">
                          INV-{item._id.slice(-8).toUpperCase()}
                        </td>
                        <td className="px-5 py-4 font-bold text-white">
                          {formatCurrency(item.amount, (item.currency || 'USD').toUpperCase())}
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge value={item.status} />
                        </td>
                        <td className="px-5 py-4 text-slate-400 text-xs">
                          {formatDate(item.createdAt)}
                        </td>
                        <td className="px-5 py-4 text-right space-x-2 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleViewInvoice(item._id, item.paymentId)}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg transition"
                          >
                            <Eye size={13} /> View Invoice
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDirectDownload(item._id, item.paymentId)}
                            disabled={isDownloading}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-200 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                          >
                            <Download size={13} />{' '}
                            {isDownloading ? 'Downloading...' : 'Download'}
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

      {/* Invoice Viewer Modal */}
      <InvoiceModal
        invoiceId={selectedInvoiceId}
        invoiceData={invoiceData}
        loading={invoiceLoading}
        onClose={() => {
          setSelectedInvoiceId(null);
          setInvoiceData(null);
        }}
      />
    </div>
  );
}
