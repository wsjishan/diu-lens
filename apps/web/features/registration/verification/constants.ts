import type { VerificationAngle } from '@/features/registration/verification/types';
import {
  BURST_CAPTURE_FRAME_COUNT,
  captureAngles,
  getRequiredFramesForAngle,
} from '@/features/registration/capture/constants';

export const verificationTitle = 'Face Verification';
export const verificationNote = 'Verification setup is being prepared.';

export const verificationAngles: VerificationAngle[] = captureAngles;

export const requiredShotsPerAngle = BURST_CAPTURE_FRAME_COUNT;
export const totalRequiredShots = verificationAngles.reduce(
  (total, angle) => total + getRequiredFramesForAngle(angle),
  0
);
