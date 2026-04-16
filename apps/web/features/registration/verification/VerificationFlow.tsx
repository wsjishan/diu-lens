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
    readPoseEstimation,
    resetPermission,
    stopStream,
  } = useCamera();

  const {
    angles,
    currentAngle,
    step,
    progress,
    currentAngleIndex,
    currentAngleAccepted,
    currentCaptureIndex,
    feedback,
    statusLabel,
    validation,
    isAutoCaptureEnabled,
    isAutoCaptureActive,
    isCapturing,
    isDebugModeEnabled,
    isRelaxThresholdsEnabled,
    isManualFallback,
    isComplete,
    overallAccepted,
    totalRequired,
    debug,
    toggleDebugMode,
    toggleRelaxThresholds,
    captureManually,
    retakeCurrentShot,
    resumeAutoCapture,
  } = useVerificationFlow({
    streamActive,
    captureFrame,
    readFrameAnalysis,
    readPoseEstimation,
  });

  const {
    holdProgress,
    faceDetected,
    isCentered,
    poseMatched,
    isStable,
    lightingOk,
    isSharpEnough,
    canCapture: validationCanCapture,
  } = validation;

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
      : 'Keep your face centered and hold still.';

    const permissionFeedback =
      errorMessage ??
      (permissionState === 'unsupported'
        ? 'Camera is not supported in this browser.'
        : 'Enable your camera to start the live preview.');

    const feedbackText = permissionBlocked ? permissionFeedback : feedback;
    const canCaptureAction =
      streamActive &&
      !permissionBlocked &&
      !isCapturing &&
      !isComplete &&
      currentAngleAccepted < requiredCapturesPerAngle;

    return (
      <VerificationScreen
        instruction={currentAngle.title}
        helperText={helperText}
        feedback={feedbackText}
        stepIndex={currentAngleIndex}
        totalSteps={angles.length}
        acceptedShotsForCurrentAngle={currentAngleAccepted}
        requiredCaptures={requiredCapturesPerAngle}
        totalAcceptedShots={overallAccepted}
        totalRequiredShots={totalRequired}
        progressPercent={progress}
        holdProgress={holdProgress}
        videoRef={videoRef}
        streamActive={streamActive}
        permissionBlocked={permissionBlocked}
        isRequestingPermission={permissionState === 'requesting'}
        isAutoCaptureActive={isAutoCaptureActive}
        isAutoCaptureEnabled={isAutoCaptureEnabled}
        isManualFallback={isManualFallback}
        canCaptureNow={canCaptureAction}
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
            : isCapturing
              ? `Hold still. Capturing step ${step + 1}...`
              : isManualFallback
                ? 'Manual mode active. Resume auto-capture anytime.'
                : isAutoCaptureEnabled
                  ? 'Align your face and hold still for auto-capture.'
                  : statusLabel
        }
        cameraFallbackMessage={
          permissionBlocked ? permissionFeedback : undefined
        }
        debugState={{
          currentAngle: debug.currentAngle,
          yaw: debug.yaw,
          rawYaw: debug.rawYaw,
          pitch: debug.pitch,
          rawPitch: debug.rawPitch,
          rawFaceCenter: debug.rawFaceCenter,
          faceDetected,
          isCentered,
          poseMatched,
          isStable,
          lightingOk,
          isSharpEnough,
          poseHoldSatisfied: debug.poseHoldSatisfied,
          canCapture: validationCanCapture,
          isCapturing,
          autoCaptureEnabled: isAutoCaptureEnabled,
          acceptedShotsForCurrentAngle: debug.acceptedShotsForCurrentAngle,
          totalAcceptedShots: debug.totalAcceptedShots,
          cooldownRemainingMs: debug.cooldownRemainingMs,
          cameraReady: debug.cameraReady,
          landmarkModelLoaded: debug.landmarkModelLoaded,
          landmarksDetected: debug.landmarksDetected,
          fallbackPoseUsed: debug.fallbackPoseUsed,
          rawLandmarkCount: debug.rawLandmarkCount,
          captureTriggerCount: debug.captureTriggerCount,
          blockingReason: debug.blockingReason,
          expectedYawRange: debug.expectedYawRange,
          expectedPitchRange: debug.expectedPitchRange,
          poseHoldMs: debug.poseHoldMs,
          requiredPoseHoldMs: debug.requiredPoseHoldMs,
          stabilityMs: debug.stabilityMs,
          requiredStabilityMs: debug.requiredStabilityMs,
          debugModeEnabled: isDebugModeEnabled,
          relaxThresholdsEnabled: isRelaxThresholdsEnabled,
          onToggleDebugMode: toggleDebugMode,
          onToggleRelaxThresholds: toggleRelaxThresholds,
        }}
      />
    );
  }, [
    angles.length,
    captureManually,
    currentAngle,
    currentAngleAccepted,
    currentAngleIndex,
    feedback,
    errorMessage,
    isCapturing,
    isAutoCaptureActive,
    isAutoCaptureEnabled,
    isDebugModeEnabled,
    isRelaxThresholdsEnabled,
    debug.currentAngle,
    debug.rawYaw,
    debug.rawPitch,
    debug.rawFaceCenter,
    debug.poseHoldSatisfied,
    debug.acceptedShotsForCurrentAngle,
    debug.totalAcceptedShots,
    debug.cooldownRemainingMs,
    debug.cameraReady,
    debug.landmarkModelLoaded,
    debug.landmarksDetected,
    debug.fallbackPoseUsed,
    debug.rawLandmarkCount,
    debug.captureTriggerCount,
    debug.blockingReason,
    debug.expectedYawRange,
    debug.expectedPitchRange,
    debug.poseHoldMs,
    debug.requiredPoseHoldMs,
    debug.stabilityMs,
    debug.requiredStabilityMs,
    debug.pitch,
    debug.yaw,
    isManualFallback,
    onComplete,
    overallAccepted,
    permissionState,
    progress,
    requestAccess,
    resetPermission,
    resumeAutoCapture,
    retakeCurrentShot,
    statusLabel,
    streamActive,
    step,
    holdProgress,
    faceDetected,
    isCentered,
    poseMatched,
    isStable,
    lightingOk,
    isSharpEnough,
    validationCanCapture,
    totalRequired,
    toggleDebugMode,
    toggleRelaxThresholds,
    videoRef,
    isComplete,
  ]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <AnimatePresence
        mode="wait"
        initial={false}
      >
        <motion.div
          key={
            isComplete
              ? 'complete'
              : `capture-${currentAngleIndex}-${currentCaptureIndex}`
          }
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
