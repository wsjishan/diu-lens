import 'server-only';
import { cookies } from 'next/headers';
import { AdminRole } from '@/features/admin/types';
import { ADMIN_ROLE_COOKIE, isAdminRole } from '@/features/admin/role-shared';

export async function getMockRoleFromCookies(): Promise<AdminRole> {
  const cookieStore = await cookies();
  const roleCookie = cookieStore.get(ADMIN_ROLE_COOKIE)?.value;

  return isAdminRole(roleCookie) ? roleCookie : 'normal';
}
