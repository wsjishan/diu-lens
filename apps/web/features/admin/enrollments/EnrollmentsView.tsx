'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import {
  AdminApiAuthError,
  approveEnrollment,
  fetchEnrollments,
  rejectEnrollment,
} from '@/features/admin/api';
import { useAdminAuth } from '@/features/admin/auth/AdminAuthContext';
import { EnrollmentRecord } from '@/features/admin/auth/types';
import { useAdminToast } from '@/features/admin/ui/AdminToastProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type RejectDialogState = {
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

export function EnrollmentsView() {
  const router = useRouter();
  const { token, clearSession } = useAdminAuth();
  const { showToast } = useAdminToast();

  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionKey, setActionKey] = useState<string | null>(null);

  const [rejectDialog, setRejectDialog] = useState<RejectDialogState | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState<string | null>(null);

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

  const loadEnrollments = useCallback(
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
        setEnrollments(rows.filter((item) => item.status === 'validated'));
      } catch (errorValue) {
        if (handleAuthFailure(errorValue)) {
          return;
        }

        setError(errorValue instanceof Error ? errorValue.message : 'Failed to load enrollments.');
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

    void loadEnrollments(true);
  }, [token, loadEnrollments]);

  const validatedCount = useMemo(() => enrollments.length, [enrollments]);

  const runAction = async (
    key: string,
    action: () => Promise<{ success: boolean; message: string }>,
    successTitle: string,
    onSuccess?: () => void
  ): Promise<boolean> => {
    setActionKey(key);

    try {
      const result = await action();
      if (!result.success) {
        showToast({ title: 'Action failed', message: result.message, variant: 'error' });
        return false;
      }

      if (onSuccess) {
        onSuccess();
      }

      showToast({ title: successTitle, message: result.message, variant: 'success' });
      await loadEnrollments(false);
      return true;
    } catch (errorValue) {
      if (handleAuthFailure(errorValue)) {
        return false;
      }

      showToast({
        title: 'Request failed',
        message: errorValue instanceof Error ? errorValue.message : 'Unexpected error occurred.',
        variant: 'error',
      });
      return false;
    } finally {
      setActionKey(null);
    }
  };

  const onApprove = async (studentId: string) => {
    if (!token) {
      return;
    }

    await runAction(
      `approve:${studentId}`,
      () => approveEnrollment(token, studentId),
      'Enrollment approved'
    );
  };

  const onRejectSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!token || !rejectDialog) {
      return;
    }

    const targetStudentId = rejectDialog.studentId;
    const isStillReviewable = enrollments.some((item) => item.student_id === targetStudentId);
    if (!isStillReviewable) {
      setRejectDialog(null);
      setRejectReason('');
      setRejectError(null);
      showToast({
        title: 'Already updated',
        message: 'This enrollment is no longer in the review queue. Refreshing list.',
        variant: 'error',
      });
      await loadEnrollments(false);
      return;
    }

    const reason = rejectReason.trim();

    if (reason.length < 3) {
      setRejectError('Please enter a rejection reason (at least 3 characters).');
      return;
    }

    setRejectError(null);

    const wasRejected = await runAction(
      `reject:${targetStudentId}`,
      () => rejectEnrollment(token, targetStudentId, reason),
      'Enrollment rejected',
      () => {
        setEnrollments((current) => current.filter((item) => item.student_id !== targetStudentId));
      }
    );

    if (wasRejected) {
      setRejectDialog(null);
      setRejectReason('');
    }
  };

  if (isLoading) {
    return (
      <Card className="border-border bg-card text-foreground">
        <CardContent className="py-14">
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading enrollments...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 md:grid-cols-1">
        <MetricCard title="Validated Enrollments" value={validatedCount} tone="pending" />
      </section>

      <Card className="border-border bg-card text-foreground">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-foreground">Enrollment Queue</CardTitle>
            <CardDescription className="text-muted-foreground">
              Review validated submissions and either approve or reject.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => loadEnrollments(false)}
            disabled={isRefreshing || actionKey !== null}
          >
            <RefreshCw className={cn('size-4', isRefreshing ? 'animate-spin' : '')} />
            Refresh
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          {error ? (
            <div className="rounded-xl border border-destructive/35 bg-destructive/10 p-4 text-sm text-destructive">
              <p>{error}</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => loadEnrollments(true)}
              >
                Retry
              </Button>
            </div>
          ) : null}

          {!error && enrollments.length === 0 ? (
            <div className="rounded-xl border border-border bg-muted/35 p-8 text-center text-sm text-muted-foreground">
              No validated enrollments found.
            </div>
          ) : null}

          {!error && enrollments.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-muted/45 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5">Student</th>
                    <th className="px-3 py-2.5">Contact</th>
                    <th className="px-3 py-2.5">Verification</th>
                    <th className="px-3 py-2.5">Updated</th>
                    <th className="px-3 py-2.5">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {enrollments.map((item) => {
                    const approveKey = `approve:${item.student_id}`;
                    const rejectKey = `reject:${item.student_id}`;
                    const rowBusy = actionKey === approveKey || actionKey === rejectKey;

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
                        <td className="px-3 py-3 text-xs">
                          <p className="text-muted-foreground">
                            {item.verification_completed ? 'Completed' : 'Not completed'}
                          </p>
                          {typeof item.total_accepted_shots === 'number' &&
                          typeof item.total_required_shots === 'number' ? (
                            <p className="text-muted-foreground">
                              {item.total_accepted_shots}/{item.total_required_shots} shots accepted
                            </p>
                          ) : null}
                        </td>
                        <td className="px-3 py-3 text-xs text-muted-foreground">
                          <p>{formatDate(item.updated_at || item.created_at)}</p>
                          <p>{item.updated_at ? `Created: ${formatDate(item.created_at)}` : ''}</p>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => onApprove(item.student_id)}
                              disabled={rowBusy}
                            >
                              <ShieldCheck className="size-3.5" />
                              Approve
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="border-destructive/30 text-destructive hover:bg-destructive/10"
                              onClick={() => {
                                setRejectError(null);
                                setRejectReason('');
                                setRejectDialog({
                                  studentId: item.student_id,
                                  fullName: item.full_name,
                                });
                              }}
                              disabled={rowBusy}
                            >
                              <XCircle className="size-3.5" />
                              Reject
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}

          <p className="text-xs text-muted-foreground">
            Reset actions for approved students are available in the approved management page.
          </p>
        </CardContent>
      </Card>

      {rejectDialog ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/60 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-lg border-border bg-card text-foreground">
            <CardHeader>
              <CardTitle>Reject Enrollment</CardTitle>
              <CardDescription>
                Provide a reason for rejecting <strong>{rejectDialog.fullName || rejectDialog.studentId}</strong>.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={onRejectSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="reject-reason">Reason</Label>
                  <Input
                    id="reject-reason"
                    value={rejectReason}
                    onChange={(event) => setRejectReason(event.target.value)}
                    placeholder="Example: Face verification images are incomplete"
                    className="h-10"
                    required
                  />
                </div>

                {rejectError ? (
                  <p className="rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {rejectError}
                  </p>
                ) : null}

                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setRejectDialog(null)}
                    disabled={actionKey === `reject:${rejectDialog.studentId}`}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={actionKey === `reject:${rejectDialog.studentId}`}>
                    {actionKey === `reject:${rejectDialog.studentId}` ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Rejecting...
                      </>
                    ) : (
                      'Confirm Reject'
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

function MetricCard({
  title,
  value,
  tone = 'default',
}: {
  title: string;
  value: number;
  tone?: 'default' | 'pending' | 'approved' | 'rejected';
}) {
  const toneClass =
    tone === 'pending'
      ? 'text-amber-600 dark:text-amber-300'
      : tone === 'approved'
        ? 'text-emerald-600 dark:text-emerald-300'
        : tone === 'rejected'
          ? 'text-rose-600 dark:text-rose-300'
          : 'text-foreground';

  return (
    <Card className="border-border bg-card text-foreground">
      <CardHeader>
        <CardDescription className="text-muted-foreground">{title}</CardDescription>
        <CardTitle className={cn('text-3xl font-semibold tracking-tight', toneClass)}>{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}
