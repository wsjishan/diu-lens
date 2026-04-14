'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';

import { registrationPrepTips } from '@/features/registration/constants';
import { AngleGuide } from '@/features/registration/verification/AngleGuide';
import { CameraPreview } from '@/features/registration/verification/CameraPreview';
import { CameraPermissionStep } from '@/features/registration/verification/CameraPermissionStep';
import { CaptureControls } from '@/features/registration/verification/CaptureControls';
import { CaptureProgress } from '@/features/registration/verification/CaptureProgress';
import { PreparationStep } from '@/features/registration/verification/PreparationStep';
import { VerificationCompleteStep } from '@/features/registration/verification/VerificationCompleteStep';
import { requiredCapturesPerAngle } from '@/features/registration/verification/constants';
import { VerificationShell } from '@/features/registration/verification/VerificationShell';
import { useCamera } from '@/features/registration/verification/useCamera';
import { useVerificationFlow } from '@/features/registration/verification/useVerificationFlow';
import type { VerificationStage } from '@/features/registration/verification/types';

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
  const [stage, setStage] = useState<VerificationStage>('preparation');
  const {
    angles,
    currentAngle,
    currentAngleIndex,
    currentAngleAccepted,
    currentCaptureIndex,
    capturesByAngle,
    feedback,
    statusLabel,
    captureState,
    validation,
    overallAccepted,
    totalRequired,
    progressPercent,
    isAutoCaptureEnabled,
    isAutoCaptureActive,
    isManualFallback,
    isComplete,
    captureManually,
    retakeCurrentShot,
    enableManualFallback,
    resumeAutoCapture,
  } = useVerificationFlow({
    streamActive,
    captureFrame,
    readFrameAnalysis,
  });

  useEffect(() => {
    if (stage === 'complete' || isComplete) {
      stopStream();
    }
  }, [isComplete, stage, stopStream]);

  const renderedStep = useMemo(() => {
    if (stage === 'preparation') {
      return (
        <PreparationStep
          tips={registrationPrepTips}
          onOpenCamera={() => setStage('permission')}
        />
      );
    }

    if (stage === 'permission') {
      return (
        <CameraPermissionStep
          status={permissionState}
          errorMessage={errorMessage}
          onAllowAccess={async () => {
            const granted = await requestAccess();

            if (granted) {
              setStage('capture');
            }
          }}
          onRetry={() => {
            resetPermission();
            requestAccess().then((granted) => {
              if (granted) {
                setStage('capture');
              }
            });
          }}
        />
      );
    }

    if (stage === 'capture' && !isComplete) {
      return (
        <VerificationShell
          title={currentAngle.title}
          description={currentAngle.guidance}
        >
          <div className="space-y-4">
            <CaptureProgress
              angleIndex={currentAngleIndex}
              totalAngles={angles.length}
              captureIndex={currentCaptureIndex}
              acceptedForAngle={currentAngleAccepted}
              overallAccepted={overallAccepted}
              totalRequired={totalRequired}
              progressPercent={progressPercent}
              capturesForAngle={capturesByAngle[currentAngle.id]}
              captureState={captureState}
            />

            <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
              <CameraPreview
                videoRef={videoRef}
                streamActive={streamActive}
                captureState={captureState}
                isAligned={validation.isCentered && validation.poseMatched}
              />

              <AngleGuide
                angle={currentAngle}
                feedback={feedback}
                captureState={captureState}
                statusLabel={statusLabel}
                validation={validation}
              />
            </div>

            <CaptureControls
              isAutoCaptureActive={isAutoCaptureActive}
              isAutoCaptureEnabled={isAutoCaptureEnabled}
              isManualFallback={isManualFallback}
              captureState={captureState}
              canRetake={currentAngleAccepted > 0}
              onManualCapture={captureManually}
              onRetake={retakeCurrentShot}
              onEnableManual={enableManualFallback}
              onResumeAuto={resumeAutoCapture}
            />

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Each angle requires {requiredCapturesPerAngle} accepted captures
              before moving forward.
            </p>
          </div>
        </VerificationShell>
      );
    }

    return <VerificationCompleteStep onFinish={onComplete} />;
  }, [
    angles.length,
    captureManually,
    capturesByAngle,
    currentAngle,
    currentAngleAccepted,
    currentAngleIndex,
    currentCaptureIndex,
    captureState,
    enableManualFallback,
    feedback,
    errorMessage,
    isAutoCaptureActive,
    isAutoCaptureEnabled,
    isManualFallback,
    onComplete,
    overallAccepted,
    permissionState,
    progressPercent,
    requestAccess,
    resetPermission,
    resumeAutoCapture,
    retakeCurrentShot,
    statusLabel,
    stage,
    streamActive,
    totalRequired,
    validation,
    videoRef,
    isComplete,
  ]);

  return (
    <div className="min-h-115 sm:min-h-130">
      <AnimatePresence
        mode="wait"
        initial={false}
      >
        <motion.div
          key={stage === 'capture' ? `${stage}-${currentAngleIndex}` : stage}
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
