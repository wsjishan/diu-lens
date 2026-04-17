import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AdminAccessDenied } from '@/features/admin/AdminAccessDenied';
import { mockAdmins } from '@/features/admin/mock-data';
import { getMockRoleFromCookies } from '@/features/admin/role';

const statusStyles: Record<string, string> = {
  Active: 'border-emerald-300/35 bg-emerald-500/15 text-emerald-100',
  Pending: 'border-amber-300/35 bg-amber-500/15 text-amber-100',
  Disabled: 'border-rose-300/35 bg-rose-500/15 text-rose-100',
};

export default async function AdminManagementPage() {
  const role = await getMockRoleFromCookies();

  if (role !== 'super') {
    return <AdminAccessDenied />;
  }

  return (
    <Card className="border-border bg-card text-foreground">
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle className="text-foreground">Manage Admin Accounts</CardTitle>
          <CardDescription className="text-muted-foreground">
            Mock directory of admins with role and status controls.
          </CardDescription>
        </div>
        <Button>Add Admin</Button>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="px-2 py-2">Name</th>
              <th className="px-2 py-2">Email</th>
              <th className="px-2 py-2">Role</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Last Login</th>
              <th className="px-2 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {mockAdmins.map((admin) => (
              <tr key={admin.id} className="border-b border-border/50 text-foreground">
                <td className="px-2 py-3 font-medium">{admin.name}</td>
                <td className="px-2 py-3 text-muted-foreground">{admin.email}</td>
                <td className="px-2 py-3">{admin.role}</td>
                <td className="px-2 py-3">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs ${statusStyles[admin.status]}`}
                  >
                    {admin.status}
                  </span>
                </td>
                <td className="px-2 py-3 text-muted-foreground">{admin.lastLogin}</td>
                <td className="px-2 py-3">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="xs"
                      variant="outline"
                      className="border-border bg-transparent text-foreground hover:bg-muted"
                    >
                      Edit
                    </Button>
                    <Button size="xs" variant="destructive">
                      Disable/Remove
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
