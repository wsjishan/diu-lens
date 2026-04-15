import { RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';

type VerificationControlsProps = {
  permissionBlocked: boolean;
  isRequestingPermission: boolean;
  isAutoCaptureActive: boolean;
  isAutoCaptureEnabled: boolean;
  isManualFallback: boolean;
  canCaptureNow: boolean;
  onEnableCamera: () => void;
  onCaptureNow: () => void;
  onResumeAutoCapture: () => void;
  onRetake: () => void;
  canRetake: boolean;
  statusText: string;
};

export function VerificationControls({
  permissionBlocked,
  isRequestingPermission,
  isAutoCaptureActive,
  isAutoCaptureEnabled,
  isManualFallback,
  canCaptureNow,
  onEnableCamera,
  onCaptureNow,
  onResumeAutoCapture,
  onRetake,
  canRetake,
  statusText,
}: VerificationControlsProps) {
  if (permissionBlocked) {
    return (
      <div className="space-y-2">
        <Button
          type="button"
          size="lg"
          onClick={onEnableCamera}
          disabled={isRequestingPermission}
          className="h-11 w-full rounded-xl"
        >
          {isRequestingPermission ? 'Enabling camera...' : 'Enable Camera'}
        </Button>
        <p className="text-center text-xs font-medium text-muted-foreground">
          {statusText}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2.5">
        <Button
          type="button"
          variant="outline"
          onClick={onCaptureNow}
          disabled={!canCaptureNow}
          className="h-10 min-w-32 rounded-xl"
        >
          Capture Now
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={onRetake}
          disabled={!canRetake}
          className="h-10 rounded-xl"
          aria-label="Retake latest capture"
        >
          <RotateCcw className="mr-1 size-4" />
          Retake
        </Button>

        <Button
          type="button"
          variant="ghost"
          onClick={onResumeAutoCapture}
          disabled={isAutoCaptureEnabled && !isManualFallback}
          className="h-10 rounded-xl"
        >
          Resume Auto
        </Button>
      </div>

      <p className="text-center text-xs font-medium text-primary">
        {isAutoCaptureActive ? 'Auto-capture active' : statusText}
      </p>
    </div>
  );
}
