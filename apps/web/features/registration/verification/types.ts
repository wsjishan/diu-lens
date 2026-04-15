import type { RefCallback } from 'react';

export type VerificationStage =
  | 'preparation'
  | 'permission'
  | 'capture'
  | 'complete';

export type PermissionState =
  | 'idle'
  | 'requesting'
  | 'granted'
  | 'denied'
  | 'unsupported';

export type VerificationAngleId = 'front' | 'left' | 'right' | 'up' | 'down';

export type CaptureSource = 'auto' | 'manual';

export type CaptureState =
  | 'waiting'
  | 'aligning'
  | 'ready'
  | 'captured'
  | 'angle-complete';

export type VerificationAngle = {
  id: VerificationAngleId;
  title: string;
  guidance: string;
  alignmentHint: string[];
};

export type VerificationPose = VerificationAngle;

export type CapturedFrame = {
  id: string;
  angleId: VerificationAngleId;
  source: CaptureSource;
  dataUrl: string;
  capturedAt: number;
};

export type CapturesByAngle = Record<VerificationAngleId, CapturedFrame[]>;

export type FrameAnalysis = {
  brightness: number;
  contrast: number;
  sharpness: number;
  motion: number;
  horizontalBalance: number;
  verticalBalance: number;
  faceOffsetX: number;
  faceOffsetY: number;
  centerContrastRatio: number;
};

export type CaptureValidation = {
  faceDetected: boolean;
  isCentered: boolean;
  poseMatched: boolean;
  detectedDirection: VerificationAngleId | null;
  isSharpEnough: boolean;
  lightingOk: boolean;
  isStable: boolean;
  holdProgress: number;
  canCapture: boolean;
  feedback: string;
};

export type CameraHookResult = {
  videoRef: RefCallback<HTMLVideoElement>;
  status: PermissionState;
  errorMessage: string | null;
  streamActive: boolean;
  requestAccess: () => Promise<boolean>;
  captureFrame: () => string | null;
  readFrameAnalysis: () => FrameAnalysis | null;
  resetPermission: () => void;
  stopStream: () => void;
};
