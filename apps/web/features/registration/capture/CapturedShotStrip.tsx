import { RefreshCw } from 'lucide-react';
import Image from 'next/image';

import {
  captureAngles,
  getRequiredFramesForAngle,
} from '@/features/registration/capture/constants';
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
  natural_front: 'Natural',
};

const angleOrder: VerificationAngle[] = captureAngles;

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
      <p className="text-xs font-semibold tracking-[0.03em] text-slate-600 uppercase max-[639px]:text-[#84a0bc]">
        Captured Shots
      </p>

      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${angleOrder.length}, minmax(0, 1fr))` }}>
        {angleOrder.map((angle) => {
          const shots = capturedShots[angle];
          const shot = shots[shots.length - 1];
          const requiredFrames = getRequiredFramesForAngle(angle);
          const completed = shots.length >= requiredFrames;
          const active = currentAngle === angle;

          return (
            <div
              key={angle}
              className={cn(
                'rounded-3xl border p-1.5 transition-colors',
                shot
                  ? 'border-slate-300 bg-white max-[639px]:border-[#385775] max-[639px]:bg-[#11263b]'
                  : active
                    ? 'border-blue-400/70 bg-blue-50 max-[639px]:border-[#4f94de] max-[639px]:bg-[#123d67]'
                    : 'border-slate-200/90 bg-slate-100/80 max-[639px]:border-[#2a4360] max-[639px]:bg-[#0d2235]'
              )}
            >
              <button
                type="button"
                onClick={() => onFocus(angle)}
                className="w-full text-left"
              >
                <div className="mb-1 text-[10px] font-semibold tracking-[0.02em] text-slate-600 uppercase max-[639px]:text-[#8fa7bf]">
                  {angleLabel[angle]} {shots.length}/{requiredFrames}
                </div>

                <div className="relative aspect-square overflow-hidden rounded-full border-2 border-slate-200 bg-slate-900/90 max-[639px]:border-[#2d4764]">
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
                    <div className="flex h-full items-center justify-center text-[10px] font-medium text-slate-300 max-[639px]:text-[#6f89a4]">
                      Pending
                    </div>
                  )}
                </div>
              </button>

              {completed ? (
                <p className="mt-1 text-[10px] font-semibold text-emerald-700 max-[639px]:text-emerald-300">
                  Ready
                </p>
              ) : null}

              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onRetake(angle)}
                disabled={!shots.length}
                className="mt-1.5 h-7 w-full px-2 text-[10px] text-slate-600 hover:bg-slate-100 max-[639px]:text-[#96adbf] max-[639px]:hover:bg-[#1a3047]"
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
