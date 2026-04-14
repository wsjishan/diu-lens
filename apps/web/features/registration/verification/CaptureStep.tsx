import { Camera, CheckCircle2 } from 'lucide-react';
import type { RefObject } from 'react';

import { Button } from '@/components/ui/button';
import { VerificationShell } from '@/features/registration/verification/VerificationShell';
import type { VerificationPose } from '@/features/registration/verification/types';
import { cn } from '@/lib/utils';

type CaptureStepProps = {
  pose: VerificationPose;
  stepIndex: number;
  totalSteps: number;
  feedback: string;
  progress: number;
  isAutoCapturing: boolean;
  isCaptured: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
  streamActive: boolean;
  onManualCapture: () => void;
  onRetake: () => void;
};

export function CaptureStep({
  pose,
  stepIndex,
  totalSteps,
  feedback,
  progress,
  isAutoCapturing,
  isCaptured,
  videoRef,
  streamActive,
  onManualCapture,
  onRetake,
}: CaptureStepProps) {
  return (
    <VerificationShell
      title={pose.title}
      description={pose.guidance}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-medium uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
            <span>
              Pose {stepIndex + 1} of {totalSteps}
            </span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-200 dark:bg-white/10">
            <div
              className="h-full rounded-full bg-linear-to-r from-[#1e2a78] to-[#2f5bff] transition-all duration-200 ease-out dark:from-[#1e3a8a] dark:to-[#2563eb]"
              style={{ width: `${progress}%` }}
              aria-hidden="true"
            />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 dark:border-white/10">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="aspect-4/5 w-full object-cover transform-[scaleX(-1)]"
              aria-label="Live camera preview"
            />

            {!streamActive ? (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/85 px-4 text-center text-sm text-slate-200">
                Waiting for camera stream...
              </div>
            ) : null}

            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
              <div className="relative h-[70%] w-[72%] rounded-[999px] border-2 border-white/80">
                <div className="absolute -inset-3 rounded-[999px] border border-white/30" />
                <div
                  className={cn(
                    'absolute -bottom-5 left-1/2 h-2.5 w-40 -translate-x-1/2 rounded-full transition-colors',
                    isCaptured ? 'bg-emerald-300/90' : 'bg-blue-300/80'
                  )}
                />
              </div>
            </div>

            <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-xs font-medium text-white">
              <Camera className="size-3.5" />
              Live preview
            </div>
          </div>

          <aside className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 dark:border-white/10 dark:bg-[#0b1220]">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
              Real-time feedback
            </p>
            <p className="text-sm leading-6 text-slate-700 dark:text-slate-300">
              {feedback}
            </p>
            <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-xs leading-5 text-slate-500 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-400">
              Auto-capture is enabled by default for each pose.
            </div>
          </aside>
        </div>

        <div className="sticky bottom-0 -mx-1 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white/95 p-2.5 backdrop-blur dark:border-white/10 dark:bg-slate-900/90">
          <Button
            type="button"
            variant="outline"
            onClick={onManualCapture}
            disabled={isCaptured}
            className="h-10 rounded-lg border-slate-300/90 px-3.5"
          >
            Capture Manually
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onRetake}
            className="h-10 rounded-lg px-3.5"
          >
            Retake
          </Button>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {isCaptured ? (
              <>
                <CheckCircle2 className="size-3.5 text-emerald-500" /> Captured
              </>
            ) : isAutoCapturing ? (
              'Auto-capturing...'
            ) : (
              'Waiting for alignment'
            )}
          </div>
        </div>
      </div>
    </VerificationShell>
  );
}
