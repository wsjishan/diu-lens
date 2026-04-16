'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo } from 'react';

import {
  requiredShotsPerAngle,
  totalRequiredShots,
  verificationAngles,
  verificationNote,
  verificationTitle,
} from '@/features/registration/verification/constants';
import { VerificationScreen } from '@/features/registration/verification/VerificationScreen';
import type { VerificationCompletionSummary } from '@/features/registration/verification/types';
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
  const {
    videoRef,
    status: permissionState,
    errorMessage,
    streamActive,
    requestAccess,
    resetPermission,
    stopStream,
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

  const completionSummary = useMemo<VerificationCompletionSummary>(() => {
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

  const renderedStep = useMemo(() => {
    const permissionBlocked = permissionState !== 'granted';
    const permissionFeedback =
      errorMessage ??
      (permissionState === 'unsupported'
        ? 'Camera is not supported in this browser.'
        : 'Enable your camera to start the live preview.');
    const statusText = isSubmittingCompletion
      ? 'Submitting verification details...'
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
            resetPermission();
            void requestAccess();
            return;
          }

          void onComplete(completionSummary);
        }}
        cameraFallbackMessage={
          permissionBlocked ? permissionFeedback : undefined
        }
      />
    );
  }, [
    completionErrorMessage,
    completionSummary,
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
