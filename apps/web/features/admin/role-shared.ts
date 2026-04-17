import { AdminRole } from '@/features/admin/types';

export const ADMIN_ROLE_COOKIE = 'diu_lens_admin_role';

export function isAdminRole(role: string | null | undefined): role is AdminRole {
  return role === 'normal' || role === 'super';
}
