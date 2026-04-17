'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  LogOut,
  Search,
  Shield,
  ShieldCheck,
  UserCircle2,
  Users,
} from 'lucide-react';
import { ReactNode } from 'react';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ADMIN_ROLE_COOKIE } from '@/features/admin/role-shared';
import { AdminRole } from '@/features/admin/types';

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
};

const normalNav: NavItem[] = [
  {
    href: '/admin/search',
    label: 'Search',
    icon: <Search className="size-4" />,
  },
  {
    href: '/admin/results',
    label: 'Results',
    icon: <ShieldCheck className="size-4" />,
  },
];

const superNav: NavItem[] = [
  {
    href: '/admin/dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboard className="size-4" />,
  },
  ...normalNav,
  {
    href: '/admin/admins',
    label: 'Admins',
    icon: <Users className="size-4" />,
  },
  {
    href: '/admin/logs',
    label: 'Logs',
    icon: <Shield className="size-4" />,
  },
];

const titleMap: Record<string, string> = {
  '/admin/dashboard': 'Admin Dashboard',
  '/admin/search': 'Face Search Workspace',
  '/admin/results': 'Match Results',
  '/admin/admins': 'Admin Management',
  '/admin/logs': 'Activity Logs',
};

type AdminPanelShellProps = {
  children: ReactNode;
  role: AdminRole;
};

export function AdminPanelShell({ children, role }: AdminPanelShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const navItems = role === 'super' ? superNav : normalNav;

  const pageTitle = pathname.startsWith('/admin/match/')
    ? 'Match Details'
    : titleMap[pathname] ?? 'Admin Panel';

  const handleLogout = () => {
    document.cookie = `${ADMIN_ROLE_COOKIE}=; Max-Age=0; path=/`;
    router.push('/admin/login');
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px]">
        <aside className="hidden w-72 shrink-0 border-r border-border/70 bg-card/80 p-6 backdrop-blur-xl lg:flex lg:flex-col lg:gap-8">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-primary/80">
              DIU Lens
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              Admin Console
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Secure matching workspace for operations teams.
            </p>
          </div>

          <nav className="space-y-2">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href === '/admin/results' && pathname.startsWith('/admin/match/'));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors',
                    isActive
                      ? 'border-primary/30 bg-primary/12 text-primary'
                      : 'border-transparent text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground'
                  )}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto rounded-xl border border-border/70 bg-muted/40 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Demo Role</p>
            <p className="mt-1">{role === 'super' ? 'Super Admin' : 'Normal Admin'}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              UI-only mode with mock role permissions.
            </p>
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-border/70 bg-card/85 px-4 py-3 backdrop-blur-xl sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-primary/75">
                  Administration
                </p>
                <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                  {pageTitle}
                </h1>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <ThemeToggle />
                <span className="hidden items-center gap-1 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground sm:inline-flex">
                  <UserCircle2 className="size-3.5" />
                  Admin User
                </span>
                <span className="rounded-full border border-primary/30 bg-primary/12 px-2.5 py-1 text-xs font-medium text-primary">
                  {role === 'super' ? 'Super Admin' : 'Normal Admin'}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-border bg-background/10 text-foreground hover:bg-muted hover:text-foreground"
                  onClick={handleLogout}
                >
                  <LogOut className="size-3.5" />
                  Logout
                </Button>
              </div>
            </div>

            <div className="mt-3 flex gap-2 overflow-x-auto pb-0.5 lg:hidden">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'inline-flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs',
                      isActive
                        ? 'border-primary/30 bg-primary/12 text-primary'
                        : 'border-border bg-muted/35 text-muted-foreground'
                    )}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </header>

          <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
