import { cn } from '@/lib/utils';

type CameraPreviewProps = {
  videoRef: (node: HTMLVideoElement | null) => void;
  streamActive: boolean;
  fallbackMessage?: string;
  className?: string;
};

export function CameraPreview({
  videoRef,
  streamActive,
  fallbackMessage,
  className,
}: CameraPreviewProps) {
  return (
    <div
      className={cn(
        'relative aspect-[3/4] w-full overflow-hidden rounded-[1.25rem] border border-slate-300/70 bg-slate-950/95 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.85)] max-[639px]:rounded-[0.76rem] max-[639px]:border-[#2e4b6a]',
        className
      )}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="h-full w-full object-cover [transform:scaleX(-1)]"
        aria-label="Live camera preview"
      />

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_37%,rgba(2,6,23,0.28)_80%)]" />

      {!streamActive && fallbackMessage ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/90 px-5 text-center text-sm font-medium text-slate-100">
          {fallbackMessage}
        </div>
      ) : null}
    </div>
  );
}
