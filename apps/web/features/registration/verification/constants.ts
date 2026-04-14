import type { VerificationAngle } from '@/features/registration/verification/types';

export const requiredCapturesPerAngle = 3;

export const verificationAngles: VerificationAngle[] = [
  {
    id: 'front',
    title: 'Look straight',
    guidance: 'Keep your face centered and hold still.',
    alignmentHint: ['Move closer', 'Face aligned', 'Hold still'],
  },
  {
    id: 'left',
    title: 'Turn slightly left',
    guidance: 'Turn your face a little to the left and hold steady.',
    alignmentHint: ['Turn a little left', 'Face aligned', 'Hold still'],
  },
  {
    id: 'right',
    title: 'Turn slightly right',
    guidance: 'Turn your face a little to the right and hold steady.',
    alignmentHint: ['Turn a little right', 'Face aligned', 'Hold still'],
  },
  {
    id: 'up',
    title: 'Look slightly up',
    guidance: 'Lift your chin slightly while keeping your face centered.',
    alignmentHint: ['Look a little up', 'Face aligned', 'Hold still'],
  },
  {
    id: 'down',
    title: 'Look slightly down',
    guidance: 'Lower your chin slightly and keep your face in frame.',
    alignmentHint: ['Look a little down', 'Face aligned', 'Hold still'],
  },
];

export const verificationPoses = verificationAngles;

export const validationTickMs = 380;
export const requiredStableTicks = 2;
export const autoCaptureDelayMs = 850;
export const betweenCapturePauseMs = 550;
export const captureConfirmedDisplayMs = 820;

export const poseCorrectionByAngle = {
  front: 'Look straight at the camera',
  left: 'Turn a little left',
  right: 'Turn a little right',
  up: 'Raise your chin slightly',
  down: 'Lower your chin slightly',
} as const;
