import type { VerificationAngle } from '@/features/registration/verification/types';

export const verificationTitle = 'Face Verification';
export const verificationNote = 'Verification setup is being prepared.';

export const verificationAngles: VerificationAngle[] = [
  'front',
  'left',
  'right',
  'up',
  'down',
];

export const requiredShotsPerAngle = 1;
export const totalRequiredShots =
  verificationAngles.length * requiredShotsPerAngle;
