'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo } from 'react';

import {
  verificationNote,
  verificationTitle,
} from '@/features/registration/verification/constants';
import { VerificationScreen } from '@/features/registration/verification/VerificationScreen';
import { useCamera } from '@/features/registration/verification/useCamera';

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

  const renderedStep = useMemo(() => {
    const permissionBlocked = permissionState !== 'granted';
    const permissionFeedback =
      errorMessage ??
      (permissionState === 'unsupported'
        ? 'Camera is not supported in this browser.'
        : 'Enable your camera to start the live preview.');
    const statusText = permissionBlocked
      ? permissionFeedback
      : 'Live camera preview is ready.';
    const actionLabel =
      permissionState === 'requesting'
        ? 'Starting verification...'
        : permissionBlocked
          ? 'Start Verification'
          : 'Continue';
    const actionDisabled = permissionState === 'requesting';

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
          if (permissionBlocked) {
            resetPermission();
            void requestAccess();
            return;
          }
          stopStream();
          onComplete();
        }}
        cameraFallbackMessage={
          permissionBlocked ? permissionFeedback : undefined
        }
      />
    );
  }, [
    errorMessage,
    onComplete,
    permissionState,
    requestAccess,
    resetPermission,
    stopStream,
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
