'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  requiredShotsPerAngle,
  totalRequiredShots,
  verificationAngles,
  verificationNote,
  verificationTitle,
} from '@/features/registration/verification/constants';
import { VerificationScreen } from '@/features/registration/verification/VerificationScreen';
import type {
  VerificationCapturesByAngle,
  VerificationCompletionSummary,
} from '@/features/registration/verification/types';
import { useCamera } from '@/features/registration/verification/useCamera';

const transition = {
  duration: 0.24,
  ease: [0.2, 0.7, 0.2, 1] as [number, number, number, number],
};

type VerificationFlowProps = {
  onComplete: (summary: VerificationCompletionSummary) => void | Promise<void>;
  isSubmittingCompletion?: boolean;
  completionErrorMessage?: string | null;
};

export function VerificationFlow({
  onComplete,
  isSubmittingCompletion = false,
  completionErrorMessage,
}: VerificationFlowProps) {
  const [captureErrorMessage, setCaptureErrorMessage] = useState<string | null>(
    null
  );
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

  const completionSummary = useMemo<
    Omit<VerificationCompletionSummary, 'capturesByAngle'>
  >(() => {
    const angles = verificationAngles.map((angle) => ({
      angle,
      acceptedShots: requiredShotsPerAngle,
      requiredShots: requiredShotsPerAngle,
    }));

    return {
      verificationCompleted: true,
      totalRequiredShots,
      totalAcceptedShots: angles.reduce(
        (total, current) => total + current.acceptedShots,
        0
      ),
      angles,
    };
  }, []);

  const captureAcceptedImages = useCallback(async () => {
    const capturesByAngle = verificationAngles.reduce((result, angle) => {
      result[angle] = [];
      return result;
    }, {} as VerificationCapturesByAngle);

    for (const angle of verificationAngles) {
      for (let index = 0; index < requiredShotsPerAngle; index += 1) {
        const snapshot = await captureSnapshot();
        if (!snapshot) {
          throw new Error('Capture failed');
        }
        capturesByAngle[angle].push(snapshot);
      }
    }

    return capturesByAngle;
  }, [captureSnapshot]);

  const renderedStep = useMemo(() => {
    const permissionBlocked = permissionState !== 'granted';
    const permissionFeedback =
      errorMessage ??
      (permissionState === 'unsupported'
        ? 'Camera is not supported in this browser.'
        : 'Enable your camera to start the live preview.');
    const statusText = isSubmittingCompletion
      ? 'Submitting verification details...'
      : captureErrorMessage
        ? captureErrorMessage
        : completionErrorMessage
          ? completionErrorMessage
          : permissionBlocked
            ? permissionFeedback
            : 'Live camera preview is ready.';
    const actionLabel = isSubmittingCompletion
      ? 'Completing registration...'
      : permissionState === 'requesting'
        ? 'Starting verification...'
        : permissionBlocked
          ? 'Start Verification'
          : 'Continue';
    const actionDisabled =
      permissionState === 'requesting' || isSubmittingCompletion;

    return (
      <VerificationScreen
        instruction={verificationTitle}
        note={verificationNote}
        statusText={statusText}
        videoRef={videoRef}
        streamActive={streamActive}
        actionLabel={actionLabel}
        actionDisabled={actionDisabled}
        onAction={() => {
          if (isSubmittingCompletion) {
            return;
          }

          if (permissionBlocked) {
            setCaptureErrorMessage(null);
            resetPermission();
            void requestAccess();
            return;
          }

          void (async () => {
            try {
              setCaptureErrorMessage(null);
              const capturesByAngle = await captureAcceptedImages();
              await onComplete({
                ...completionSummary,
                capturesByAngle,
              });
            } catch {
              setCaptureErrorMessage(
                'Unable to capture verification images. Please try again.'
              );
            }
          })();
        }}
        cameraFallbackMessage={
          permissionBlocked ? permissionFeedback : undefined
        }
      />
    );
  }, [
    completionErrorMessage,
    completionSummary,
    captureAcceptedImages,
    captureErrorMessage,
    errorMessage,
    isSubmittingCompletion,
    onComplete,
    permissionState,
    requestAccess,
    resetPermission,
    streamActive,
    videoRef,
  ]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <AnimatePresence
        mode="wait"
        initial={false}
      >
        <motion.div
          key={permissionState}
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
