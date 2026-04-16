import { useEffect, useMemo, useRef, useState } from 'react';

import type {
  CaptureState,
  CaptureValidation,
  FrameAnalysis,
  VerificationAngleId,
} from '@/features/registration/verification/types';

export type ValidationState = {
  faceDetected: boolean;
  isCentered: boolean;
  poseMatched: boolean;
  isStable: boolean;
  lightingOk: boolean;
  isSharpEnough: boolean;
  canCapture: boolean;
  feedback: string;
};

type FacePosition = {
  x: number;
  y: number;
};

type UseCaptureValidationOptions = {
  face: FacePosition | null;
  yaw: number;
  pitch: number;
  frame: FrameAnalysis | null;
  currentAngle: VerificationAngleId;
  relaxThresholdsEnabled?: boolean;
};

type CaptureValidationResult = {
  validation: CaptureValidation;
  captureState: CaptureState;
  primaryMessage: string;
  statusLabel: string;
};

const stabilityTickMs = 33;
const requiredStableTimeMs = 450;
const requiredPoseHoldMs = 650;
const sharpnessThreshold = 16;

const relaxedRequiredStableTimeMs = 300;
const relaxedRequiredPoseHoldMs = 350;

function getPoseInstruction(angle: VerificationAngleId) {
  switch (angle) {
    case 'front':
      return 'Look straight';
    case 'left':
      return 'Turn a little more left';
    case 'right':
      return 'Turn a little more right';
    case 'up':
      return 'Raise your chin slightly';
    case 'down':
      return 'Lower your chin slightly';
    default:
      return 'Adjust your pose';
  }
}

function getPoseWindow(
  angle: VerificationAngleId,
  relaxThresholdsEnabled: boolean
) {
  if (relaxThresholdsEnabled) {
    switch (angle) {
      case 'front':
        return {
          yaw: [-20, 20] as [number, number],
          pitch: [-16, 16] as [number, number],
        };
      case 'left':
        return {
          yaw: [-42, -10] as [number, number],
          pitch: null,
        };
      case 'right':
        return {
          yaw: [10, 42] as [number, number],
          pitch: null,
        };
      case 'up':
        return {
          yaw: null,
          pitch: [-28, -6] as [number, number],
        };
      case 'down':
        return {
          yaw: null,
          pitch: [6, 28] as [number, number],
        };
      default:
        return {
          yaw: null,
          pitch: null,
        };
    }
  }

  switch (angle) {
    case 'front':
      return {
        yaw: [-12, 12] as [number, number],
        pitch: [-10, 10] as [number, number],
      };
    case 'left':
      return {
        yaw: [-35, -15] as [number, number],
        pitch: null,
      };
    case 'right':
      return {
        yaw: [15, 35] as [number, number],
        pitch: null,
      };
    case 'up':
      return {
        yaw: null,
        pitch: [-22, -8] as [number, number],
      };
    case 'down':
      return {
        yaw: null,
        pitch: [8, 22] as [number, number],
      };
    default:
      return {
        yaw: null,
        pitch: null,
      };
  }
}

function checkPose(
  angle: VerificationAngleId,
  yaw: number,
  pitch: number,
  relaxThresholdsEnabled: boolean
) {
  const window = getPoseWindow(angle, relaxThresholdsEnabled);

  const yawOk = window.yaw
    ? yaw >= window.yaw[0] && yaw <= window.yaw[1]
    : true;
  const pitchOk = window.pitch
    ? pitch >= window.pitch[0] && pitch <= window.pitch[1]
    : true;

  return yawOk && pitchOk;
}

function getBlockingReason({
  faceDetected,
  isCentered,
  poseMatched,
  isStable,
  lightingOk,
  isSharpEnough,
  poseHoldSatisfied,
}: {
  faceDetected: boolean;
  isCentered: boolean;
  poseMatched: boolean;
  isStable: boolean;
  lightingOk: boolean;
  isSharpEnough: boolean;
  poseHoldSatisfied: boolean;
}) {
  if (!faceDetected) return 'no-face';
  if (!isCentered) return 'not-centered';
  if (!poseMatched) return 'wrong-pose';
  if (!isStable) return 'unstable';
  if (!lightingOk) return 'bad-lighting';
  if (!isSharpEnough) return 'blurry';
  if (!poseHoldSatisfied) return 'pose-hold-not-satisfied';
  return 'ready';
}

function getAverageBrightness(frame: FrameAnalysis | null) {
  if (!frame) {
    return 0;
  }

  return frame.brightness * 255;
}

function varianceOfLaplacian(frame: FrameAnalysis | null) {
  if (!frame) {
    return 0;
  }

  // Camera analysis does not expose laplacian directly, so we map sharpness.
  return frame.sharpness * 1000;
}

export function useCaptureValidation({
  face,
  yaw,
  pitch,
  frame,
  currentAngle,
  relaxThresholdsEnabled = false,
}: UseCaptureValidationOptions): CaptureValidationResult {
  const poseWindow = getPoseWindow(currentAngle, relaxThresholdsEnabled);
  const activeRequiredStableTimeMs = relaxThresholdsEnabled
    ? relaxedRequiredStableTimeMs
    : requiredStableTimeMs;
  const activeRequiredPoseHoldMs = relaxThresholdsEnabled
    ? relaxedRequiredPoseHoldMs
    : requiredPoseHoldMs;

  const faceDetected = !!face;
  const isCentered =
    !!face && face.x > 0.3 && face.x < 0.7 && face.y > 0.3 && face.y < 0.7;
  const poseMatched = checkPose(
    currentAngle,
    yaw,
    pitch,
    relaxThresholdsEnabled
  );

  const stableTimeRef = useRef(0);
  const poseHoldTimeRef = useRef(0);
  const previousTickRef = useRef<number | null>(null);
  const [stableTime, setStableTime] = useState(0);
  const [poseHoldTime, setPoseHoldTime] = useState(0);

  useEffect(() => {
    previousTickRef.current = null;

    const timer = window.setInterval(() => {
      const now = performance.now();
      const previous = previousTickRef.current ?? now;
      const deltaTime = now - previous;
      previousTickRef.current = now;

      if (poseMatched && isCentered) {
        stableTimeRef.current += deltaTime;
      } else {
        stableTimeRef.current = 0;
      }

      if (
        poseMatched &&
        isCentered &&
        stableTimeRef.current > activeRequiredStableTimeMs
      ) {
        poseHoldTimeRef.current += deltaTime;
      } else {
        poseHoldTimeRef.current = 0;
      }

      setStableTime(stableTimeRef.current);
      setPoseHoldTime(poseHoldTimeRef.current);
    }, stabilityTickMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [activeRequiredStableTimeMs, isCentered, poseMatched]);

  const isStable = stableTime > activeRequiredStableTimeMs;
  const poseHoldSatisfied = poseHoldTime >= activeRequiredPoseHoldMs;

  const brightness = getAverageBrightness(frame);
  const lightingOk = brightness > 45 && brightness < 210;

  const sharpness = varianceOfLaplacian(frame);
  const isSharpEnough = sharpness > sharpnessThreshold;

  const canCapture =
    faceDetected &&
    isCentered &&
    poseMatched &&
    isStable &&
    poseHoldSatisfied &&
    lightingOk &&
    isSharpEnough;

  const blockingReason = getBlockingReason({
    faceDetected,
    isCentered,
    poseMatched,
    isStable,
    lightingOk,
    isSharpEnough,
    poseHoldSatisfied,
  });

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      return;
    }

    console.log('[verification-debug]', {
      source: 'validation',
      faceDetected,
      isCentered,
      poseMatched,
      isStable,
      poseHoldSatisfied,
      lightingOk,
      isSharpEnough,
      canCapture,
      blockingReason,
      expectedYawRange: poseWindow.yaw,
      expectedPitchRange: poseWindow.pitch,
      yaw,
      pitch,
      stabilityMs: Math.round(stableTime),
      requiredStabilityMs: activeRequiredStableTimeMs,
      poseHoldMs: Math.round(poseHoldTime),
      requiredPoseHoldMs: activeRequiredPoseHoldMs,
    });
  }, [
    activeRequiredPoseHoldMs,
    activeRequiredStableTimeMs,
    blockingReason,
    canCapture,
    faceDetected,
    isCentered,
    isSharpEnough,
    isStable,
    poseHoldSatisfied,
    lightingOk,
    poseMatched,
    poseWindow.pitch,
    poseWindow.yaw,
    poseHoldTime,
    pitch,
    stableTime,
    yaw,
  ]);

  let feedback = '';

  if (!faceDetected) {
    feedback = 'No face detected';
  } else if (!isCentered) {
    feedback = 'Center your face';
  } else if (!poseMatched) {
    feedback = getPoseInstruction(currentAngle);
  } else if (!isStable) {
    feedback = 'Hold still';
  } else if (!lightingOk) {
    feedback = 'Adjust lighting';
  } else if (!isSharpEnough) {
    feedback = 'Image too blurry';
  } else if (!poseHoldSatisfied) {
    feedback = 'Hold this angle';
  } else {
    feedback = 'Ready to capture';
  }

  const validation = useMemo<CaptureValidation>(
    () => ({
      faceDetected,
      isCentered,
      poseMatched,
      detectedDirection: poseMatched ? currentAngle : null,
      isSharpEnough,
      lightingOk,
      isStable,
      poseHoldSatisfied,
      stabilityMs: Math.round(stableTime),
      requiredStabilityMs: activeRequiredStableTimeMs,
      poseHoldMs: Math.round(poseHoldTime),
      requiredPoseHoldMs: activeRequiredPoseHoldMs,
      expectedYawRange: poseWindow.yaw,
      expectedPitchRange: poseWindow.pitch,
      holdProgress: Math.min(stableTime / activeRequiredStableTimeMs, 1),
      canCapture,
      feedback,
    }),
    [
      canCapture,
      currentAngle,
      faceDetected,
      feedback,
      isCentered,
      isSharpEnough,
      isStable,
      poseHoldSatisfied,
      lightingOk,
      poseMatched,
      poseHoldTime,
      poseWindow.pitch,
      poseWindow.yaw,
      activeRequiredPoseHoldMs,
      activeRequiredStableTimeMs,
      stableTime,
    ]
  );

  const captureState: CaptureState = canCapture
    ? 'ready'
    : faceDetected
      ? 'aligning'
      : 'waiting';

  return {
    validation,
    captureState,
    primaryMessage: feedback,
    statusLabel: canCapture ? 'Ready to capture' : 'Aligning',
  };
}
