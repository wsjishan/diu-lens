'use client';

import { Camera, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  captureAngles,
  getRequiredFramesForAngle,
} from '@/features/registration/capture/constants';
import { CameraPreview } from '@/features/registration/capture/CameraPreview';
import { useFaceCapture } from '@/features/registration/capture/useFaceCapture';
import { CircularProgressGuide } from '@/features/registration/verification/CircularProgressGuide';
import { useCamera } from '@/features/registration/verification/useCamera';
import { totalRequiredShots } from '@/features/registration/verification/constants';
import type {
  VerificationAngle,
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

function getAngleLabel(angle: VerificationAngle) {
  if (angle === 'natural_front') return 'Natural Front';
  return angle.charAt(0).toUpperCase() + angle.slice(1);
}

const angleMarkerConfig: Array<{
  angle: VerificationAngle;
  label: string;
  className: string;
}> = [
  { angle: 'up', label: 'UP', className: 'left-1/2 top-1 -translate-x-1/2 -translate-y-1/2' },
  { angle: 'left', label: 'LEFT', className: 'left-1 top-1/2 -translate-x-1/2 -translate-y-1/2' },
  { angle: 'front', label: 'FRONT', className: 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2' },
  { angle: 'right', label: 'RIGHT', className: 'right-1 top-1/2 translate-x-1/2 -translate-y-1/2' },
  { angle: 'down', label: 'DOWN', className: 'left-1/2 bottom-1 -translate-x-1/2 translate-y-1/2' },
];

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
    frameMetadataByAngle,
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
        totalRequiredShots,
        totalAcceptedShots: captureAngles.reduce(
          (total, angle) => total + capturesByAngle[angle].length,
          0
        ),
        angles: captureAngles.map((angle) => ({
          angle,
          acceptedShots: capturesByAngle[angle].length,
          requiredShots: getRequiredFramesForAngle(angle),
        })),
        capturesByAngle,
        frameMetadataByAngle,
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
    frameMetadataByAngle,
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
      <div className="rounded-xl border border-slate-200/65 bg-white/45 p-4 shadow-[0_20px_40px_-28px_rgba(15,23,42,0.32)] backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/36 max-[639px]:rounded-[0.75rem] max-[639px]:p-3 sm:p-5">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="landing-text-muted text-xs font-semibold tracking-[0.04em] uppercase">
                Face Check
              </p>
              <h3 className="landing-text-primary text-xl font-semibold tracking-tight max-[639px]:text-[1.05rem]">
                {getAngleLabel(state.currentAngle)}
              </h3>
            </div>
            <div className="rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 text-xs font-semibold text-blue-700 dark:border-white/10 dark:bg-slate-900/55 dark:text-blue-300">
              {state.capturedCount} / {captureAngles.length}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-sm rounded-[2rem] border border-slate-200/70 bg-white/55 p-2 shadow-[0_14px_32px_-24px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-slate-900/40">
            <div className="relative mx-auto w-full max-w-sm p-2">
              <div className="pointer-events-none absolute inset-0">
                <CircularProgressGuide
                  totalSteps={captureAngles.length}
                  currentStepIndex={Math.max(0, captureAngles.indexOf(state.currentAngle))}
                />
              </div>

              <CameraPreview
                videoRef={mergedVideoRef}
                streamActive={streamActive}
                fallbackMessage={permissionBlocked ? statusText : undefined}
                className="aspect-square rounded-full border-4 border-white bg-slate-900"
              />

              <div className="pointer-events-none absolute inset-[10%] rounded-full border-2 border-white/90" />

              <div className="pointer-events-none absolute inset-0">
                {angleMarkerConfig.map((marker) => {
                  const isActive = state.currentAngle === marker.angle;
                  return (
                    <div
                      key={marker.angle}
                      className={cn(
                        'absolute rounded-full border px-2 py-1 text-[10px] font-semibold tracking-[0.02em] transition-all',
                        marker.className,
                        isActive
                          ? 'border-blue-500 bg-blue-500 text-white shadow-[0_0_18px_rgba(59,130,246,0.6)] animate-pulse'
                          : 'border-slate-300 bg-white/90 text-slate-600 dark:border-white/15 dark:bg-slate-900/75 dark:text-slate-300'
                      )}
                    >
                      {marker.label}
                    </div>
                  );
                })}
              </div>
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
              className="landing-button-bg landing-cta h-11 w-full rounded-xl text-sm text-white"
            >
              <Camera className="size-4" />
              {permissionButtonLabel}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 rounded-xl border border-slate-200/80 bg-white/72 px-3 py-2.5 dark:border-white/10 dark:bg-slate-900/45 max-[639px]:rounded-[0.66rem]">
        <Button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={
            permissionBlocked ||
            !state.modelReady ||
            !state.canSubmit ||
            isSubmittingCompletion
          }
          className="landing-button-bg landing-cta h-11 min-w-38 rounded-xl px-5 text-sm text-white"
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
