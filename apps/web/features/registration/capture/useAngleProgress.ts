import { useMemo } from 'react';

import { guidedAngles } from '@/features/registration/capture/constants';
import type { CapturedShotsByAngle } from '@/features/registration/capture/types';
import type { VerificationAngle } from '@/features/registration/verification/types';

function getFirstMissingAngle(capturedShots: CapturedShotsByAngle): VerificationAngle {
  const missing = guidedAngles.find((angle) => capturedShots[angle] === null);
  return missing ?? guidedAngles[guidedAngles.length - 1];
}

export function useAngleProgress(
  capturedShots: CapturedShotsByAngle,
  activeAngle: VerificationAngle | null
) {
  return useMemo(() => {
    const capturedCount = guidedAngles.reduce(
      (total, angle) => total + (capturedShots[angle] ? 1 : 0),
      0
    );
    const canSubmit = capturedCount === guidedAngles.length;
    const fallbackAngle = getFirstMissingAngle(capturedShots);
    const currentAngle = canSubmit ? guidedAngles[guidedAngles.length - 1] : activeAngle ?? fallbackAngle;
    const currentAngleIndex = Math.max(
      0,
      guidedAngles.findIndex((angle) => angle === currentAngle)
    );

    return {
      capturedCount,
      canSubmit,
      currentAngle,
      currentAngleIndex,
      firstMissingAngle: fallbackAngle,
      progressLabel: `${Math.min(capturedCount, guidedAngles.length)} / ${guidedAngles.length}`,
    };
  }, [activeAngle, capturedShots]);
}
