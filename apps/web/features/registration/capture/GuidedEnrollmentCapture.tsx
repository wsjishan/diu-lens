'use client';

import { AlertTriangle, Camera, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  guidedAngles,
  perAngleHint,
} from '@/features/registration/capture/constants';
import { CameraPreview } from '@/features/registration/capture/CameraPreview';
import { CaptureProgress } from '@/features/registration/capture/CaptureProgress';
import { CapturedShotStrip } from '@/features/registration/capture/CapturedShotStrip';
import { useFaceCapture } from '@/features/registration/capture/useFaceCapture';
import { useCamera } from '@/features/registration/verification/useCamera';
import type {
  VerificationCompletionSummary,
} from '@/features/registration/verification/types';
import { cn } from '@/lib/utils';

type GuidedEnrollmentCaptureProps = {
  studentId: string;
  onComplete: (summary: VerificationCompletionSummary) => void | Promise<void>;
  isSubmittingCompletion?: boolean;
  completionErrorMessage?: string | null;
};

function getStorageKey(studentId: string) {
  const normalized = studentId.trim().toLowerCase();
  return `diu-lens-capture:${normalized || 'unknown'}`;
}

export function GuidedEnrollmentCapture({
  studentId,
  onComplete,
  isSubmittingCompletion = false,
  completionErrorMessage,
}: GuidedEnrollmentCaptureProps) {
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [localErrorMessage, setLocalErrorMessage] = useState<string | null>(null);
  const currentAngleRef = useRef<string>('front');
  const currentBlockerRef = useRef<string>('no_face');

  const {
    videoRef,
    status: permissionState,
    errorMessage,
    streamActive,
    requestAccess,
    resetPermission,
    stopStream,
    captureSnapshot,
  } = useCamera();

  const mergedVideoRef = useCallback(
    (node: HTMLVideoElement | null) => {
      setVideoElement(node);
      videoRef(node);
    },
    [videoRef]
  );

  const {
    state,
    capturesByAngle,
    firstMissingAngle,
    retakeAngle,
    focusAngle,
    clearSession,
  } = useFaceCapture({
    videoElement,
    streamActive,
    captureSnapshot,
    storageKey: getStorageKey(studentId),
  });

  useEffect(() => {
    currentAngleRef.current = state.currentAngle;
    currentBlockerRef.current = state.feedback.guidanceState;
  }, [state.currentAngle, state.feedback.guidanceState]);

  useEffect(() => {
    if (permissionState === 'idle') {
      void requestAccess();
    }
  }, [permissionState, requestAccess]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;

    console.error = (...args: unknown[]) => {
      const message = args
        .map((arg) => {
          if (typeof arg === 'string') {
            return arg;
          }
          if (arg instanceof Error) {
            return arg.message;
          }
          if (arg && typeof arg === 'object' && 'message' in arg) {
            return String((arg as { message?: unknown }).message ?? '');
          }
          return String(arg);
        })
        .join(' ');

      if (
        message.includes('[capture-error]') ||
        message.includes('[capture-overlay-suppressed]') ||
        message.includes('Created TensorFlow Lite XNNPACK delegate for CPU') ||
        message.includes('XNNPACK delegate')
      ) {
        originalConsoleWarn(...args);
        return;
      }

      originalConsoleError(...args);
    };

    const previousOnError = window.onerror;
    const previousOnUnhandledRejection = window.onunhandledrejection;

    const describeError = (error: unknown) => {
      if (error instanceof Error) {
        return {
          message: error.message,
          stack: error.stack ?? null,
        };
      }
      return {
        message: typeof error === 'string' ? error : String(error),
        stack: null,
      };
    };

    const logCaptureError = (source: string, error: unknown) => {
      const details = describeError(error);
      console.error('[capture-overlay-suppressed]', {
        source,
        message: details.message,
        stack: details.stack,
        currentTargetAngle: currentAngleRef.current,
        currentBlocker: currentBlockerRef.current,
      });
    };

    window.onerror = (message, source, lineno, colno, error) => {
      logCaptureError('window.onerror', error ?? message);
      if (typeof previousOnError === 'function') {
        try {
          previousOnError.call(window, message, source, lineno, colno, error);
        } catch (handlerError) {
          console.error('[capture-overlay-suppressed]', {
            source: 'window.onerror.previous_handler_failed',
            message: String(handlerError),
            currentTargetAngle: currentAngleRef.current,
            currentBlocker: currentBlockerRef.current,
          });
        }
      }
      return true;
    };

    window.onunhandledrejection = (event) => {
      logCaptureError('window.onunhandledrejection', event.reason);
      event.preventDefault();
      if (typeof previousOnUnhandledRejection === 'function') {
        try {
          previousOnUnhandledRejection.call(window, event);
        } catch (handlerError) {
          console.error('[capture-overlay-suppressed]', {
            source: 'window.onunhandledrejection.previous_handler_failed',
            message: String(handlerError),
            currentTargetAngle: currentAngleRef.current,
            currentBlocker: currentBlockerRef.current,
          });
        }
      }
      return true;
    };

    return () => {
      console.error = originalConsoleError;
      window.onerror = previousOnError;
      window.onunhandledrejection = previousOnUnhandledRejection;
    };
  }, []);

  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);

  const handleSubmit = useCallback(async () => {
    console.log('[verification-timing] submit button clicked', {
      nowMs: Number(performance.now().toFixed(2)),
      canSubmit: state.canSubmit,
      isSubmittingCompletion,
    });
    if (isSubmittingCompletion || !state.canSubmit) {
      return;
    }

    setLocalErrorMessage(null);
    console.log('[verification] final submit triggered', {
      studentId,
      capturedCount: state.capturedCount,
    });

    try {
      const summary: VerificationCompletionSummary = {
        verificationCompleted: true,
        totalRequiredShots: guidedAngles.length,
        totalAcceptedShots: guidedAngles.length,
        angles: guidedAngles.map((angle) => ({
          angle,
          acceptedShots: 1,
          requiredShots: 1,
        })),
        capturesByAngle,
      };

      await onComplete(summary);
      clearSession();
    } catch {
      console.error('[verification] final submit failed at capture step');
      setLocalErrorMessage('Unable to submit verification. Please try again.');
    }
  }, [
    capturesByAngle,
    clearSession,
    isSubmittingCompletion,
    onComplete,
    state.canSubmit,
    state.capturedCount,
    studentId,
  ]);

  const permissionBlocked = permissionState !== 'granted';

  const statusText = useMemo(() => {
    if (isSubmittingCompletion) {
      return 'Uploading verification images...';
    }

    if (completionErrorMessage && state.canSubmit) {
      return completionErrorMessage;
    }

    if (localErrorMessage) {
      return localErrorMessage;
    }

    if (state.modelErrorMessage) {
      return state.modelErrorMessage;
    }

    if (permissionBlocked) {
      return (
        errorMessage ??
        'Camera access is required for guided enrollment. Allow camera permission to continue.'
      );
    }

    return state.feedback.liveMessage;
  }, [
    completionErrorMessage,
    errorMessage,
    isSubmittingCompletion,
    localErrorMessage,
    permissionBlocked,
    state.feedback.liveMessage,
    state.canSubmit,
    state.modelErrorMessage,
  ]);

  const permissionButtonLabel =
    permissionState === 'requesting' ? 'Starting camera...' : 'Enable camera';

  return (
    <section className="space-y-3 sm:space-y-4">
      <div className="rounded-2xl border border-slate-200/75 bg-white/82 p-3 shadow-[0_18px_35px_-28px_rgba(15,23,42,0.42)] backdrop-blur-sm sm:p-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold tracking-[0.03em] text-slate-500 uppercase">
                  Current angle
                </p>
                <h3 className="text-xl font-semibold tracking-tight text-slate-900">
                  {state.currentAngle.charAt(0).toUpperCase() + state.currentAngle.slice(1)}
                </h3>
              </div>

              <div className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                {state.capturedCount} / {guidedAngles.length}
              </div>
            </div>

            <p className="text-sm text-slate-600">{state.feedback.instruction}</p>
            <p className="text-xs text-slate-500">{perAngleHint[state.currentAngle]}</p>

            <div className="relative mx-auto w-full max-w-sm">
              <CameraPreview
                videoRef={mergedVideoRef}
                streamActive={streamActive}
                fallbackMessage={permissionBlocked ? statusText : undefined}
              />

              <div className="pointer-events-none absolute inset-[9%] rounded-[28%] border-2 border-blue-300/80" />
              <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-slate-950/65 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                Hold for capture
              </div>

              <div className="pointer-events-none absolute right-3 bottom-3 left-3 h-1.5 overflow-hidden rounded-full bg-slate-900/30">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-150',
                    state.feedback.holdProgress >= 1 ? 'bg-emerald-400' : 'bg-blue-400'
                  )}
                  style={{ width: `${Math.round(state.feedback.holdProgress * 100)}%` }}
                />
              </div>
            </div>

            {permissionBlocked ? (
              <Button
                type="button"
                onClick={() => {
                  resetPermission();
                  void requestAccess();
                }}
                disabled={permissionState === 'requesting'}
                className="landing-button-bg landing-cta h-11 w-full text-white"
              >
                <Camera className="size-4" />
                {permissionButtonLabel}
              </Button>
            ) : null}
          </div>

          <div className="space-y-3">
            <CaptureProgress
              capturedShots={state.capturedShots}
              currentAngle={state.currentAngle}
              capturedCount={state.capturedCount}
            />

            <div className="rounded-xl border border-slate-200/85 bg-slate-50/65 p-3">
              <p className="text-xs font-semibold tracking-[0.03em] text-slate-500 uppercase">
                Live guidance
              </p>
              <p
                className={cn(
                  'mt-1 text-sm font-medium',
                  permissionBlocked || completionErrorMessage || localErrorMessage
                    ? 'text-amber-700'
                    : 'text-slate-700'
                )}
              >
                {statusText}
              </p>

              {!permissionBlocked && !state.canSubmit ? (
                <p className="mt-2 text-xs text-slate-500">
                  Complete all five required angles. Next required: {firstMissingAngle}.
                </p>
              ) : null}
            </div>

            <CapturedShotStrip
              capturedShots={state.capturedShots}
              currentAngle={state.currentAngle}
              onRetake={retakeAngle}
              onFocus={focusAngle}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-white/70 px-3 py-2.5">
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <AlertTriangle className="size-3.5" />
          <span>Submission is locked until all 5 required angles are captured.</span>
        </div>

        <Button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={
            permissionBlocked ||
            !state.modelReady ||
            !state.canSubmit ||
            isSubmittingCompletion
          }
          className="landing-button-bg landing-cta min-w-38 text-white"
        >
          {isSubmittingCompletion ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Uploading...
            </>
          ) : (
            'Complete Enrollment'
          )}
        </Button>
      </div>
    </section>
  );
}
