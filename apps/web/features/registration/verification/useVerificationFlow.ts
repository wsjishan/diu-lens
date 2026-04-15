import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
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
  step: number;
  currentAngleIndex: number;
  currentAngleAccepted: number;
  currentCaptureIndex: number;
  capture: number;
  capturesByAngle: CapturesByAngle;
  capturedImages: CapturedFrame[];
  feedback: string;
  statusLabel: string;
  captureState: CaptureState;
  validation: CaptureValidation;
  canCapture: boolean;
  rejectedMessage: string | null;
  lastAcceptedAt: number | null;
  overallAccepted: number;
  totalRequired: number;
  progress: number;
  progressPercent: number;
  isAutoCaptureEnabled: boolean;
  isAutoCaptureActive: boolean;
  isCapturing: boolean;
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
  const [isCapturing, setIsCapturing] = useState(false);
  const [rejectedMessage, setRejectedMessage] = useState<string | null>(null);
  const [lastAcceptedAt, setLastAcceptedAt] = useState<number | null>(null);
  const [frame, setFrame] = useState<FrameAnalysis | null>(null);
  const lastCaptureTimeRef = useRef(0);
  const CAPTURE_COOLDOWN = 1000;

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

  const capturedImages = useMemo(
    () =>
      verificationAngles
        .flatMap((angle) => capturesByAngle[angle.id])
        .sort((a, b) => {
          return a.capturedAt - b.capturedAt;
        }),
    [capturesByAngle]
  );

  const progressPercent = Math.round((overallAccepted / totalRequired) * 100);
  const progress = progressPercent;
  const isComplete = overallAccepted >= totalRequired;

  useEffect(() => {
    if (!streamActive || isComplete) {
      return;
    }

    let frameRequest = 0;
    let mounted = true;

    const readNextFrame = () => {
      if (!mounted) {
        return;
      }

      setFrame(readFrameAnalysis());
      frameRequest = window.requestAnimationFrame(readNextFrame);
    };

    frameRequest = window.requestAnimationFrame(readNextFrame);

    return () => {
      mounted = false;
      if (frameRequest) {
        window.cancelAnimationFrame(frameRequest);
      }
    };
  }, [isComplete, readFrameAnalysis, streamActive]);

  const inferredFace = useMemo(() => {
    if (!frame) {
      return null;
    }

    if (frame.contrast < 0.06 || frame.sharpness < 0.08) {
      return null;
    }

    return {
      x: (frame.faceOffsetX + 1) / 2,
      y: (frame.faceOffsetY + 1) / 2,
    };
  }, [frame]);

  const yaw = useMemo(() => {
    if (!frame) {
      return 0;
    }

    return -(frame.horizontalBalance + frame.faceOffsetX * 0.8) * 100;
  }, [frame]);

  const pitch = useMemo(() => {
    if (!frame) {
      return 0;
    }

    return -(frame.verticalBalance - frame.faceOffsetY * 0.65) * 100;
  }, [frame]);

  const { validation, captureState, primaryMessage, statusLabel } =
    useCaptureValidation({
      face: inferredFace,
      yaw,
      pitch,
      frame,
      currentAngle: currentAngle.id,
    });

  const feedback = rejectedMessage ?? validation.feedback ?? primaryMessage;
  const canCapture = validation.canCapture;
  const isAutoCaptureActive =
    streamActive &&
    !isComplete &&
    isAutoCaptureEnabled &&
    !isManualFallback &&
    currentAngleAccepted < requiredCapturesPerAngle;

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
        setIsCapturing(false);
        return;
      }

      if (!validation.canCapture) {
        setRejectedMessage(validation.feedback || primaryMessage);
        setIsCapturing(false);
        return;
      }

      const frameDataUrl = captureFrame();
      if (!frameDataUrl) {
        setRejectedMessage(
          'Unable to capture frame. Please hold still and retry.'
        );
        setIsCapturing(false);
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
        setIsCapturing(false);
        return;
      }

      setIsCapturing(false);
    },
    [
      captureFrame,
      currentAngle.id,
      currentAngleAccepted,
      currentAngleIndex,
      isComplete,
      primaryMessage,
      streamActive,
      validation.feedback,
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
    if (!isAutoCaptureActive || isCapturing || !validation.canCapture) {
      return;
    }

    const now = Date.now();
    if (now - lastCaptureTimeRef.current < CAPTURE_COOLDOWN) {
      return;
    }

    const timer = window.setTimeout(() => {
      lastCaptureTimeRef.current = Date.now();
      setIsCapturing(true);
      acceptCapture('auto');
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    acceptCapture,
    currentAngleAccepted,
    currentAngle.id,
    isAutoCaptureActive,
    isCapturing,
    validation.canCapture,
  ]);

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
    step: currentAngleIndex,
    currentAngleIndex,
    currentAngleAccepted,
    currentCaptureIndex: Math.min(
      currentAngleAccepted + 1,
      requiredCapturesPerAngle
    ),
    capture: Math.min(currentAngleAccepted + 1, requiredCapturesPerAngle),
    capturesByAngle,
    capturedImages,
    feedback,
    statusLabel,
    captureState,
    validation,
    canCapture,
    rejectedMessage,
    lastAcceptedAt,
    overallAccepted,
    totalRequired,
    progress,
    progressPercent,
    isAutoCaptureEnabled,
    isAutoCaptureActive,
    isCapturing,
    isManualFallback,
    isComplete,
    captureManually,
    retakeCurrentShot,
    enableManualFallback,
    resumeAutoCapture,
  };
}
