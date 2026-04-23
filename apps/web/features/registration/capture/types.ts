import type { VerificationAngle } from '@/features/registration/verification/types';

export type CapturedShot = {
  angle: VerificationAngle;
  blob: Blob;
  previewUrl: string;
  capturedAt: number;
  dataUrl: string;
  quality: {
    yaw: number;
    pitch: number;
    faceAreaRatio: number;
    centerOffset: number;
    blurVariance: number;
    brightness: number;
  };
};

export type CapturedShotsByAngle = Record<VerificationAngle, CapturedShot | null>;

export type CaptureReadiness = {
  faceDetected: boolean;
  singleFace: boolean;
  faceLargeEnough: boolean;
  centered: boolean;
  sharpEnough: boolean;
  brightnessOk: boolean;
  angleMatch: boolean;
};

export type CaptureFeedback = {
  instruction: string;
  liveMessage: string;
  holdProgress: number;
  readiness: CaptureReadiness;
};

export type FaceCaptureState = {
  modelReady: boolean;
  modelErrorMessage: string | null;
  currentAngle: VerificationAngle;
  currentAngleIndex: number;
  capturedShots: CapturedShotsByAngle;
  capturedCount: number;
  canSubmit: boolean;
  isAutoCapturing: boolean;
  feedback: CaptureFeedback;
};

export type RestoreCaptureShot = {
  angle: VerificationAngle;
  dataUrl: string;
  capturedAt: number;
};

export type CapturePersistencePayload = {
  version: number;
  activeAngle: VerificationAngle;
  shots: RestoreCaptureShot[];
};
