'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, RefreshCw, ShieldAlert, Undo2 } from 'lucide-react';
import {
  AdminApiAuthError,
  fetchEnrollments,
  processEnrollment,
  resetEnrollment,
} from '@/features/admin/api';
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

  const [rows, setRows] = useState<EnrollmentRecord[]>([]);
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
        const nextRows = await fetchEnrollments(token);
        setRows(nextRows.filter((item) => item.status === 'approved' || item.status === 'processed'));
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

  const onProcess = async (item: EnrollmentRecord) => {
    if (!token) {
      return;
    }

    const processKey = `process:${item.student_id}`;
    setActionKey(processKey);

    try {
      const result = await processEnrollment(token, item.student_id);
      if (!result.success || !result.processing_passed || result.embeddings_generated_count <= 0) {
        const message = !result.success
          ? result.message
          : result.embeddings_generated_count <= 0
            ? 'Processing finished but no embeddings were generated.'
            : result.message || 'Processing failed.';
        showToast({ title: 'Processing failed', message, variant: 'error' });
        await loadApproved(false);
        return;
      }

      showToast({
        title: 'Embeddings generated',
        message: `Generated ${result.embeddings_generated_count} embeddings for ${item.student_id}.`,
        variant: 'success',
      });
      await loadApproved(false);
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

          {!error && rows.length === 0 ? (
            <div className="rounded-xl border border-border bg-muted/35 p-8 text-center text-sm text-muted-foreground">
              No approved or processed enrollments found.
            </div>
          ) : null}

          {!error && rows.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-muted/45 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5">Student</th>
                    <th className="px-3 py-2.5">Contact</th>
                    <th className="px-3 py-2.5">Updated</th>
                    <th className="px-3 py-2.5">Processing</th>
                    <th className="px-3 py-2.5">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((item) => {
                    const resetKey = `reset:${item.student_id}`;
                    const processKey = `process:${item.student_id}`;
                    const rowBusy = actionKey === resetKey || actionKey === processKey;
                    const processingState = item.processing_state;
                    const isProcessed = processingState === 'processed';
                    const isProcessingFailed = processingState === 'processing_failed';
                    const needsProcessing = processingState === 'needs_processing';
                    const canProcess = needsProcessing || isProcessingFailed;

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
                          {isProcessed ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-300">
                              <CheckCircle2 className="size-3.5" />
                              Processed
                            </span>
                          ) : isProcessingFailed ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-xs font-medium text-rose-300">
                              Processing failed
                            </span>
                          ) : needsProcessing ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-300">
                              Needs processing
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Not applicable</span>
                          )}
                          {item.last_processing_message ? (
                            <p className="mt-1 max-w-xs text-[11px] text-muted-foreground">
                              {item.last_processing_message}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => onProcess(item)}
                              disabled={rowBusy || !canProcess}
                            >
                              {actionKey === processKey ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : null}
                              {isProcessingFailed ? 'Retry Process' : isProcessed ? 'Processed' : 'Process'}
                            </Button>

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
                              <span className="text-xs text-muted-foreground">Reset not allowed</span>
                            )}
                          </div>
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
