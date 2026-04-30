import { useMemo } from 'react';

import {
  captureAngles,
  getRequiredFramesForAngle,
} from '@/features/registration/capture/constants';
import type { CapturedShotsByAngle } from '@/features/registration/capture/types';
import type { VerificationAngle } from '@/features/registration/verification/types';

function getFirstMissingAngle(capturedShots: CapturedShotsByAngle): VerificationAngle {
  const missing = captureAngles.find(
    (angle) => capturedShots[angle].length < getRequiredFramesForAngle(angle)
  );
  return missing ?? captureAngles[captureAngles.length - 1];
}

export function useAngleProgress(
  capturedShots: CapturedShotsByAngle,
  activeAngle: VerificationAngle | null
) {
  return useMemo(() => {
    const capturedCount = captureAngles.reduce(
      (total, angle) =>
        total +
        (capturedShots[angle].length >= getRequiredFramesForAngle(angle) ? 1 : 0),
      0
    );
    const canSubmit = capturedCount === captureAngles.length;
    const fallbackAngle = getFirstMissingAngle(capturedShots);
    const currentAngle = canSubmit ? captureAngles[captureAngles.length - 1] : activeAngle ?? fallbackAngle;
    const currentAngleIndex = Math.max(
      0,
      captureAngles.findIndex((angle) => angle === currentAngle)
    );

    return {
      capturedCount,
      canSubmit,
      currentAngle,
      currentAngleIndex,
      firstMissingAngle: fallbackAngle,
      progressLabel: `${Math.min(capturedCount, captureAngles.length)} / ${captureAngles.length}`,
    };
  }, [activeAngle, capturedShots]);
}
