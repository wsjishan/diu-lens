import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  autoCaptureDelayMs,
  betweenCapturePauseMs,
  captureConfirmedDisplayMs,
  requiredCapturesPerAngle,
  verificationAngles,
} from '@/features/registration/verification/constants';
import { useCaptureValidation } from '@/features/registration/verification/useCaptureValidation';
import type {
  CaptureState,
  CaptureSource,
  CaptureValidation,
  CapturedFrame,
  CapturesByAngle,
  FrameAnalysis,
  VerificationAngle,
  VerificationAngleId,
} from '@/features/registration/verification/types';

type VerificationFlowState = {
  angles: VerificationAngle[];
  currentAngle: VerificationAngle;
  currentAngleIndex: number;
  currentAngleAccepted: number;
  currentCaptureIndex: number;
  capturesByAngle: CapturesByAngle;
  feedback: string;
  statusLabel: string;
  captureState: CaptureState;
  validation: CaptureValidation;
  canCapture: boolean;
  rejectedMessage: string | null;
  lastAcceptedAt: number | null;
  overallAccepted: number;
  totalRequired: number;
  progressPercent: number;
  isAutoCaptureEnabled: boolean;
  isAutoCaptureActive: boolean;
  isManualFallback: boolean;
  isComplete: boolean;
  captureManually: () => void;
  retakeCurrentShot: () => void;
  enableManualFallback: () => void;
  resumeAutoCapture: () => void;
};

function createInitialCaptureMap(): CapturesByAngle {
  return {
    front: [],
    left: [],
    right: [],
    up: [],
    down: [],
  };
}

function makeCaptureId(angleId: VerificationAngleId) {
  return `${angleId}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

type UseVerificationFlowOptions = {
  streamActive: boolean;
  captureFrame: () => string | null;
  readFrameAnalysis: () => FrameAnalysis | null;
};

export function useVerificationFlow({
  streamActive,
  captureFrame,
  readFrameAnalysis,
}: UseVerificationFlowOptions): VerificationFlowState {
  const [capturesByAngle, setCapturesByAngle] = useState<CapturesByAngle>(
    createInitialCaptureMap
  );
  const [currentAngleIndex, setCurrentAngleIndex] = useState(0);
  const [isAutoCaptureEnabled, setIsAutoCaptureEnabled] = useState(true);
  const [isManualFallback, setIsManualFallback] = useState(false);
  const [rejectedMessage, setRejectedMessage] = useState<string | null>(null);
  const [lastAcceptedAt, setLastAcceptedAt] = useState<number | null>(null);

  const currentAngle = verificationAngles[currentAngleIndex];
  const currentAngleAccepted = capturesByAngle[currentAngle.id].length;
  const totalRequired = verificationAngles.length * requiredCapturesPerAngle;

  const overallAccepted = useMemo(
    () =>
      verificationAngles.reduce(
        (total, angle) => total + capturesByAngle[angle.id].length,
        0
      ),
    [capturesByAngle]
  );

  const progressPercent = Math.round((overallAccepted / totalRequired) * 100);
  const isComplete = overallAccepted >= totalRequired;
  const recentlyCaptured = lastAcceptedAt !== null;

  const { validation, captureState, primaryMessage, statusLabel } =
    useCaptureValidation({
      streamActive,
      angle: currentAngle,
      acceptedForAngle: currentAngleAccepted,
      recentlyCaptured,
      readFrameAnalysis,
    });

  const feedback = rejectedMessage ?? primaryMessage;
  const canCapture = validation.canCapture;
  const isAutoCaptureActive =
    streamActive &&
    !isComplete &&
    isAutoCaptureEnabled &&
    !isManualFallback &&
    currentAngleAccepted < requiredCapturesPerAngle &&
    validation.canCapture;

  useEffect(() => {
    if (!rejectedMessage) {
      return;
    }

    const timer = window.setTimeout(() => {
      setRejectedMessage(null);
    }, 1200);

    return () => {
      window.clearTimeout(timer);
    };
  }, [rejectedMessage]);

  const acceptCapture = useCallback(
    (source: CaptureSource) => {
      if (!streamActive || isComplete) {
        return;
      }

      if (!validation.canCapture) {
        setRejectedMessage(primaryMessage);
        return;
      }

      const frameDataUrl = captureFrame();
      if (!frameDataUrl) {
        setRejectedMessage(
          'Unable to capture frame. Please hold still and retry.'
        );
        return;
      }

      const capture: CapturedFrame = {
        id: makeCaptureId(currentAngle.id),
        angleId: currentAngle.id,
        source,
        dataUrl: frameDataUrl,
        capturedAt: Date.now(),
      };

      const nextCount = currentAngleAccepted + 1;

      setCapturesByAngle((current) => ({
        ...current,
        [currentAngle.id]: [...current[currentAngle.id], capture],
      }));
      setRejectedMessage(null);
      setLastAcceptedAt(Date.now());

      if (nextCount >= requiredCapturesPerAngle) {
        const hasNextAngle = currentAngleIndex < verificationAngles.length - 1;

        if (hasNextAngle) {
          window.setTimeout(() => {
            setCurrentAngleIndex((index) => index + 1);
          }, betweenCapturePauseMs);
        }
        return;
      }
    },
    [
      captureFrame,
      currentAngle.id,
      currentAngleAccepted,
      currentAngleIndex,
      isComplete,
      primaryMessage,
      streamActive,
      validation.canCapture,
    ]
  );

  const captureManually = useCallback(() => {
    if (isComplete) {
      return;
    }

    setIsManualFallback(true);
    setIsAutoCaptureEnabled(false);
    acceptCapture('manual');
  }, [acceptCapture, isComplete]);

  const retakeCurrentShot = useCallback(() => {
    if (currentAngleAccepted === 0 || isComplete) {
      return;
    }

    setCapturesByAngle((current) => ({
      ...current,
      [currentAngle.id]: current[currentAngle.id].slice(0, -1),
    }));
    setLastAcceptedAt(null);
    setRejectedMessage('Latest shot removed. Capture again when ready.');
  }, [currentAngle.id, currentAngleAccepted, isComplete]);

  const enableManualFallback = useCallback(() => {
    setIsManualFallback(true);
    setIsAutoCaptureEnabled(false);
  }, []);

  const resumeAutoCapture = useCallback(() => {
    if (isComplete) {
      return;
    }

    setIsManualFallback(false);
    setIsAutoCaptureEnabled(true);
  }, [isComplete]);

  useEffect(() => {
    if (!isAutoCaptureActive) {
      return;
    }

    const captureTimer = window.setTimeout(() => {
      acceptCapture('auto');
    }, autoCaptureDelayMs);

    return () => {
      window.clearTimeout(captureTimer);
    };
  }, [acceptCapture, isAutoCaptureActive]);

  useEffect(() => {
    if (!lastAcceptedAt) {
      return;
    }

    const timer = window.setTimeout(() => {
      setLastAcceptedAt(null);
    }, captureConfirmedDisplayMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [lastAcceptedAt]);

  return {
    angles: verificationAngles,
    currentAngle,
    currentAngleIndex,
    currentAngleAccepted,
    currentCaptureIndex: Math.min(
      currentAngleAccepted + 1,
      requiredCapturesPerAngle
    ),
    capturesByAngle,
    feedback,
    statusLabel,
    captureState,
    validation,
    canCapture,
    rejectedMessage,
    lastAcceptedAt,
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
  };
}
