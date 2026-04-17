import { AdminAccessDenied } from '@/features/admin/AdminAccessDenied';
import { LogsView } from '@/features/admin/LogsView';
import { getMockRoleFromCookies } from '@/features/admin/role';

export default async function AdminLogsPage() {
  const role = await getMockRoleFromCookies();

  if (role !== 'super') {
    return <AdminAccessDenied />;
  }

  return <LogsView />;
}
