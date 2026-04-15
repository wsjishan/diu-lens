import type { RefCallback } from 'react';

type CameraFeedProps = {
  videoRef: RefCallback<HTMLVideoElement>;
  streamActive: boolean;
  fallbackMessage?: string;
};

export function CameraFeed({
  videoRef,
  streamActive,
  fallbackMessage,
}: CameraFeedProps) {
  return (
    <div className="relative mx-auto aspect-square w-52 overflow-hidden rounded-full border border-border/75 bg-muted sm:w-56">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="h-full w-full object-cover transform-[scaleX(-1)]"
        aria-label="Live face preview"
      />

      {!streamActive && fallbackMessage ? (
        <div className="absolute inset-0 flex items-center justify-center bg-background/86 px-6 text-center text-sm font-medium text-muted-foreground">
          {fallbackMessage}
        </div>
      ) : null}
    </div>
  );
}
