'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Users, DollarSign, Calendar } from 'lucide-react';
import api from '@/lib/api';
import { DashboardHeader } from '@/components/DashboardHeader';
import { StatCard, QueryState, formatCurrency } from '@/components/dashboard-ui';

type Member = { _id: string; role: string };
type Transaction = { _id: string; amount: number; status: string };

export default function OrgAdminReportsPage() {
  const members = useQuery({
    queryKey: ['members-rep'],
    queryFn: async () => (await api.get<{ members: Member[] }>('/members')).data.members,
  });

  const transactions = useQuery({
    queryKey: ['tx-rep'],
    queryFn: async () =>
      (await api.get<{ transactions: Transaction[] }>('/transactions')).data.transactions,
  });

  const analytics = useMemo(() => {
    const memList = members.data || [];
    const txList = transactions.data || [];

    const totalSpend = txList
      .filter((t) => t.status === 'SUCCESS')
      .reduce((sum, t) => sum + t.amount, 0);

    const admins = memList.filter((m) => m.role === 'ORGANIZATION_ADMIN').length;
    const standardMembers = memList.filter((m) => m.role === 'ORGANIZATION_MEMBER').length;

    return {
      totalSpend,
      totalSeats: memList.length,
      admins,
      standardMembers,
      invoiceCount: txList.length,
    };
  }, [members.data, transactions.data]);

  return (
    <div className="space-y-8">
      <DashboardHeader
        title="Workspace Usage & Spend"
        subtitle="Historical financial expenditures, seat allocations, and workspace utilization telemetry."
      />

      <QueryState
        loading={members.isLoading || transactions.isLoading}
        error={members.error || transactions.error}
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Spent"
            value={formatCurrency(analytics.totalSpend)}
            detail="Lifetime successful charges"
            icon={<DollarSign size={20} />}
            iconColor="emerald"
          />
          <StatCard
            label="Active Seats"
            value={analytics.totalSeats}
            detail="Team members enrolled"
            icon={<Users size={20} />}
            iconColor="cyan"
          />
          <StatCard
            label="Workspace Admins"
            value={analytics.admins}
            detail="Accounts with billing permissions"
            icon={<BarChart3 size={20} />}
            iconColor="indigo"
          />
          <StatCard
            label="Standard Members"
            value={analytics.standardMembers}
            detail="Member-tier seats"
            icon={<Calendar size={20} />}
            iconColor="teal"
          />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 mb-5">
            <div className="grid size-9 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
              <BarChart3 size={18} />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-base">Seat Allocation Breakdown</h2>
              <p className="text-xs text-slate-500">Distribution of permissions within this organization.</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50/60">
              <span className="text-xs font-semibold text-slate-700">Administrators</span>
              <span className="font-bold text-indigo-600 text-sm">{analytics.admins}</span>
            </div>
            <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50/60">
              <span className="text-xs font-semibold text-slate-700">Regular Members</span>
              <span className="font-bold text-slate-900 text-sm">{analytics.standardMembers}</span>
            </div>
          </div>
        </div>
      </QueryState>
    </div>
  );
}
