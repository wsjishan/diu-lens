import Link from 'next/link';
import { ArrowRight, CircleCheckBig } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AdminAccessDenied } from '@/features/admin/AdminAccessDenied';
import { dashboardStats, quickActions, recentActivity } from '@/features/admin/mock-data';
import { getMockRoleFromCookies } from '@/features/admin/role';

const statusStyles: Record<string, string> = {
  match_found: 'border-emerald-300/30 bg-emerald-500/20 text-emerald-100',
  review_needed: 'border-amber-300/30 bg-amber-500/20 text-amber-100',
  no_match: 'border-rose-300/30 bg-rose-500/20 text-rose-100',
};

export default async function AdminDashboardPage() {
  const role = await getMockRoleFromCookies();

  if (role !== 'super') {
    return <AdminAccessDenied />;
  }

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {dashboardStats.map((stat) => (
          <Card key={stat.label} className="border-border bg-card text-foreground">
            <CardHeader>
              <CardDescription className="text-muted-foreground">{stat.label}</CardDescription>
              <CardTitle className="text-3xl font-semibold tracking-tight text-foreground">
                {stat.value}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{stat.hint}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card className="border-border bg-card text-foreground">
          <CardHeader>
            <CardTitle className="text-foreground">Recent Search Activity</CardTitle>
            <CardDescription className="text-muted-foreground">
              Latest actions performed in the identification workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentActivity.map((activity) => (
              <article
                key={activity.id}
                className="rounded-xl border border-border bg-muted/35 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-medium text-foreground">{activity.action}</h3>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-wide ${statusStyles[activity.status]}`}
                  >
                    {activity.status.replace('_', ' ')}
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{activity.summary}</p>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {activity.adminName} • {activity.timestamp} • {activity.searchId}
                </p>
              </article>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border bg-card text-foreground">
          <CardHeader>
            <CardTitle className="text-foreground">Quick Actions</CardTitle>
            <CardDescription className="text-muted-foreground">
              Jump directly to common workflows.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {quickActions.map((item) => (
              <div key={item.title} className="rounded-xl border border-border bg-muted/35 p-3">
                <p className="font-medium text-foreground">{item.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="mt-3 border-border bg-transparent text-foreground hover:bg-muted"
                >
                  <Link href={item.href}>
                    Open
                    <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              </div>
            ))}

            <div className="rounded-xl border border-emerald-300/20 bg-emerald-500/10 p-3 text-xs text-emerald-100">
              <p className="flex items-center gap-2 font-medium">
                <CircleCheckBig className="size-4" />
                System monitor reports healthy services.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
