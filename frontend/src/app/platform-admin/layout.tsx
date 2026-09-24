'use client';

import type { ReactNode } from 'react';
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Layers,
  ReceiptText,
  BarChart3,
  Settings,
} from 'lucide-react';
import { DashboardLayout, type NavItem } from '@/components/DashboardLayout';

const platformAdminNavItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/platform-admin',
    icon: LayoutDashboard,
  },
  {
    label: 'Organizations',
    href: '/platform-admin/organizations',
    icon: Building2,
  },
  {
    label: 'Plans',
    href: '/platform-admin/plans',
    icon: CreditCard,
  },
  {
    label: 'Subscriptions',
    href: '/platform-admin/subscriptions',
    icon: Layers,
  },
  {
    label: 'Transactions',
    href: '/platform-admin/transactions',
    icon: ReceiptText,
  },
  {
    label: 'Reports',
    href: '/platform-admin/reports',
    icon: BarChart3,
  },
  {
    label: 'Settings',
    href: '/platform-admin/settings',
    icon: Settings,
  },
];

export default function PlatformAdminRootLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardLayout
      navItems={platformAdminNavItems}
      brandTitle="Octopi SaaS"
      brandBadge="Owner"
      requiredRole="PLATFORM_ADMIN"
    >
      {children}
    </DashboardLayout>
  );
}
