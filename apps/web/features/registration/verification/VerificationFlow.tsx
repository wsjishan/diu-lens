'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo } from 'react';

import { requiredCapturesPerAngle } from '@/features/registration/verification/constants';
import { VerificationScreen } from '@/features/registration/verification/VerificationScreen';
import { useCamera } from '@/features/registration/verification/useCamera';
import { useVerificationFlow } from '@/features/registration/verification/useVerificationFlow';
import { Button } from '@/components/ui/button';

const transition = {
  duration: 0.24,
  ease: [0.2, 0.7, 0.2, 1] as [number, number, number, number],
};

type VerificationFlowProps = {
  onComplete: () => void;
};

export function VerificationFlow({ onComplete }: VerificationFlowProps) {
  const {
    videoRef,
    status: permissionState,
    errorMessage,
    streamActive,
    requestAccess,
    captureFrame,
    readFrameAnalysis,
    resetPermission,
    stopStream,
  } = useCamera();

  const {
    angles,
    currentAngle,
    currentAngleIndex,
    currentAngleAccepted,
    currentCaptureIndex,
    feedback,
    statusLabel,
    isAutoCaptureEnabled,
    isAutoCaptureActive,
    isManualFallback,
    isComplete,
    captureManually,
    retakeCurrentShot,
    resumeAutoCapture,
    canCapture,
  } = useVerificationFlow({
    streamActive,
    captureFrame,
    readFrameAnalysis,
  });

  useEffect(() => {
    if (isComplete) {
      stopStream();
    }
  }, [isComplete, stopStream]);

  useEffect(() => {
    if (permissionState === 'idle') {
      void requestAccess();
    }
  }, [permissionState, requestAccess]);

  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);

  const renderedStep = useMemo(() => {
    if (isComplete) {
      return (
        <section className="flex h-full min-h-0 items-center justify-center px-2 py-2 sm:px-4 sm:py-4">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 text-center shadow-[0_14px_40px_-30px_rgba(15,23,42,0.45)]">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              Verification complete
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              All 5 angles were captured successfully. Continue to finish your
              registration.
            </p>
            <Button
              type="button"
              size="lg"
              onClick={onComplete}
              className="mt-6 h-11 rounded-xl px-6"
            >
              Finish Registration
            </Button>
          </div>
        </section>
      );
    }

    const permissionBlocked = permissionState !== 'granted';
    const helperText = permissionBlocked
      ? 'Allow camera access to continue with guided face verification.'
      : currentAngle.guidance;

    const permissionFeedback =
      errorMessage ??
      (permissionState === 'unsupported'
        ? 'Camera is not supported in this browser.'
        : 'Enable your camera to start the live preview.');

    const feedbackText = permissionBlocked ? permissionFeedback : feedback;

    return (
      <VerificationScreen
        instruction={currentAngle.title}
        helperText={helperText}
        feedback={feedbackText}
        stepIndex={currentAngleIndex}
        totalSteps={angles.length}
        captureIndex={currentCaptureIndex}
        requiredCaptures={requiredCapturesPerAngle}
        videoRef={videoRef}
        streamActive={streamActive}
        permissionBlocked={permissionBlocked}
        isRequestingPermission={permissionState === 'requesting'}
        isAutoCaptureActive={isAutoCaptureActive}
        isAutoCaptureEnabled={isAutoCaptureEnabled}
        isManualFallback={isManualFallback}
        canCaptureNow={canCapture}
        onEnableCamera={() => {
          if (permissionBlocked) {
            resetPermission();
            void requestAccess();
          }
        }}
        onCaptureNow={() => {
          captureManually();
        }}
        onResumeAutoCapture={resumeAutoCapture}
        onRetake={retakeCurrentShot}
        canRetake={currentAngleAccepted > 0}
        autoCaptureHint={
          permissionBlocked
            ? permissionFeedback
            : isAutoCaptureActive
              ? 'Hold still. Auto-capture in progress.'
              : isManualFallback
                ? 'Manual mode active. Resume auto-capture anytime.'
                : isAutoCaptureEnabled
                  ? 'Align your face and hold still for auto-capture.'
                  : statusLabel
        }
      />
    );
  }, [
    angles.length,
    canCapture,
    captureManually,
    currentAngle,
    currentAngleAccepted,
    currentAngleIndex,
    currentCaptureIndex,
    feedback,
    errorMessage,
    isAutoCaptureActive,
    isAutoCaptureEnabled,
    isManualFallback,
    onComplete,
    permissionState,
    requestAccess,
    resetPermission,
    resumeAutoCapture,
    retakeCurrentShot,
    statusLabel,
    streamActive,
    videoRef,
    isComplete,
  ]);

  return (
    <div className="flex h-full min-h-80 flex-col">
      <AnimatePresence
        mode="wait"
        initial={false}
      >
        <motion.div
          key={isComplete ? 'complete' : `capture-${currentAngleIndex}`}
          className="flex h-full flex-col"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={transition}
        >
          {renderedStep}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
