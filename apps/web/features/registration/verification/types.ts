import type { RefCallback } from 'react';

export type PermissionState =
  | 'idle'
  | 'requesting'
  | 'granted'
  | 'denied'
  | 'unsupported';

export type VerificationAngle = 'front' | 'left' | 'right' | 'up' | 'down';

export type AngleCaptureSummary = {
  angle: VerificationAngle;
  acceptedShots: number;
  requiredShots: number;
};

export type VerificationCompletionSummary = {
  verificationCompleted: boolean;
  totalRequiredShots: number;
  totalAcceptedShots: number;
  angles: AngleCaptureSummary[];
};

export type CameraHookResult = {
  videoRef: RefCallback<HTMLVideoElement>;
  status: PermissionState;
  errorMessage: string | null;
  streamActive: boolean;
  requestAccess: () => Promise<boolean>;
  resetPermission: () => void;
  stopStream: () => void;
};
