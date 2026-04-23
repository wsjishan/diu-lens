import { RefreshCw } from 'lucide-react';
import Image from 'next/image';

import type { CapturedShotsByAngle } from '@/features/registration/capture/types';
import type { VerificationAngle } from '@/features/registration/verification/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const angleLabel: Record<VerificationAngle, string> = {
  front: 'Front',
  left: 'Left',
  right: 'Right',
  up: 'Up',
  down: 'Down',
};

const angleOrder: VerificationAngle[] = ['front', 'left', 'right', 'up', 'down'];

type CapturedShotStripProps = {
  capturedShots: CapturedShotsByAngle;
  currentAngle: VerificationAngle;
  onRetake: (angle: VerificationAngle) => void;
  onFocus: (angle: VerificationAngle) => void;
};

export function CapturedShotStrip({
  capturedShots,
  currentAngle,
  onRetake,
  onFocus,
}: CapturedShotStripProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold tracking-[0.03em] text-slate-600 uppercase">
        Captured Shots
      </p>

      <div className="grid grid-cols-5 gap-2">
        {angleOrder.map((angle) => {
          const shot = capturedShots[angle];
          const active = currentAngle === angle;

          return (
            <div
              key={angle}
              className={cn(
                'rounded-xl border p-1.5 transition-colors',
                shot
                  ? 'border-slate-300 bg-white'
                  : active
                    ? 'border-blue-400/70 bg-blue-50'
                    : 'border-slate-200/90 bg-slate-100/80'
              )}
            >
              <button
                type="button"
                onClick={() => onFocus(angle)}
                className="w-full text-left"
              >
                <div className="mb-1 text-[10px] font-semibold tracking-[0.02em] text-slate-600 uppercase">
                  {angleLabel[angle]}
                </div>

                <div className="relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-900/90">
                  {shot ? (
                    <Image
                      src={shot.previewUrl}
                      alt={`${angleLabel[angle]} capture preview`}
                      fill
                      unoptimized
                      sizes="96px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[10px] font-medium text-slate-300">
                      Pending
                    </div>
                  )}
                </div>
              </button>

              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onRetake(angle)}
                disabled={!shot}
                className="mt-1.5 h-7 w-full px-2 text-[10px] text-slate-600 hover:bg-slate-100"
              >
                <RefreshCw className="size-3" />
                Retake
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
