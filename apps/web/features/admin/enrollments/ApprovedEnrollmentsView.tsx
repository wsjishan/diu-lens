'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, RefreshCw, ShieldAlert, Undo2 } from 'lucide-react';
import { AdminApiAuthError, fetchEnrollments, resetEnrollment } from '@/features/admin/api';
import { useAdminAuth } from '@/features/admin/auth/AdminAuthContext';
import { EnrollmentRecord } from '@/features/admin/auth/types';
import { useAdminToast } from '@/features/admin/ui/AdminToastProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type ResetDialogState = {
  studentId: string;
  fullName: string;
};

function formatDate(value: string | null) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function ApprovedEnrollmentsView() {
  const router = useRouter();
  const { token, admin, clearSession } = useAdminAuth();
  const { showToast } = useAdminToast();

  const [approvedRows, setApprovedRows] = useState<EnrollmentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [resetDialog, setResetDialog] = useState<ResetDialogState | null>(null);

  const isSuperAdmin = admin?.role === 'super_admin';

  const handleAuthFailure = useCallback(
    (errorValue: unknown): boolean => {
      if (errorValue instanceof AdminApiAuthError) {
        clearSession();
        showToast({ title: 'Session expired', message: errorValue.message, variant: 'error' });
        router.replace('/admin/login');
        return true;
      }

      return false;
    },
    [clearSession, showToast, router]
  );

  const loadApproved = useCallback(
    async (showLoading: boolean) => {
      if (!token) {
        return;
      }

      if (showLoading) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setError(null);

      try {
        const rows = await fetchEnrollments(token);
        setApprovedRows(rows.filter((item) => item.status === 'approved'));
      } catch (errorValue) {
        if (handleAuthFailure(errorValue)) {
          return;
        }

        setError(errorValue instanceof Error ? errorValue.message : 'Failed to load approved enrollments.');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [token, handleAuthFailure]
  );

  useEffect(() => {
    if (!token) {
      return;
    }

    void loadApproved(true);
  }, [token, loadApproved]);

  const onResetConfirm = async () => {
    if (!token || !resetDialog || !isSuperAdmin) {
      return;
    }

    setActionKey(`reset:${resetDialog.studentId}`);

    try {
      const result = await resetEnrollment(token, resetDialog.studentId);
      if (!result.success) {
        showToast({ title: 'Reset failed', message: result.message, variant: 'error' });
        return;
      }

      showToast({ title: 'Enrollment reset', message: result.message, variant: 'success' });
      await loadApproved(false);
      setResetDialog(null);
    } catch (errorValue) {
      if (handleAuthFailure(errorValue)) {
        return;
      }

      showToast({
        title: 'Request failed',
        message: errorValue instanceof Error ? errorValue.message : 'Unexpected error occurred.',
        variant: 'error',
      });
    } finally {
      setActionKey(null);
    }
  };

  if (isLoading) {
    return (
      <Card className="border-border bg-card text-foreground">
        <CardContent className="py-14">
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading approved enrollments...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6">
      <Card className="border-border bg-card text-foreground">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-foreground">Approved Enrollment Management</CardTitle>
            <CardDescription className="text-muted-foreground">
              Reset is available only here and only for approved students.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => loadApproved(false)}
            disabled={isRefreshing || actionKey !== null}
          >
            <RefreshCw className={cn('size-4', isRefreshing ? 'animate-spin' : '')} />
            Refresh
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          {!isSuperAdmin ? (
            <div className="rounded-xl border border-destructive/35 bg-destructive/10 p-4 text-sm text-destructive">
              Reset is restricted to super_admin users.
            </div>
          ) : null}

          {error ? (
            <div className="rounded-xl border border-destructive/35 bg-destructive/10 p-4 text-sm text-destructive">
              <p>{error}</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => loadApproved(true)}
              >
                Retry
              </Button>
            </div>
          ) : null}

          {!error && approvedRows.length === 0 ? (
            <div className="rounded-xl border border-border bg-muted/35 p-8 text-center text-sm text-muted-foreground">
              No approved enrollments found.
            </div>
          ) : null}

          {!error && approvedRows.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-muted/45 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5">Student</th>
                    <th className="px-3 py-2.5">Contact</th>
                    <th className="px-3 py-2.5">Updated</th>
                    <th className="px-3 py-2.5">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {approvedRows.map((item) => {
                    const resetKey = `reset:${item.student_id}`;
                    const rowBusy = actionKey === resetKey;

                    return (
                      <tr key={item.student_id} className="border-t border-border/60 align-top">
                        <td className="px-3 py-3">
                          <p className="font-medium text-foreground">{item.full_name || '-'}</p>
                          <p className="text-xs text-muted-foreground">ID: {item.student_id}</p>
                        </td>
                        <td className="px-3 py-3 text-xs text-muted-foreground">
                          <p>{item.university_email || '-'}</p>
                          <p>{item.phone || '-'}</p>
                        </td>
                        <td className="px-3 py-3 text-xs text-muted-foreground">
                          <p>{formatDate(item.updated_at || item.created_at)}</p>
                          <p>{item.updated_at ? `Created: ${formatDate(item.created_at)}` : ''}</p>
                        </td>
                        <td className="px-3 py-3">
                          {isSuperAdmin ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setResetDialog({
                                  studentId: item.student_id,
                                  fullName: item.full_name,
                                })
                              }
                              disabled={rowBusy}
                            >
                              <Undo2 className="size-3.5" />
                              Reset
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">Not allowed</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {resetDialog ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/60 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-lg border-border bg-card text-foreground">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <ShieldAlert className="size-5 text-destructive" />
                Confirm Reset Enrollment
              </CardTitle>
              <CardDescription>
                Reset will remove approved operational data for{' '}
                <strong>{resetDialog.fullName || resetDialog.studentId}</strong>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                This is destructive. Student will need to register again from scratch.
              </p>

              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setResetDialog(null)}
                  disabled={actionKey === `reset:${resetDialog.studentId}`}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={onResetConfirm}
                  disabled={actionKey === `reset:${resetDialog.studentId}`}
                >
                  {actionKey === `reset:${resetDialog.studentId}` ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    'Confirm Reset'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
