'use client';

import { ReactNode, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { AdminPanelShell } from '@/features/admin/AdminPanelShell';
import { useAdminAuth } from '@/features/admin/auth/AdminAuthContext';

export default function AdminPanelLayout({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { status } = useAdminAuth();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [status, router, pathname]);

  if (status === 'loading') {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Restoring admin session...
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return null;
  }

  return <AdminPanelShell>{children}</AdminPanelShell>;
}
