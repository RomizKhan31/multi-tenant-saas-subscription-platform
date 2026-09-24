'use client';

import { useState, useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ChevronRight,
  LogOut,
  Menu,
  X,
  LucideIcon,
  Layers,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string | number;
}

interface DashboardLayoutProps {
  navItems: NavItem[];
  brandTitle?: string;
  brandBadge?: string;
  requiredRole?: 'PLATFORM_ADMIN' | 'ORGANIZATION_ADMIN' | 'ORGANIZATION_MEMBER';
  children: ReactNode;
}

export function DashboardLayout({
  navItems,
  brandTitle = 'Octopi SaaS',
  brandBadge = 'ENG',
  requiredRole,
  children,
}: DashboardLayoutProps) {
  const { user, logout, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isUnauthorized = !loading && (!user || Boolean(requiredRole && user.role !== requiredRole));

  useEffect(() => {
    if (isUnauthorized) {
      router.replace('/login');
    }
  }, [isUnauthorized, router]);

  if (loading || isUnauthorized) {
    return (
      <div className="min-h-screen bg-[#070b14] flex flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-emerald-400" size={32} />
        <p className="text-xs text-slate-400">Verifying credentials...</p>
      </div>
    );
  }

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  const isLinkActive = (href: string) => {
    if (href === '/platform-admin' || href === '/org-admin' || href === '/org-member') {
      return pathname === href;
    }
    return pathname === href || pathname.startsWith(href + '/');
  };

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'R';
  const roleDisplay =
    user?.role === 'PLATFORM_ADMIN'
      ? 'Owner'
      : user?.role === 'ORGANIZATION_ADMIN'
      ? 'Org Admin'
      : 'Member';

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between p-4">
      {/* Brand Header */}
      <div>
        <div className="flex items-center justify-between pb-6 pt-2 px-2 border-b border-slate-800/80">
          <Link href={navItems[0]?.href || '/'} className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-slate-950 font-black shadow-lg shadow-emerald-500/20">
              <Layers size={20} />
            </div>
            <span className="font-bold tracking-tight text-white text-base truncate max-w-[130px]">
              {brandTitle}
            </span>
          </Link>

          <div className="flex items-center gap-1.5 rounded-full border border-slate-700/80 bg-slate-800/60 px-2.5 py-1 text-[11px] font-semibold text-slate-300">
            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>{brandBadge}</span>
          </div>
        </div>

        {/* Navigation List */}
        <nav className="mt-5 space-y-1.5">
          {navItems.map((item) => {
            const active = isLinkActive(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? 'bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 shadow-sm shadow-emerald-500/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon
                    size={18}
                    className={
                      active
                        ? 'text-emerald-400'
                        : 'text-slate-400 group-hover:text-slate-200 transition-colors'
                    }
                  />
                  <span className="truncate">{item.label}</span>
                </div>

                <div className="flex items-center gap-2">
                  {item.badge !== undefined && (
                    <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-bold text-emerald-400">
                      {item.badge}
                    </span>
                  )}
                  {active && <ChevronRight size={15} className="text-emerald-400" />}
                </div>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User Card & Sign Out at bottom */}
      <div className="pt-4 border-t border-slate-800/80">
        <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-900/60 border border-slate-800/60">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-950 border border-emerald-500/40 text-emerald-400 font-bold text-sm">
            {userInitial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-slate-100 text-sm truncate">
              {user?.name || 'Romiz'}
            </p>
            <p className="text-xs text-slate-400 truncate">{roleDisplay}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="mt-3 flex w-full items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition"
        >
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col lg:flex-row font-sans selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:flex w-64 xl:w-72 shrink-0 flex-col border-r border-slate-800/80 bg-[#0d1527] sticky top-0 h-screen overflow-y-auto">
        {sidebarContent}
      </aside>

      {/* Mobile Topbar */}
      <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-[#0d1527] border-b border-slate-800/80 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open navigation menu"
            className="p-2 rounded-xl text-slate-300 hover:bg-slate-800 hover:text-white transition"
          >
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2">
            <div className="grid size-7 place-items-center rounded-lg bg-emerald-500 text-slate-950 font-black">
              <Layers size={16} />
            </div>
            <span className="font-bold text-white text-base">{brandTitle}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="grid size-8 place-items-center rounded-lg bg-emerald-950 border border-emerald-500/40 text-emerald-400 font-bold text-xs">
            {userInitial}
          </div>
        </div>
      </header>

      {/* Mobile Sliding Drawer & Backdrop */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] bg-[#0d1527] border-r border-slate-800 flex flex-col h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            <div className="absolute right-3 top-4">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X size={20} />
              </button>
            </div>
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 xl:p-10 relative">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
