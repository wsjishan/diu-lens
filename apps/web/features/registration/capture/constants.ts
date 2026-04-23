import type { VerificationAngle } from '@/features/registration/verification/types';

export const guidedAngles: VerificationAngle[] = [
  'front',
  'left',
  'right',
  'up',
  'down',
];

export const perAngleInstruction: Record<VerificationAngle, string> = {
  front: 'Look straight ahead with a neutral face.',
  left: 'Turn slightly left.',
  right: 'Turn slightly right.',
  up: 'Look slightly up.',
  down: 'Look slightly down.',
};

export const perAngleHint: Record<VerificationAngle, string> = {
  front: 'Keep your face centered in the guide frame.',
  left: 'Do not rotate too far, a slight turn is enough.',
  right: 'Keep both eyes visible while turning.',
  up: 'Lift your chin just a little.',
  down: 'Lower your chin just a little.',
};

export const STABILITY_WINDOW_MS = 450;
export const POST_CAPTURE_COOLDOWN_MS = 600;

export const MIN_FACE_AREA_RATIO = 0.08;
export const MAX_CENTER_OFFSET = 0.28;
export const MIN_BLUR_VARIANCE = 55;
export const MIN_BRIGHTNESS = 55;
export const MAX_BRIGHTNESS = 225;

export const ANGLE_THRESHOLDS = {
  frontYawAbs: 14,
  frontPitchAbs: 14,
  leftYaw: 7,
  rightYaw: -5,
  upPitch: -7,
  downPitch: 7,
  sidePitchAbs: 18,
  verticalYawAbs: 18,
} as const;

export const captureStorageVersion = 1;
