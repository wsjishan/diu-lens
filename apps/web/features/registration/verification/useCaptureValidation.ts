import { useEffect, useMemo, useState } from 'react';

import {
  poseCorrectionByAngle,
  requiredStableTicks,
  validationTickMs,
} from '@/features/registration/verification/constants';
import type {
  CaptureState,
  CaptureValidation,
  FrameAnalysis,
  VerificationAngle,
} from '@/features/registration/verification/types';

type UseCaptureValidationOptions = {
  streamActive: boolean;
  angle: VerificationAngle;
  acceptedForAngle: number;
  recentlyCaptured: boolean;
  readFrameAnalysis: () => FrameAnalysis | null;
};

type CaptureValidationResult = {
  validation: CaptureValidation;
  captureState: CaptureState;
  primaryMessage: string;
  statusLabel: string;
};

export function useCaptureValidation({
  streamActive,
  angle,
  acceptedForAngle,
  recentlyCaptured,
  readFrameAnalysis,
}: UseCaptureValidationOptions): CaptureValidationResult {
  const [analysis, setAnalysis] = useState<FrameAnalysis | null>(null);
  const [stableTicks, setStableTicks] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAnalysis(null);
      setStableTicks(0);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [acceptedForAngle, angle.id]);

  useEffect(() => {
    if (!streamActive || acceptedForAngle >= 3) {
      return;
    }

    const timer = window.setInterval(() => {
      const nextAnalysis = readFrameAnalysis();

      if (!nextAnalysis) {
        return;
      }

      setAnalysis(nextAnalysis);

      const faceDetected =
        nextAnalysis.sharpness > 0.08 && nextAnalysis.contrast > 0.06;
      const lightingOk =
        nextAnalysis.brightness > 0.24 && nextAnalysis.brightness < 0.88;
      const isCentered = nextAnalysis.centerContrastRatio > 0.88;
      const isSharpEnough = nextAnalysis.sharpness > 0.1;

      const poseMatched =
        angle.id === 'front'
          ? Math.abs(nextAnalysis.horizontalBalance) < 0.05 &&
            Math.abs(nextAnalysis.verticalBalance) < 0.05
          : angle.id === 'left'
            ? nextAnalysis.horizontalBalance > 0.02
            : angle.id === 'right'
              ? nextAnalysis.horizontalBalance < -0.02
              : angle.id === 'up'
                ? nextAnalysis.verticalBalance > 0.02
                : nextAnalysis.verticalBalance < -0.02;

      const enoughForStability =
        faceDetected &&
        lightingOk &&
        isCentered &&
        poseMatched &&
        isSharpEnough;

      setStableTicks((value) => {
        if (!enoughForStability) {
          return 0;
        }

        return nextAnalysis.motion < 0.03 ? value + 1 : 0;
      });
    }, validationTickMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [acceptedForAngle, angle.id, readFrameAnalysis, streamActive]);

  const validation = useMemo<CaptureValidation>(() => {
    if (!streamActive || !analysis) {
      return {
        faceDetected: false,
        isCentered: false,
        poseMatched: false,
        isSharpEnough: false,
        lightingOk: false,
        isStable: false,
        canCapture: false,
      };
    }

    const faceDetected = analysis.sharpness > 0.08 && analysis.contrast > 0.06;
    const lightingOk = analysis.brightness > 0.24 && analysis.brightness < 0.88;
    const isCentered = analysis.centerContrastRatio > 0.88;

    const poseMatched =
      angle.id === 'front'
        ? Math.abs(analysis.horizontalBalance) < 0.05 &&
          Math.abs(analysis.verticalBalance) < 0.05
        : angle.id === 'left'
          ? analysis.horizontalBalance > 0.02
          : angle.id === 'right'
            ? analysis.horizontalBalance < -0.02
            : angle.id === 'up'
              ? analysis.verticalBalance > 0.02
              : analysis.verticalBalance < -0.02;

    const isSharpEnough = analysis.sharpness > 0.1;
    const isStable =
      stableTicks >= requiredStableTicks && analysis.motion < 0.03;
    const canCapture =
      faceDetected &&
      isCentered &&
      poseMatched &&
      isSharpEnough &&
      lightingOk &&
      isStable;

    return {
      faceDetected,
      isCentered,
      poseMatched,
      isSharpEnough,
      lightingOk,
      isStable,
      canCapture,
    };
  }, [analysis, angle.id, stableTicks, streamActive]);

  const status = useMemo(() => {
    if (acceptedForAngle >= 3) {
      return {
        captureState: 'angle-complete' as const,
        statusLabel: 'Angle complete',
        primaryMessage: 'Angle complete. Preparing next instruction.',
      };
    }

    if (!streamActive) {
      return {
        captureState: 'waiting' as const,
        statusLabel: 'Waiting',
        primaryMessage: 'Enable your camera to begin validation.',
      };
    }

    if (recentlyCaptured) {
      return {
        captureState: 'captured' as const,
        statusLabel: 'Captured',
        primaryMessage: 'Valid capture accepted.',
      };
    }

    if (!validation.faceDetected) {
      return {
        captureState: 'aligning' as const,
        statusLabel: 'Aligning',
        primaryMessage: 'Move your face into view.',
      };
    }

    if (!validation.lightingOk) {
      return {
        captureState: 'aligning' as const,
        statusLabel: 'Aligning',
        primaryMessage: 'Lighting too low.',
      };
    }

    if (!validation.isCentered) {
      return {
        captureState: 'aligning' as const,
        statusLabel: 'Aligning',
        primaryMessage: 'Center your face in the guide.',
      };
    }

    if (!validation.poseMatched) {
      return {
        captureState: 'aligning' as const,
        statusLabel: 'Aligning',
        primaryMessage: poseCorrectionByAngle[angle.id],
      };
    }

    if (!validation.isSharpEnough) {
      return {
        captureState: 'aligning' as const,
        statusLabel: 'Aligning',
        primaryMessage: 'Hold your device steady for a sharper image.',
      };
    }

    if (!validation.isStable) {
      return {
        captureState: 'aligning' as const,
        statusLabel: 'Aligning',
        primaryMessage: 'Hold still.',
      };
    }

    return {
      captureState: 'ready' as const,
      statusLabel: 'Ready',
      primaryMessage: 'Ready for auto-capture.',
    };
  }, [acceptedForAngle, angle.id, recentlyCaptured, streamActive, validation]);

  return {
    validation,
    captureState: status.captureState,
    primaryMessage: status.primaryMessage,
    statusLabel: status.statusLabel,
  };
}
