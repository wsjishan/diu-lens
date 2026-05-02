import { Check } from 'lucide-react';

import {
  captureAngles,
  getRequiredFramesForAngle,
} from '@/features/registration/capture/constants';
import type { CapturedShotsByAngle } from '@/features/registration/capture/types';
import type { VerificationAngle } from '@/features/registration/verification/types';
import { cn } from '@/lib/utils';

const angleLabel: Record<VerificationAngle, string> = {
  front: 'Front',
  left: 'Left',
  right: 'Right',
  up: 'Up',
  down: 'Down',
  natural_front: 'Natural',
};

type CaptureProgressProps = {
  capturedShots: CapturedShotsByAngle;
  currentAngle: VerificationAngle;
  capturedCount: number;
};

export function CaptureProgress({
  capturedShots,
  currentAngle,
  capturedCount,
}: CaptureProgressProps) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between text-xs font-semibold tracking-[0.03em] text-slate-600 uppercase max-[639px]:text-[#84a0bc]">
        <span>Capture Steps</span>
        <span>{capturedCount} / {captureAngles.length}</span>
      </div>

      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${captureAngles.length}, minmax(0, 1fr))` }}
      >
        {captureAngles.map((angle) => {
          const frameCount = capturedShots[angle].length;
          const requiredFrames = getRequiredFramesForAngle(angle);
          const completed = frameCount >= requiredFrames;
          const active = !completed && angle === currentAngle;

          return (
            <div
              key={angle}
              className={cn(
                'flex items-center justify-center rounded-lg border px-2 py-2 text-xs font-semibold transition-colors',
                completed
                  ? 'border-emerald-500/45 bg-emerald-500/15 text-emerald-700 max-[639px]:border-emerald-500/45 max-[639px]:bg-emerald-500/14 max-[639px]:text-emerald-200'
                  : active
                    ? 'border-blue-400/80 bg-blue-50 text-blue-700 max-[639px]:border-[#4c93df] max-[639px]:bg-[#123b64] max-[639px]:text-[#8ec6ff]'
                    : 'border-slate-200 bg-white/70 text-slate-500 max-[639px]:border-[#2b4562] max-[639px]:bg-[#0d2338] max-[639px]:text-[#7f95ad]'
              )}
            >
              {completed ? <Check className="mr-1 size-3.5" /> : null}
              <span>{angleLabel[angle]} {frameCount}/{requiredFrames}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
