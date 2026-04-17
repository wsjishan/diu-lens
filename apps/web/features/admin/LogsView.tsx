'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { recentActivity } from '@/features/admin/mock-data';

const statusStyles: Record<string, string> = {
  match_found: 'text-emerald-200',
  review_needed: 'text-amber-200',
  no_match: 'text-rose-200',
};

export function LogsView() {
  const [filter, setFilter] = useState<'all' | 'match_found' | 'review_needed' | 'no_match'>('all');

  const filteredItems = useMemo(() => {
    if (filter === 'all') {
      return recentActivity;
    }

    return recentActivity.filter((item) => item.status === filter);
  }, [filter]);

  return (
    <Card className="border-border bg-card text-foreground">
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle className="text-foreground">Search and Activity Logs</CardTitle>
          <CardDescription className="text-muted-foreground">
            Demo audit trail for admin actions and search outcomes.
          </CardDescription>
        </div>

        <div className="rounded-lg border border-border bg-muted/40 px-2 py-1.5">
          <label htmlFor="status-filter" className="mr-2 text-xs text-muted-foreground">
            Status
          </label>
          <select
            id="status-filter"
            value={filter}
            onChange={(event) =>
              setFilter(
                event.target.value as
                  | 'all'
                  | 'match_found'
                  | 'review_needed'
                  | 'no_match'
              )
            }
            className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
          >
            <option value="all">All</option>
            <option value="match_found">Match Found</option>
            <option value="review_needed">Review Needed</option>
            <option value="no_match">No Match</option>
          </select>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {filteredItems.map((log) => (
          <article key={log.id} className="rounded-xl border border-border bg-muted/35 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium text-foreground">{log.action}</p>
              <span className={`text-xs uppercase tracking-wide ${statusStyles[log.status]}`}>
                {log.status.replace('_', ' ')}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{log.summary}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Admin: {log.adminName} • Search ID: {log.searchId} • {log.timestamp}
            </p>
          </article>
        ))}
      </CardContent>
    </Card>
  );
}
