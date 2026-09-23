import type { ReactNode } from 'react';
import { LogOut } from 'lucide-react';

export const formatCurrency = (amount?: number, currency = 'USD') => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency,
  maximumFractionDigits: 2,
}).format(amount ?? 0);

export const formatDate = (value?: string | Date) => value
  ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(value))
  : '—';

export function StatusBadge({ value }: { value?: string }) {
  const normalized = value?.toUpperCase() || 'UNKNOWN';
  const colors: Record<string, string> = {
    ACTIVE: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    SUCCESS: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    TRIAL: 'bg-blue-50 text-blue-700 ring-blue-600/20',
    PENDING: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    FAILED: 'bg-rose-50 text-rose-700 ring-rose-600/20',
    SUSPENDED: 'bg-rose-50 text-rose-700 ring-rose-600/20',
    CANCELLED: 'bg-slate-100 text-slate-700 ring-slate-500/20',
    ROLLED_BACK: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${colors[normalized] || 'bg-slate-100 text-slate-700 ring-slate-500/20'}`}>{normalized.replaceAll('_', ' ')}</span>;
}

export function StatCard({ label, value, icon, detail }: { label: string; value: ReactNode; icon: ReactNode; detail?: string }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{value}</p></div>
      <div className="rounded-xl bg-indigo-50 p-3 text-indigo-600">{icon}</div>
    </div>
    {detail && <p className="mt-3 text-xs text-slate-500">{detail}</p>}
  </section>;
}

export function QueryState({ loading, error, children }: { loading: boolean; error?: unknown; children: ReactNode }) {
  if (loading) return <div className="grid min-h-64 place-items-center rounded-2xl border border-slate-200 bg-white"><p className="text-sm font-medium text-slate-500">Loading dashboard data…</p></div>;
  if (error) return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">We could not load this data. Check that the API is running, then refresh the page.</div>;
  return <>{children}</>;
}

export function DashboardShell({ title, subtitle, email, onLogout, children }: { title: string; subtitle: string; email: string; onLogout: () => void; children: ReactNode }) {
  return <div className="min-h-screen bg-slate-50 text-slate-900">
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-600 text-lg font-black text-white">O</div><div className="min-w-0"><p className="truncate text-base font-bold tracking-tight text-slate-950">Octopi Digital</p><p className="truncate text-xs font-medium text-slate-500">{title}</p></div></div>
        <div className="flex items-center gap-2"><p className="hidden max-w-56 truncate text-sm text-slate-600 sm:block">{email}</p><button onClick={onLogout} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"><LogOut size={16} /> <span className="hidden sm:inline">Sign out</span></button></div>
      </div>
    </header>
    <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8"><div className="mb-7"><h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{title}</h1><p className="mt-1 text-sm text-slate-600">{subtitle}</p></div>{children}</main>
  </div>;
}
