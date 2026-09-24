'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Users, UserPlus, Trash2, Shield, X, Mail } from 'lucide-react';
import api from '@/lib/api';
import { DashboardHeader } from '@/components/DashboardHeader';
import { QueryState, StatusBadge, formatDate } from '@/components/dashboard-ui';

type Member = {
  _id: string;
  name: string;
  email: string;
  role: 'ORGANIZATION_ADMIN' | 'ORGANIZATION_MEMBER';
  status: string;
  createdAt: string;
};

export default function OrgAdminMembersPage() {
  const queryClient = useQueryClient();
  const [invite, setInvite] = useState({ email: '', role: 'ORGANIZATION_MEMBER' });
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const members = useQuery({
    queryKey: ['members-list-page'],
    queryFn: async () => (await api.get<{ members: Member[] }>('/members')).data.members,
  });

  const inviteMember = useMutation({
    mutationFn: () => api.post('/members/invite', invite),
    onSuccess: () => {
      setInvite({ email: '', role: 'ORGANIZATION_MEMBER' });
      setShowInviteModal(false);
      queryClient.invalidateQueries({ queryKey: ['members-list-page'] });
      setNotice({ type: 'success', message: 'Invitation sent successfully.' });
    },
    onError: (error: any) => {
      setNotice({
        type: 'error',
        message: error?.response?.data?.error || 'Failed to send invitation.',
      });
    },
  });

  const updateMemberRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      api.put(`/members/${id}/role`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members-list-page'] });
      setNotice({ type: 'success', message: 'Member role updated.' });
    },
    onError: (error: any) => {
      setNotice({
        type: 'error',
        message: error?.response?.data?.error || 'Failed to update member role.',
      });
    },
  });

  const removeMember = useMutation({
    mutationFn: (id: string) => api.delete(`/members/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members-list-page'] });
      setNotice({ type: 'success', message: 'Member removed from organization.' });
    },
    onError: (error: any) => {
      setNotice({
        type: 'error',
        message: error?.response?.data?.error || 'Failed to remove member.',
      });
    },
  });

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Team Members"
        subtitle="Manage seats, send email invitations to colleagues, and assign administrative permissions."
        badge={
          <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs font-bold text-emerald-400">
            {members.data?.length ?? 0} Seats Active
          </span>
        }
        actions={
          <button
            type="button"
            onClick={() => setShowInviteModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-bold shadow-lg shadow-emerald-500/20 transition active:scale-95"
          >
            <UserPlus size={16} />
            <span>Invite Member</span>
          </button>
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

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-[#0e1629] p-6 text-slate-100 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="grid size-8 place-items-center rounded-lg bg-emerald-500/10 text-emerald-400">
                  <UserPlus size={16} />
                </div>
                <h3 className="text-base font-bold text-white">Invite Team Member</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                inviteMember.mutate();
              }}
              className="space-y-4"
            >
              <div>
                <label className="text-xs font-semibold text-slate-300 uppercase">
                  Email Address
                </label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3.5 top-3 text-slate-500" size={15} />
                  <input
                    required
                    type="email"
                    placeholder="colleague@company.com"
                    value={invite.email}
                    onChange={(e) => setInvite({ ...invite, email: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900/80 py-2.5 pl-9 pr-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 uppercase">
                  Role Assignment
                </label>
                <select
                  value={invite.role}
                  onChange={(e) => setInvite({ ...invite, role: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="ORGANIZATION_MEMBER">Member (Standard Workspace Access)</option>
                  <option value="ORGANIZATION_ADMIN">Admin (Billing & User Management)</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviteMember.isPending}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-xs font-bold text-slate-950 transition disabled:opacity-50"
                >
                  {inviteMember.isPending ? 'Sending...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Members Table */}
      <section className="rounded-2xl border border-slate-800 bg-[#0e1629] p-6 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2.5 pb-4 border-b border-slate-800 mb-5">
          <div className="grid size-9 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400">
            <Users size={18} />
          </div>
          <div>
            <h2 className="font-bold text-white text-base">Active Roster</h2>
            <p className="text-xs text-slate-400">Members with verified or pending credentials.</p>
          </div>
        </div>

        <QueryState loading={members.isLoading} error={members.error}>
          {!members.data?.length ? (
            <div className="p-12 text-center text-slate-500 text-sm">
              No team members found. Invite your first colleague using the button above.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="px-5 py-3.5">Name</th>
                    <th className="px-5 py-3.5">Email</th>
                    <th className="px-5 py-3.5">Role</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Joined</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {members.data.map((member) => (
                    <tr key={member._id} className="hover:bg-slate-800/40 transition">
                      <td className="px-5 py-4 font-bold text-white">
                        {member.name || 'Invited User'}
                      </td>
                      <td className="px-5 py-4 text-slate-300 font-mono text-xs">
                        {member.email}
                      </td>
                      <td className="px-5 py-4">
                        <select
                          value={member.role}
                          onChange={(e) =>
                            updateMemberRole.mutate({ id: member._id, role: e.target.value })
                          }
                          className="rounded-lg border border-slate-700 bg-slate-900/90 px-2.5 py-1 text-xs text-emerald-400 font-semibold focus:outline-none focus:border-emerald-500"
                        >
                          <option value="ORGANIZATION_ADMIN">Admin</option>
                          <option value="ORGANIZATION_MEMBER">Member</option>
                        </select>
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge value={member.status} />
                      </td>
                      <td className="px-5 py-4 text-slate-400 text-xs">
                        {formatDate(member.createdAt)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Remove ${member.name || member.email} from the workspace?`)) {
                              removeMember.mutate(member._id);
                            }
                          }}
                          disabled={removeMember.isPending}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                          title="Remove member"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </QueryState>
      </section>
    </div>
  );
}
