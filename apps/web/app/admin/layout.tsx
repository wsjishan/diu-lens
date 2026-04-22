'use client';

import { ReactNode } from 'react';
import { AdminAuthProvider } from '@/features/admin/auth/AdminAuthContext';
import { AdminToastProvider } from '@/features/admin/ui/AdminToastProvider';

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return (
    <AdminAuthProvider>
      <AdminToastProvider>{children}</AdminToastProvider>
    </AdminAuthProvider>
  );
}
