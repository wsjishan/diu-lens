import { Camera } from 'lucide-react';
import type { RefCallback } from 'react';

import type { CaptureState } from '@/features/registration/verification/types';
import { cn } from '@/lib/utils';

type CameraPreviewProps = {
  videoRef: RefCallback<HTMLVideoElement>;
  streamActive: boolean;
  captureState: CaptureState;
  isAligned: boolean;
};

export function CameraPreview({
  videoRef,
  streamActive,
  captureState,
  isAligned,
}: CameraPreviewProps) {
  const readyOrCaptured =
    captureState === 'ready' || captureState === 'captured';

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border bg-slate-950 transition-all duration-250',
        readyOrCaptured
          ? 'border-emerald-300 shadow-[0_0_0_1px_rgba(16,185,129,0.25)] dark:border-emerald-500/50'
          : 'border-slate-200 dark:border-white/10'
      )}
    >
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
          Waiting for live camera stream...
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
        <div
          className={cn(
            'relative h-[70%] w-[72%] rounded-[999px] border-2 transition-colors',
            isAligned ? 'border-emerald-300/90' : 'border-white/80'
          )}
        >
          <div className="absolute -inset-3 rounded-[999px] border border-white/30" />
          <div
            className={cn(
              'absolute -bottom-5 left-1/2 h-2.5 w-40 -translate-x-1/2 rounded-full transition-colors',
              readyOrCaptured
                ? 'bg-emerald-300/90 animate-pulse'
                : 'bg-blue-300/80'
            )}
          />
        </div>
      </div>

      <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-xs font-medium text-white">
        <Camera className="size-3.5" />
        Live preview
      </div>
    </div>
  );
}
