'use client';

import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Building2,
  User,
  KeyRound,
} from 'lucide-react';
import api from '@/lib/api';
import { DashboardLayout, type NavItem } from '@/components/DashboardLayout';

const orgMemberNavItems: NavItem[] = [
  {
    label: 'Workspace',
    href: '/org-member',
    icon: LayoutDashboard,
  },
  {
    label: 'Organization',
    href: '/org-member/organization',
    icon: Building2,
  },
  {
    label: 'My Profile',
    href: '/org-member/profile',
    icon: User,
  },
  {
    label: 'Security',
    href: '/org-member/security',
    icon: KeyRound,
  },
];

export default function OrgMemberRootLayout({ children }: { children: ReactNode }) {
  const organization = useQuery({
    queryKey: ['member-org-header'],
    queryFn: async () => (await api.get<{ name: string }>('/organizations/current')).data,
  });

  return (
    <DashboardLayout
      navItems={orgMemberNavItems}
      brandTitle={organization.data?.name || 'Workspace'}
      brandBadge="Member"
      requiredRole="ORGANIZATION_MEMBER"
    >
      {children}
    </DashboardLayout>
  );
}
