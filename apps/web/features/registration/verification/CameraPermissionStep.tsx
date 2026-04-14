import { Camera, CameraOff, RotateCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { VerificationShell } from '@/features/registration/verification/VerificationShell';
import type { PermissionState } from '@/features/registration/verification/types';

type CameraPermissionStepProps = {
  status: PermissionState;
  errorMessage: string | null;
  onAllowAccess: () => void;
  onRetry: () => void;
};

export function CameraPermissionStep({
  status,
  errorMessage,
  onAllowAccess,
  onRetry,
}: CameraPermissionStepProps) {
  const denied = status === 'denied';
  const unsupported = status === 'unsupported';

  return (
    <VerificationShell
      title="Enable Camera Access"
      description="Camera access is needed to complete guided face verification directly on your device."
    >
      <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-[#0b1220]">
        <div className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
          {denied || unsupported ? (
            <CameraOff className="size-4 text-amber-600 dark:text-amber-300" />
          ) : (
            <Camera className="size-4 text-blue-700 dark:text-blue-300" />
          )}
          {unsupported
            ? 'Camera access is not supported here'
            : denied
              ? 'Camera access is currently blocked'
              : 'Camera access has not been granted yet'}
        </div>

        <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">
          {errorMessage ??
            'Allow access to continue with secure biometric onboarding.'}
        </p>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {!unsupported ? (
            <Button
              type="button"
              onClick={onAllowAccess}
              disabled={status === 'requesting'}
              className="h-10 w-full rounded-lg bg-linear-to-r from-[#1e2a78] to-[#2f5bff] px-5 text-white transition-all duration-200 ease-out hover:from-[#1a2568] hover:to-[#244ee0] dark:bg-linear-to-r dark:from-[#1e3a8a] dark:to-[#2563eb] sm:w-auto"
            >
              {status === 'requesting'
                ? 'Requesting access...'
                : 'Allow Camera Access'}
            </Button>
          ) : null}

          {(denied || unsupported) && (
            <Button
              type="button"
              variant="outline"
              onClick={onRetry}
              className="h-10 rounded-lg border-slate-300/90 px-5"
            >
              <RotateCw className="mr-1 size-4" />
              Try Again
            </Button>
          )}
        </div>
      </div>
    </VerificationShell>
  );
}
