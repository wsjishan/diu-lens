import type { RefCallback } from 'react';

export type PermissionState =
  | 'idle'
  | 'requesting'
  | 'granted'
  | 'denied'
  | 'unsupported';

export type CameraHookResult = {
  videoRef: RefCallback<HTMLVideoElement>;
  status: PermissionState;
  errorMessage: string | null;
  streamActive: boolean;
  requestAccess: () => Promise<boolean>;
  resetPermission: () => void;
  stopStream: () => void;
};
