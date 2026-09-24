'use client';

import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  ReceiptText,
  BarChart3,
  Settings,
} from 'lucide-react';
import api from '@/lib/api';
import { DashboardLayout, type NavItem } from '@/components/DashboardLayout';

const orgAdminNavItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/org-admin',
    icon: LayoutDashboard,
  },
  {
    label: 'Team Members',
    href: '/org-admin/members',
    icon: Users,
  },
  {
    label: 'Plans & Billing',
    href: '/org-admin/plans',
    icon: CreditCard,
  },
  {
    label: 'Invoices & History',
    href: '/org-admin/transactions',
    icon: ReceiptText,
  },
  {
    label: 'Usage Reports',
    href: '/org-admin/reports',
    icon: BarChart3,
  },
  {
    label: 'Org Settings',
    href: '/org-admin/settings',
    icon: Settings,
  },
];

export default function OrgAdminRootLayout({ children }: { children: ReactNode }) {
  const organization = useQuery({
    queryKey: ['current-org-header'],
    queryFn: async () => (await api.get<{ name: string }>('/organizations/current')).data,
  });

  return (
    <DashboardLayout
      navItems={orgAdminNavItems}
      brandTitle={organization.data?.name || 'Workspace'}
      brandBadge="Admin"
      requiredRole="ORGANIZATION_ADMIN"
    >
      {children}
    </DashboardLayout>
  );
}
