import { CheckCircle2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { CaptureState } from '@/features/registration/verification/types';

type CaptureControlsProps = {
  isAutoCaptureActive: boolean;
  isAutoCaptureEnabled: boolean;
  isManualFallback: boolean;
  captureState: CaptureState;
  canRetake: boolean;
  onManualCapture: () => void;
  onRetake: () => void;
  onEnableManual: () => void;
  onResumeAuto: () => void;
};

export function CaptureControls({
  isAutoCaptureActive,
  isAutoCaptureEnabled,
  isManualFallback,
  captureState,
  canRetake,
  onManualCapture,
  onRetake,
  onEnableManual,
  onResumeAuto,
}: CaptureControlsProps) {
  return (
    <div className="sticky bottom-0 -mx-1 space-y-2 rounded-xl border border-slate-200 bg-white/95 p-2.5 backdrop-blur dark:border-white/10 dark:bg-slate-900/90">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onManualCapture}
          className="h-10 rounded-lg border-slate-300/90 px-3.5"
        >
          Capture Manually
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onRetake}
          disabled={!canRetake}
          className="h-10 rounded-lg px-3.5"
        >
          Retake Current Shot
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {captureState === 'captured' ? (
            <>
              <CheckCircle2 className="size-3.5 text-emerald-500" />
              Captured
            </>
          ) : captureState === 'ready' ? (
            isAutoCaptureActive ? (
              'Ready for auto-capture'
            ) : (
              'Ready to capture'
            )
          ) : captureState === 'aligning' ? (
            'Aligning'
          ) : captureState === 'waiting' ? (
            'Waiting for camera'
          ) : (
            <>
              <CheckCircle2 className="size-3.5 text-emerald-500" />
              Angle complete
            </>
          )}
        </div>

        {isAutoCaptureEnabled && !isManualFallback ? (
          <Button
            type="button"
            variant="ghost"
            onClick={onEnableManual}
            className="h-9 rounded-lg px-3 text-xs"
          >
            Switch to manual
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            onClick={onResumeAuto}
            className="h-9 rounded-lg px-3 text-xs"
          >
            Resume auto-capture
          </Button>
        )}
      </div>
    </div>
  );
}
