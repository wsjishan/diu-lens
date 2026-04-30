import type { VerificationAngle } from '@/features/registration/verification/types';

export const guidedAngles: VerificationAngle[] = [
  'front',
  'left',
  'right',
  'up',
  'down',
];
export const naturalFrontAngle: VerificationAngle = 'natural_front';
export const captureAngles: VerificationAngle[] = [...guidedAngles, naturalFrontAngle];
export const BURST_CAPTURE_FRAME_COUNT = 3;
export const NATURAL_FRONT_FRAME_COUNT = 2;

export function getRequiredFramesForAngle(angle: VerificationAngle): number {
  return angle === naturalFrontAngle
    ? NATURAL_FRONT_FRAME_COUNT
    : BURST_CAPTURE_FRAME_COUNT;
}

export const perAngleInstruction: Record<VerificationAngle, string> = {
  front: 'Look straight ahead with a neutral face.',
  left: 'Turn slightly left.',
  right: 'Turn slightly right.',
  up: 'Look slightly up.',
  down: 'Look slightly down.',
  natural_front: 'Look at the camera normally.',
};

export const perAngleHint: Record<VerificationAngle, string> = {
  front: 'Keep your face centered in the guide frame.',
  left: 'Do not rotate too far, a slight turn is enough.',
  right: 'Keep both eyes visible while turning.',
  up: 'Lift your chin just a little.',
  down: 'Lower your chin just a little.',
  natural_front: 'No strict pose needed. Keep one face visible.',
};

export const STABILITY_WINDOW_MS = 380;
export const POST_CAPTURE_COOLDOWN_MS = 420;
export const STABILITY_GRACE_MS = 280;
export const GUIDANCE_STICK_MS = 320;

export const MIN_FACE_AREA_RATIO = 0.09;
export const MAX_CENTER_OFFSET = 0.24;
export const HARD_MAX_CENTER_OFFSET = 0.32;
export const MIN_BLUR_VARIANCE = 45;
export const HARD_MIN_BLUR_VARIANCE = 30;
export const MIN_BRIGHTNESS = 80;
export const MAX_BRIGHTNESS = 180;
export const HARD_MIN_BRIGHTNESS = 60;
export const HARD_MAX_BRIGHTNESS = 210;

export const ANGLE_THRESHOLDS = {
  frontYawAbs: 12,
  frontPitchAbs: 12,
  leftYaw: 14,
  rightYaw: -14,
  upPitch: -10,
  downPitch: 10,
  sidePitchAbs: 18,
  verticalYawAbs: 16,
} as const;

export const captureStorageVersion = 3;
