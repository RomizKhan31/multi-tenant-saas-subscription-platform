'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Building2, User, KeyRound, ArrowRight, ShieldCheck } from 'lucide-react';
import api from '@/lib/api';
import { DashboardHeader } from '@/components/DashboardHeader';
import { StatCard, QueryState } from '@/components/dashboard-ui';

type Organization = { name: string; status: string; createdAt: string };
type Plan = { name: string; billingInterval: string };

export default function OrgMemberDashboardPage() {
  const organization = useQuery({
    queryKey: ['org-member-overview-data'],
    queryFn: async () => (await api.get<Organization>('/organizations/current')).data,
  });

  const plan = useQuery({
    queryKey: ['org-member-plan-data'],
    queryFn: async () => (await api.get<Plan>('/subscriptions/current-plan')).data,
    retry: false,
  });

  return (
    <div className="space-y-8">
      <DashboardHeader
        title="Member Workspace"
        subtitle="Welcome to your organization's digital portal."
      />

      <QueryState loading={organization.isLoading} error={organization.error && !plan.error}>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Organization"
            value={organization.data?.name || 'Workspace'}
            detail="Current affiliated tenant"
            icon={<Building2 size={20} />}
            iconColor="indigo"
          />
          <StatCard
            label="Workspace Plan"
            value={plan.data?.name || 'Standard Tier'}
            detail={plan.data ? `Billed ${plan.data.billingInterval.toLowerCase()}` : 'Active organization license'}
            icon={<ShieldCheck size={20} />}
            iconColor="cyan"
          />
          <StatCard
            label="Account Role"
            value="Member"
            detail="Standard collaborative access"
            icon={<User size={20} />}
            iconColor="teal"
          />
        </div>

        {/* Quick actions grid */}
        <div className="grid gap-6 md:grid-cols-3">
          <Link
            href="/org-member/organization"
            className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:border-slate-300 hover:shadow-md transition flex flex-col justify-between"
          >
            <div>
              <div className="grid size-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100 transition">
                <Building2 size={20} />
              </div>
              <h3 className="font-bold text-slate-900 text-base mt-4">Organization Profile</h3>
              <p className="text-xs text-slate-500 mt-1">
                View public details and verified membership status for {organization.data?.name || 'your workspace'}.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-1.5 text-xs font-bold text-indigo-600">
              <span>View details</span>
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          <Link
            href="/org-member/profile"
            className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:border-slate-300 hover:shadow-md transition flex flex-col justify-between"
          >
            <div>
              <div className="grid size-10 place-items-center rounded-xl bg-sky-50 text-sky-600 group-hover:bg-sky-100 transition">
                <User size={20} />
              </div>
              <h3 className="font-bold text-slate-900 text-base mt-4">Personal Profile</h3>
              <p className="text-xs text-slate-500 mt-1">
                Keep your display name and email address up-to-date.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-1.5 text-xs font-bold text-sky-600">
              <span>Edit profile</span>
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          <Link
            href="/org-member/security"
            className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:border-slate-300 hover:shadow-md transition flex flex-col justify-between"
          >
            <div>
              <div className="grid size-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100 transition">
                <KeyRound size={20} />
              </div>
              <h3 className="font-bold text-slate-900 text-base mt-4">Password & Security</h3>
              <p className="text-xs text-slate-500 mt-1">
                Update your account password and review login credentials.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-1.5 text-xs font-bold text-indigo-600">
              <span>Manage password</span>
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>
      </QueryState>
    </div>
  );
}
