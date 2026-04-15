import type { RefCallback } from 'react';

type FacePreviewProps = {
  videoRef: RefCallback<HTMLVideoElement>;
  streamActive: boolean;
};

export function FacePreview({ videoRef, streamActive }: FacePreviewProps) {
  return (
    <div className="relative mx-auto aspect-square w-56 overflow-hidden rounded-full border border-border/80 bg-muted sm:w-64">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="h-full w-full object-cover transform-[scaleX(-1)]"
        aria-label="Live face preview"
      />

      {!streamActive ? (
        <div className="absolute inset-0 flex items-center justify-center bg-background/85 px-8 text-center text-sm font-medium text-muted-foreground">
          Waiting for camera stream
        </div>
      ) : null}
    </div>
  );
}
