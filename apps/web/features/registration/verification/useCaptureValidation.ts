import { useEffect, useMemo, useState } from 'react';

import {
  autoCaptureDelayMs,
  poseCorrectionByAngle,
  requiredCapturesPerAngle,
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

function detectDirection(analysis: FrameAnalysis) {
  const horizontal = analysis.horizontalBalance + analysis.faceOffsetX * 0.8;
  const vertical = analysis.verticalBalance - analysis.faceOffsetY * 0.65;

  const horizontalThreshold = 0.04;
  const verticalThreshold = 0.035;

  const strongestHorizontal = Math.abs(horizontal) >= Math.abs(vertical);

  if (strongestHorizontal && horizontal > horizontalThreshold) {
    return 'left' as const;
  }

  if (strongestHorizontal && horizontal < -horizontalThreshold) {
    return 'right' as const;
  }

  if (!strongestHorizontal && vertical > verticalThreshold) {
    return 'up' as const;
  }

  if (!strongestHorizontal && vertical < -verticalThreshold) {
    return 'down' as const;
  }

  return 'front' as const;
}

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
    if (!streamActive || acceptedForAngle >= requiredCapturesPerAngle) {
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
      const detectedDirection = detectDirection(nextAnalysis);

      const poseMatched = detectedDirection === angle.id;

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
        detectedDirection: null,
        isSharpEnough: false,
        lightingOk: false,
        isStable: false,
        holdProgress: 0,
        canCapture: false,
      };
    }

    const faceDetected = analysis.sharpness > 0.08 && analysis.contrast > 0.06;
    const lightingOk = analysis.brightness > 0.24 && analysis.brightness < 0.88;
    const isCentered = analysis.centerContrastRatio > 0.88;
    const detectedDirection = detectDirection(analysis);
    const poseMatched = detectedDirection === angle.id;

    const isSharpEnough = analysis.sharpness > 0.1;
    const isStable =
      stableTicks >= requiredStableTicks && analysis.motion < 0.03;
    const holdTicksNeeded = Math.max(
      requiredStableTicks,
      Math.ceil(autoCaptureDelayMs / validationTickMs)
    );
    const holdProgress = Math.min(stableTicks / holdTicksNeeded, 1);

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
      detectedDirection,
      isSharpEnough,
      lightingOk,
      isStable,
      holdProgress,
      canCapture,
    };
  }, [analysis, angle.id, stableTicks, streamActive]);

  const status = useMemo(() => {
    if (acceptedForAngle >= requiredCapturesPerAngle) {
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
        primaryMessage:
          validation.detectedDirection && validation.detectedDirection !== 'front'
            ? `Detected: ${validation.detectedDirection}. ${poseCorrectionByAngle[angle.id]}`
            : poseCorrectionByAngle[angle.id],
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
        primaryMessage: 'Hold still for auto-capture.',
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
