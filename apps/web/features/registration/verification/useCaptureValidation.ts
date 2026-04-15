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
};

type CaptureValidationResult = {
  validation: CaptureValidation;
  captureState: CaptureState;
  primaryMessage: string;
  statusLabel: string;
};

const stabilityTickMs = 100;
const requiredStableTimeMs = 600;
const sharpnessThreshold = 80;

function getPoseInstruction(angle: VerificationAngleId) {
  switch (angle) {
    case 'front':
      return 'Look straight at the camera';
    case 'left':
      return 'Turn slightly left';
    case 'right':
      return 'Turn slightly right';
    case 'up':
      return 'Look slightly up';
    case 'down':
      return 'Look slightly down';
    default:
      return 'Adjust your pose';
  }
}

function checkPose(angle: VerificationAngleId, yaw: number, pitch: number) {
  switch (angle) {
    case 'front':
      return Math.abs(yaw) < 10 && Math.abs(pitch) < 10;
    case 'left':
      return yaw < -15 && yaw > -40;
    case 'right':
      return yaw > 15 && yaw < 40;
    case 'up':
      return pitch < -10;
    case 'down':
      return pitch > 10;
    default:
      return false;
  }
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
}: UseCaptureValidationOptions): CaptureValidationResult {
  const faceDetected = !!face;
  const isCentered =
    !!face && face.x > 0.3 && face.x < 0.7 && face.y > 0.3 && face.y < 0.7;
  const poseMatched = checkPose(currentAngle, yaw, pitch);

  const stableTimeRef = useRef(0);
  const previousTickRef = useRef<number | null>(null);
  const [stableTime, setStableTime] = useState(0);

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

      setStableTime(stableTimeRef.current);
    }, stabilityTickMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [isCentered, poseMatched]);

  const isStable = stableTime > requiredStableTimeMs;

  const brightness = getAverageBrightness(frame);
  const lightingOk = brightness > 60 && brightness < 200;

  const sharpness = varianceOfLaplacian(frame);
  const isSharpEnough = sharpness > sharpnessThreshold;

  const canCapture =
    faceDetected &&
    isCentered &&
    poseMatched &&
    isStable &&
    lightingOk &&
    isSharpEnough;

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      return;
    }

    console.log({
      faceDetected,
      isCentered,
      poseMatched,
      isStable,
      lightingOk,
      isSharpEnough,
      canCapture,
    });
  }, [
    canCapture,
    faceDetected,
    isCentered,
    isSharpEnough,
    isStable,
    lightingOk,
    poseMatched,
  ]);

  let feedback = '';

  if (!faceDetected) {
    feedback = 'No face detected';
  } else if (!isCentered) {
    feedback = 'Center your face';
  } else if (!poseMatched) {
    feedback = getPoseInstruction(currentAngle);
  } else if (!lightingOk) {
    feedback = 'Adjust lighting';
  } else if (!isSharpEnough) {
    feedback = 'Image too blurry';
  } else if (!isStable) {
    feedback = 'Hold still';
  } else {
    feedback = 'Ready';
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
      holdProgress: Math.min(stableTime / requiredStableTimeMs, 1),
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
      lightingOk,
      poseMatched,
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
    statusLabel: canCapture ? 'Ready' : 'Aligning',
  };
}
