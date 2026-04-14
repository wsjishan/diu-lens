import { CheckCircle2 } from 'lucide-react';
import Image from 'next/image';

import { requiredCapturesPerAngle } from '@/features/registration/verification/constants';
import type {
  CaptureState,
  CapturedFrame,
} from '@/features/registration/verification/types';
import { cn } from '@/lib/utils';

type CaptureProgressProps = {
  angleIndex: number;
  totalAngles: number;
  captureIndex: number;
  acceptedForAngle: number;
  overallAccepted: number;
  totalRequired: number;
  progressPercent: number;
  capturesForAngle: CapturedFrame[];
  captureState: CaptureState;
};

export function CaptureProgress({
  angleIndex,
  totalAngles,
  captureIndex,
  acceptedForAngle,
  overallAccepted,
  totalRequired,
  progressPercent,
  capturesForAngle,
  captureState,
}: CaptureProgressProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-medium uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
        <span>
          Angle {angleIndex + 1} of {totalAngles}
        </span>
        <span>{progressPercent}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-200 dark:bg-white/10">
        <div
          className="h-full rounded-full bg-linear-to-r from-[#1e2a78] to-[#2f5bff] transition-all duration-200 ease-out dark:from-[#1e3a8a] dark:to-[#2563eb]"
          style={{ width: `${progressPercent}%` }}
          aria-hidden="true"
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 dark:border-white/10 dark:bg-slate-900/60">
        <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
          Capture {captureIndex} of {requiredCapturesPerAngle}
        </p>
        <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
          Accepted shots: {acceptedForAngle} / {requiredCapturesPerAngle}
        </p>
        <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
          Total captured: {overallAccepted} / {totalRequired}
        </p>
        {captureState === 'captured' ? (
          <p className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="size-3" />
            Valid shot accepted
          </p>
        ) : null}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: requiredCapturesPerAngle }).map((_, index) => {
          const captured = capturesForAngle[index];

          return (
            <div
              key={`slot-${index}`}
              className={cn(
                'relative overflow-hidden rounded-lg border bg-slate-100 aspect-square dark:bg-slate-900/50',
                captured
                  ? 'border-emerald-300 dark:border-emerald-500/50'
                  : 'border-slate-200 dark:border-white/10'
              )}
            >
              {captured ? (
                <>
                  <Image
                    src={captured.dataUrl}
                    alt={`Accepted capture ${index + 1}`}
                    className="h-full w-full object-cover"
                    width={120}
                    height={120}
                    unoptimized
                  />
                  <span className="absolute right-1 top-1 rounded-full bg-emerald-500/90 p-0.5 text-white">
                    <CheckCircle2 className="size-3" />
                  </span>
                </>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-slate-400">
                  Shot {index + 1}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
