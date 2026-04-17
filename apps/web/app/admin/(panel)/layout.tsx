import { ReactNode } from 'react';
import { AdminPanelShell } from '@/features/admin/AdminPanelShell';
import { getMockRoleFromCookies } from '@/features/admin/role';

export default async function AdminPanelLayout({
  children,
}: {
  children: ReactNode;
}) {
  const role = await getMockRoleFromCookies();

  return <AdminPanelShell role={role}>{children}</AdminPanelShell>;
}
