import { Check } from 'lucide-react';

import { guidedAngles } from '@/features/registration/capture/constants';
import type { CapturedShotsByAngle } from '@/features/registration/capture/types';
import type { VerificationAngle } from '@/features/registration/verification/types';
import { cn } from '@/lib/utils';

const angleLabel: Record<VerificationAngle, string> = {
  front: 'Front',
  left: 'Left',
  right: 'Right',
  up: 'Up',
  down: 'Down',
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
      <div className="flex items-center justify-between text-xs font-semibold tracking-[0.03em] text-slate-600 uppercase">
        <span>Guided Angles</span>
        <span>{capturedCount} / {guidedAngles.length}</span>
      </div>

      <div className="grid grid-cols-5 gap-1.5">
        {guidedAngles.map((angle) => {
          const completed = Boolean(capturedShots[angle]);
          const active = !completed && angle === currentAngle;

          return (
            <div
              key={angle}
              className={cn(
                'flex items-center justify-center rounded-lg border px-2 py-2 text-xs font-semibold transition-colors',
                completed
                  ? 'border-emerald-500/45 bg-emerald-500/15 text-emerald-700'
                  : active
                    ? 'border-blue-400/80 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white/70 text-slate-500'
              )}
            >
              {completed ? <Check className="mr-1 size-3.5" /> : null}
              <span>{angleLabel[angle]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
