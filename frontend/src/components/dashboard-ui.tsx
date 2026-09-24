import type { ReactNode } from 'react';
import {
  Download,
  Loader2,
  Printer,
  X,
  ReceiptText,
} from 'lucide-react';

export const formatCurrency = (amount?: number, currency = 'USD') =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount ?? 0);

export const formatDate = (value?: string | Date) =>
  value
    ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(value))
    : '—';

export function StatusBadge({ value }: { value?: string }) {
  const normalized = value?.toUpperCase() || 'UNKNOWN';
  const styles: Record<string, string> = {
    ACTIVE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    SUCCESS: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    TRIAL: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    PENDING: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    FAILED: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    SUSPENDED: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    CANCELLED: 'bg-slate-700/40 text-slate-300 border-slate-600/40',
    ROLLED_BACK: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  };

  const currentStyle = styles[normalized] || 'bg-slate-800 text-slate-400 border-slate-700';

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${currentStyle}`}
    >
      <span className="size-1.5 rounded-full bg-current opacity-75" />
      {normalized.replaceAll('_', ' ')}
    </span>
  );
}

export function StatCard({
  label,
  value,
  icon,
  detail,
  iconColor = 'emerald',
}: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  detail?: string;
  iconColor?: 'emerald' | 'amber' | 'cyan' | 'indigo' | 'rose' | 'teal';
}) {
  const colorMap = {
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    cyan: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    rose: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    teal: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-800/90 bg-[#0e1629] p-5 shadow-sm transition hover:border-slate-700">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-extrabold tracking-tight text-white">{value}</p>
        </div>
        <div
          className={`grid size-11 shrink-0 place-items-center rounded-xl border ${colorMap[iconColor]}`}
        >
          {icon}
        </div>
      </div>
      {detail && <p className="mt-3 text-xs text-slate-400">{detail}</p>}
    </div>
  );
}

export function QueryState({
  loading,
  error,
  children,
}: {
  loading: boolean;
  error?: unknown;
  children: ReactNode;
}) {
  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center rounded-2xl border border-slate-800 bg-[#0e1629] p-8">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="animate-spin text-emerald-400" size={32} />
          <p className="text-sm font-medium text-slate-400">Loading data…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-900/50 bg-rose-950/20 p-6 text-sm text-rose-300">
        <p className="font-semibold text-rose-200">Failed to load platform data</p>
        <p className="mt-1 text-xs text-rose-400">
          Check that the backend API service is running, or verify your network connection.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

export type InvoiceItem = {
  description: string;
  amount: number;
  quantity?: number;
};

export type InvoiceRecord = {
  invoiceNumber: string;
  date: string | Date;
  status: string;
  organization?: {
    name?: string;
    billingEmail?: string;
  };
  currency: string;
  amount: number;
  paymentIntentId?: string;
  planName?: string;
  billingInterval?: string;
  lineItems?: InvoiceItem[];
};

export const downloadInvoiceJson = (data: InvoiceRecord) => {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${data.invoiceNumber || 'invoice'}.json`;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 1000);
};

export const downloadInvoiceHtml = (data: InvoiceRecord) => {
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Invoice ${data.invoiceNumber}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 40px; color: #0f172a; background: #fff; }
    .invoice-card { max-width: 650px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; }
    .title { font-size: 24px; font-weight: 800; color: #10b981; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 700; background: #ecfdf5; color: #047857; margin-top: 4px; }
    .details { display: flex; justify-content: space-between; margin-top: 24px; font-size: 13px; line-height: 1.6; }
    .details-box { background: #f8fafc; padding: 16px; border-radius: 8px; width: 46%; }
    .label { font-size: 11px; text-transform: uppercase; font-weight: 700; color: #64748b; margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 28px; font-size: 13px; }
    th { text-align: left; padding: 12px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; color: #475569; font-weight: 600; text-transform: uppercase; font-size: 11px; }
    td { padding: 12px; border-bottom: 1px solid #f1f5f9; }
    .total-box { margin-top: 24px; background: #0f172a; color: #fff; padding: 16px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; font-size: 16px; font-weight: 800; }
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
        <div style="font-weight: 800; font-size: 16px; color: #0f172a;">Octopi SaaS Platform</div>
        <div style="font-size: 12px; color: #64748b; margin-top: 2px;">Billing & Subscriptions</div>
        <div style="font-size: 12px; color: #64748b;">${formatDate(data.date)}</div>
      </div>
    </div>
    <div class="details">
      <div class="details-box">
        <div class="label">Billed To</div>
        <div style="font-weight: 700; color: #0f172a;">${data.organization?.name || 'Customer'}</div>
        <div>${data.organization?.billingEmail || ''}</div>
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
        ).map((item: InvoiceItem) => `
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
      <span style="color: #10b981;">${formatCurrency(data.amount, data.currency)}</span>
    </div>
    <div class="footer">
      Verified Tax Invoice & Payment Receipt · Octopi Digital Multi-Tenant SaaS
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
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 1000);
};

export function InvoiceModal({
  invoiceId,
  invoiceData,
  loading,
  onClose,
}: {
  invoiceId: string | null;
  invoiceData: InvoiceRecord | null;
  loading: boolean;
  onClose: () => void;
}) {
  if (!invoiceId) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-800 bg-[#0e1629] p-6 text-slate-100 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <div className="grid size-9 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <ReceiptText size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Payment Invoice</h3>
              <p className="text-xs text-slate-400">Electronic verification & tax record</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition"
          >
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="py-12 flex items-center justify-center text-slate-400 text-sm">
            <Loader2 className="animate-spin text-emerald-400 mr-2" size={18} /> Fetching invoice details...
          </div>
        ) : invoiceData ? (
          <div id="printable-invoice" className="space-y-5 text-sm">
            <div className="flex justify-between items-start bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
              <div>
                <p className="text-xs uppercase font-semibold text-slate-400">Invoice Number</p>
                <p className="font-mono font-bold text-white text-sm mt-0.5">
                  {invoiceData.invoiceNumber}
                </p>
                <p className="text-xs text-slate-400 mt-1">{formatDate(invoiceData.date)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase font-semibold text-slate-400">Billed To</p>
                <p className="font-bold text-white text-sm mt-0.5">
                  {invoiceData.organization?.name || 'Customer'}
                </p>
                <p className="text-xs text-slate-400">{invoiceData.organization?.billingEmail || ''}</p>
              </div>
            </div>

            <div className="border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase">
                  <tr>
                    <th className="p-3">Description</th>
                    <th className="p-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {(invoiceData.lineItems && invoiceData.lineItems.length > 0
                    ? invoiceData.lineItems
                    : [
                        {
                          description: `${invoiceData.planName || 'Subscription Plan'} (${invoiceData.billingInterval || 'MONTHLY'})`,
                          amount: invoiceData.amount,
                          quantity: 1,
                        },
                      ]
                  ).map((li: InvoiceItem, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-800/40">
                      <td className="p-3 font-medium text-slate-200">{li.description}</td>
                      <td className="p-3 text-right font-semibold text-white">
                        {formatCurrency(li.amount, invoiceData.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs bg-slate-900/60 border border-slate-800 p-3 rounded-xl text-slate-300">
              <div>
                <span className="text-slate-400">Status: </span>
                <span className="font-bold text-emerald-400">{invoiceData.status}</span>
              </div>
              {invoiceData.paymentIntentId && (
                <div className="text-right truncate">
                  <span className="text-slate-400">Ref: </span>
                  <span className="font-mono text-[11px] text-slate-300">
                    {invoiceData.paymentIntentId}
                  </span>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <span className="font-bold text-white">Total Paid</span>
              <span className="text-lg font-black text-emerald-400">
                {formatCurrency(invoiceData.amount, invoiceData.currency)}
              </span>
            </div>

            <div className="no-print pt-2 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => downloadInvoiceHtml(invoiceData)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition shadow-sm"
              >
                <Download size={13} /> Download Invoice
              </button>
              <button
                type="button"
                onClick={() => downloadInvoiceJson(invoiceData)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition"
              >
                <Download size={13} /> JSON
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition"
              >
                <Printer size={13} /> Print / PDF
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-xs font-bold text-slate-950 transition"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <div className="py-6 text-center text-sm text-rose-400">
            Could not load invoice data.
          </div>
        )}
      </div>
    </div>
  );
}
