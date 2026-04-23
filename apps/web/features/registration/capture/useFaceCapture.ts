import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  ANGLE_THRESHOLDS,
  GUIDANCE_STICK_MS,
  MAX_BRIGHTNESS,
  MAX_CENTER_OFFSET,
  MIN_BLUR_VARIANCE,
  MIN_BRIGHTNESS,
  MIN_FACE_AREA_RATIO,
  POST_CAPTURE_COOLDOWN_MS,
  STABILITY_GRACE_MS,
  STABILITY_WINDOW_MS,
  captureStorageVersion,
  guidedAngles,
  perAngleInstruction,
} from '@/features/registration/capture/constants';
import { useAngleProgress } from '@/features/registration/capture/useAngleProgress';
import type {
  CapturePersistencePayload,
  CaptureReadiness,
  CapturedShot,
  CapturedShotsByAngle,
  FaceCaptureState,
} from '@/features/registration/capture/types';
import type { VerificationAngle } from '@/features/registration/verification/types';
import type { VerificationCapturesByAngle } from '@/features/registration/verification/types';

type CaptureSnapshotFn = () => Promise<Blob | null>;

type UseFaceCaptureParams = {
  videoElement: HTMLVideoElement | null;
  streamActive: boolean;
  captureSnapshot: CaptureSnapshotFn;
  storageKey: string;
};

type LandmarkPoint = {
  x: number;
  y: number;
  z?: number;
};

type DetectionResult = {
  faceLandmarks?: LandmarkPoint[][];
};

type FaceLandmarker = {
  detectForVideo: (video: HTMLVideoElement, timestampMs: number) => DetectionResult;
  close: () => void;
};

const detectionIntervalMs = 100;
const CANVAS_SIZE = 72;
const debugIntervalMs = 1200;
const minStableFramesRequired = 4;
const RIGHT_DEBUG_PREFIX = '[right-debug]';
const CAPTURE_ERROR_PREFIX = '[capture-error]';
const PREVIEW_IS_MIRRORED = true;
const NEAR_CENTER_TOLERANCE = 0.05;
const HARD_CENTER_TOLERANCE = 0.1;
const NEAR_BLUR_RATIO = 0.82;
const HARD_BLUR_RATIO = 0.65;

let faceLandmarkerPromise: Promise<FaceLandmarker> | null = null;

function emptyCapturedShots(): CapturedShotsByAngle {
  return {
    front: null,
    left: null,
    right: null,
    up: null,
    down: null,
  };
}

function findFirstMissingAngle(capturedShots: CapturedShotsByAngle): VerificationAngle | null {
  return guidedAngles.find((angle) => capturedShots[angle] === null) ?? null;
}

function getStoragePayload(
  activeAngle: VerificationAngle,
  capturedShots: CapturedShotsByAngle
): CapturePersistencePayload {
  return {
    version: captureStorageVersion,
    activeAngle,
    shots: guidedAngles
      .filter((angle) => capturedShots[angle] !== null)
      .map((angle) => {
        const shot = capturedShots[angle];
        return {
          angle,
          dataUrl: shot?.dataUrl ?? '',
          capturedAt: shot?.capturedAt ?? Date.now(),
        };
      })
      .filter((entry) => entry.dataUrl.length > 0),
  };
}

function dataUrlToBlob(dataUrl: string): Blob | null {
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex < 0) {
    return null;
  }

  const header = dataUrl.slice(0, commaIndex);
  const content = dataUrl.slice(commaIndex + 1);
  const mimeMatch = header.match(/^data:(.*?);base64$/);
  if (!mimeMatch) {
    return null;
  }

  try {
    const bytes = atob(content);
    const array = new Uint8Array(bytes.length);

    for (let index = 0; index < bytes.length; index += 1) {
      array[index] = bytes.charCodeAt(index);
    }

    return new Blob([array], { type: mimeMatch[1] || 'image/jpeg' });
  } catch {
    return null;
  }
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject('Failed to convert capture to data URL');
      }
    };
    reader.onerror = () => reject('Failed to read captured blob');
    reader.readAsDataURL(blob);
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getLandmark(landmarks: LandmarkPoint[], index: number): LandmarkPoint | null {
  const point = landmarks[index];
  if (!point) {
    return null;
  }

  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    return null;
  }

  return point;
}

function describeError(error: unknown): { message: string; stack: string | null } {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack ?? null,
    };
  }

  return {
    message: typeof error === 'string' ? error : String(error),
    stack: null,
  };
}

function isDetectInfoMessage(message: string) {
  return (
    message.includes('Created TensorFlow Lite XNNPACK delegate for CPU') ||
    message.includes('XNNPACK delegate')
  );
}

function logCaptureError(
  phase: string,
  error: unknown,
  context: {
    targetAngle: VerificationAngle;
    blocker: string;
    [key: string]: unknown;
  },
  severity: 'error' | 'warn' = 'warn'
) {
  const details = describeError(error);
  const logger = severity === 'warn' ? console.warn : console.error;
  logger(CAPTURE_ERROR_PREFIX, {
    phase,
    message: details.message,
    stack: details.stack,
    currentTargetAngle: context.targetAngle,
    currentBlocker: context.blocker,
    ...context,
  });
}

function estimateYawPitch(landmarks: LandmarkPoint[]): { yaw: number; pitch: number } {
  const leftEye = getLandmark(landmarks, 33);
  const rightEye = getLandmark(landmarks, 263);
  const noseTip = getLandmark(landmarks, 1);
  const upperLip = getLandmark(landmarks, 13);
  const lowerLip = getLandmark(landmarks, 14);

  if (!leftEye || !rightEye || !noseTip || !upperLip || !lowerLip) {
    return { yaw: 0, pitch: 0 };
  }

  const eyeMidX = (leftEye.x + rightEye.x) / 2;
  const eyeMidY = (leftEye.y + rightEye.y) / 2;
  const eyeDistance = Math.max(0.001, Math.abs(rightEye.x - leftEye.x));
  const mouthMidY = (upperLip.y + lowerLip.y) / 2;
  const verticalSpan = Math.max(0.02, mouthMidY - eyeMidY);

  const yawNorm = (noseTip.x - eyeMidX) / (eyeDistance * 0.5);
  const pitchNorm = (noseTip.y - eyeMidY) / verticalSpan - 0.5;

  return {
    yaw: clamp(yawNorm * 32, -45, 45),
    pitch: clamp(pitchNorm * 42, -35, 35),
  };
}

function computeIoU(
  a: { minX: number; minY: number; maxX: number; maxY: number },
  b: { minX: number; minY: number; maxX: number; maxY: number }
) {
  const intersectionMinX = Math.max(a.minX, b.minX);
  const intersectionMinY = Math.max(a.minY, b.minY);
  const intersectionMaxX = Math.min(a.maxX, b.maxX);
  const intersectionMaxY = Math.min(a.maxY, b.maxY);
  const intersectionWidth = Math.max(0, intersectionMaxX - intersectionMinX);
  const intersectionHeight = Math.max(0, intersectionMaxY - intersectionMinY);
  const intersectionArea = intersectionWidth * intersectionHeight;
  if (intersectionArea <= 0) {
    return 0;
  }

  const areaA = Math.max(0, (a.maxX - a.minX) * (a.maxY - a.minY));
  const areaB = Math.max(0, (b.maxX - b.minX) * (b.maxY - b.minY));
  const denominator = areaA + areaB - intersectionArea;
  if (denominator <= 0) {
    return 0;
  }

  return intersectionArea / denominator;
}

function dedupeLandmarkFaces(landmarksByFace: LandmarkPoint[][]): LandmarkPoint[][] {
  const uniqueFaces: LandmarkPoint[][] = [];
  const uniqueBoxes: Array<{ minX: number; minY: number; maxX: number; maxY: number }> = [];

  for (const landmarks of landmarksByFace) {
    if (!Array.isArray(landmarks) || landmarks.length === 0) {
      continue;
    }

    const box = computeFaceBox(landmarks);
    const isDuplicate = uniqueBoxes.some((existingBox) => {
      const iou = computeIoU(box, existingBox);
      const centerDistance = Math.hypot(
        (box.minX + box.maxX) / 2 - (existingBox.minX + existingBox.maxX) / 2,
        (box.minY + box.maxY) / 2 - (existingBox.minY + existingBox.maxY) / 2
      );
      const area = Math.max(0, (box.maxX - box.minX) * (box.maxY - box.minY));
      const existingArea = Math.max(
        0,
        (existingBox.maxX - existingBox.minX) * (existingBox.maxY - existingBox.minY)
      );
      const areaRatio =
        Math.min(area, existingArea) / Math.max(area, existingArea, Number.EPSILON);

      return iou >= 0.82 || (centerDistance <= 0.035 && areaRatio >= 0.82);
    });

    if (isDuplicate) {
      continue;
    }

    uniqueFaces.push(landmarks);
    uniqueBoxes.push(box);
  }

  return uniqueFaces;
}

function interpretYawDirection(rawYaw: number): 'left' | 'right' | 'front' {
  const normalizedYaw = PREVIEW_IS_MIRRORED ? rawYaw : rawYaw;
  if (normalizedYaw >= 2) {
    return 'left';
  }
  if (normalizedYaw <= -2) {
    return 'right';
  }
  return 'front';
}

function computeFaceBox(landmarks: LandmarkPoint[]) {
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;

  for (const landmark of landmarks) {
    minX = Math.min(minX, landmark.x);
    minY = Math.min(minY, landmark.y);
    maxX = Math.max(maxX, landmark.x);
    maxY = Math.max(maxY, landmark.y);
  }

  return {
    minX: clamp(minX, 0, 1),
    minY: clamp(minY, 0, 1),
    maxX: clamp(maxX, 0, 1),
    maxY: clamp(maxY, 0, 1),
  };
}

function expandNormalizedBox(
  box: { minX: number; minY: number; maxX: number; maxY: number },
  padX: number,
  padY: number
) {
  return {
    minX: clamp(box.minX - padX, 0, 1),
    minY: clamp(box.minY - padY, 0, 1),
    maxX: clamp(box.maxX + padX, 0, 1),
    maxY: clamp(box.maxY + padY, 0, 1),
  };
}

function isAngleMatch(angle: VerificationAngle, yaw: number, pitch: number) {
  if (angle === 'front') {
    return (
      Math.abs(yaw) <= ANGLE_THRESHOLDS.frontYawAbs &&
      Math.abs(pitch) <= ANGLE_THRESHOLDS.frontPitchAbs
    );
  }

  if (angle === 'left') {
    return yaw >= ANGLE_THRESHOLDS.leftYaw && Math.abs(pitch) <= ANGLE_THRESHOLDS.sidePitchAbs;
  }

  if (angle === 'right') {
    return yaw <= ANGLE_THRESHOLDS.rightYaw && Math.abs(pitch) <= ANGLE_THRESHOLDS.sidePitchAbs;
  }

  if (angle === 'up') {
    return pitch <= ANGLE_THRESHOLDS.upPitch && Math.abs(yaw) <= ANGLE_THRESHOLDS.verticalYawAbs;
  }

  return pitch >= ANGLE_THRESHOLDS.downPitch && Math.abs(yaw) <= ANGLE_THRESHOLDS.verticalYawAbs;
}

function getAngleGuidance(angle: VerificationAngle, yaw: number, pitch: number): string {
  if (angle === 'front') {
    if (Math.abs(yaw) > ANGLE_THRESHOLDS.frontYawAbs) {
      return yaw > 0 ? 'Turn slightly right' : 'Turn slightly left';
    }

    if (Math.abs(pitch) > ANGLE_THRESHOLDS.frontPitchAbs) {
      return pitch < 0 ? 'Lower your chin slightly' : 'Lift your chin slightly';
    }

    return 'Look straight ahead';
  }

  if (angle === 'left') {
    if (Math.abs(pitch) > ANGLE_THRESHOLDS.sidePitchAbs) {
      return pitch < 0 ? 'Lower your chin slightly' : 'Lift your chin slightly';
    }
    return 'Turn slightly left';
  }

  if (angle === 'right') {
    if (Math.abs(pitch) > ANGLE_THRESHOLDS.sidePitchAbs) {
      return pitch < 0 ? 'Lower your chin slightly' : 'Lift your chin slightly';
    }
    return 'Turn slightly right';
  }

  if (angle === 'up') {
    if (Math.abs(yaw) > ANGLE_THRESHOLDS.verticalYawAbs) {
      return yaw > 0 ? 'Turn slightly right' : 'Turn slightly left';
    }
    return 'Look slightly up';
  }

  if (Math.abs(yaw) > ANGLE_THRESHOLDS.verticalYawAbs) {
    return yaw > 0 ? 'Turn slightly right' : 'Turn slightly left';
  }

  return 'Look slightly down';
}

function isNearlyAngleMatch(angle: VerificationAngle, yaw: number, pitch: number) {
  const yawMargin = 3;
  const pitchMargin = 3;

  if (angle === 'front') {
    return (
      Math.abs(yaw) <= ANGLE_THRESHOLDS.frontYawAbs + yawMargin &&
      Math.abs(pitch) <= ANGLE_THRESHOLDS.frontPitchAbs + pitchMargin
    );
  }

  if (angle === 'left') {
    return (
      yaw >= ANGLE_THRESHOLDS.leftYaw - yawMargin &&
      Math.abs(pitch) <= ANGLE_THRESHOLDS.sidePitchAbs + pitchMargin
    );
  }

  if (angle === 'right') {
    return (
      yaw <= ANGLE_THRESHOLDS.rightYaw + yawMargin &&
      Math.abs(pitch) <= ANGLE_THRESHOLDS.sidePitchAbs + pitchMargin
    );
  }

  if (angle === 'up') {
    return (
      pitch <= ANGLE_THRESHOLDS.upPitch + pitchMargin &&
      Math.abs(yaw) <= ANGLE_THRESHOLDS.verticalYawAbs + yawMargin
    );
  }

  return (
    pitch >= ANGLE_THRESHOLDS.downPitch - pitchMargin &&
    Math.abs(yaw) <= ANGLE_THRESHOLDS.verticalYawAbs + yawMargin
  );
}

function computeBlurAndBrightness(
  videoElement: HTMLVideoElement,
  box: { minX: number; minY: number; maxX: number; maxY: number },
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D
): { brightness: number; blurVariance: number } {
  const sourceWidth = videoElement.videoWidth;
  const sourceHeight = videoElement.videoHeight;

  const cropX = clamp(Math.floor(box.minX * sourceWidth), 0, Math.max(sourceWidth - 1, 0));
  const cropY = clamp(Math.floor(box.minY * sourceHeight), 0, Math.max(sourceHeight - 1, 0));
  const cropWidth = Math.max(1, Math.floor((box.maxX - box.minX) * sourceWidth));
  const cropHeight = Math.max(1, Math.floor((box.maxY - box.minY) * sourceHeight));

  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;

  context.drawImage(
    videoElement,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    CANVAS_SIZE,
    CANVAS_SIZE
  );

  const { data } = context.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  const grayscale = new Float32Array(CANVAS_SIZE * CANVAS_SIZE);

  let brightnessSum = 0;

  for (let index = 0, pixel = 0; index < data.length; index += 4, pixel += 1) {
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    grayscale[pixel] = luma;
    brightnessSum += luma;
  }

  const brightness = brightnessSum / grayscale.length;

  let laplaceSum = 0;
  let laplaceSqSum = 0;
  let samples = 0;

  for (let y = 1; y < CANVAS_SIZE - 1; y += 1) {
    for (let x = 1; x < CANVAS_SIZE - 1; x += 1) {
      const idx = y * CANVAS_SIZE + x;
      const laplace =
        4 * grayscale[idx] -
        grayscale[idx - 1] -
        grayscale[idx + 1] -
        grayscale[idx - CANVAS_SIZE] -
        grayscale[idx + CANVAS_SIZE];

      laplaceSum += laplace;
      laplaceSqSum += laplace * laplace;
      samples += 1;
    }
  }

  const mean = laplaceSum / Math.max(samples, 1);
  const variance = laplaceSqSum / Math.max(samples, 1) - mean * mean;

  return {
    brightness,
    blurVariance: Math.max(0, variance),
  };
}

async function loadFaceLandmarker() {
  if (faceLandmarkerPromise) {
    return faceLandmarkerPromise;
  }

  faceLandmarkerPromise = (async () => {
    const tasksVision = await import('@mediapipe/tasks-vision');

    const vision = await tasksVision.FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm'
    );

    return await tasksVision.FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
      },
      runningMode: 'VIDEO',
      numFaces: 2,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false,
    });
  })();

  return faceLandmarkerPromise;
}

function toBlobUrl(blob: Blob) {
  return URL.createObjectURL(blob);
}

export function useFaceCapture({
  videoElement,
  streamActive,
  captureSnapshot,
  storageKey,
}: UseFaceCaptureParams) {
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenContextRef = useRef<CanvasRenderingContext2D | null>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const detectionTimerRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const stableFramesRef = useRef(0);
  const cooldownUntilRef = useRef<number>(0);
  const lastDebugLogRef = useRef<number>(0);
  const currentAngleRef = useRef<VerificationAngle>('front');
  const autoCaptureLockRef = useRef(false);
  const persistenceEnabledRef = useRef(true);
  const latestShotsRef = useRef<CapturedShotsByAngle>(emptyCapturedShots());
  const stableWindowStartRef = useRef<number | null>(null);
  const lastAllValidAtRef = useRef<number | null>(null);
  const stickyGuidanceUntilRef = useRef<number>(0);

  const [modelReady, setModelReady] = useState(false);
  const [modelErrorMessage, setModelErrorMessage] = useState<string | null>(null);
  const [activeAngle, setActiveAngle] = useState<VerificationAngle>('front');
  const [capturedShots, setCapturedShots] = useState<CapturedShotsByAngle>(
    emptyCapturedShots()
  );
  const [isAutoCapturing, setIsAutoCapturing] = useState(false);
  const [feedback, setFeedback] = useState<FaceCaptureState['feedback']>({
    guidanceState: 'no_face' as const,
    instruction: perAngleInstruction.front,
    liveMessage: 'Position your face in the frame',
    holdProgress: 0,
    readiness: {
      faceDetected: false,
      singleFace: false,
      faceLargeEnough: false,
      centered: false,
      sharpEnough: false,
      brightnessOk: false,
      angleMatch: false,
    } as CaptureReadiness,
  });

  const { capturedCount, canSubmit, currentAngle, currentAngleIndex, firstMissingAngle } =
    useAngleProgress(capturedShots, activeAngle);

  useEffect(() => {
    latestShotsRef.current = capturedShots;
  }, [capturedShots]);

  useEffect(() => {
    currentAngleRef.current = currentAngle;
  }, [currentAngle]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    let raw: string | null = null;
    try {
      raw = window.sessionStorage.getItem(storageKey);
    } catch (error) {
      persistenceEnabledRef.current = false;
      console.warn('[capture] unable to restore capture session from storage', error);
      return;
    }

    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as CapturePersistencePayload;
      if (parsed.version !== captureStorageVersion || !Array.isArray(parsed.shots)) {
        return;
      }

      const restored = emptyCapturedShots();

      for (const shot of parsed.shots) {
        if (!guidedAngles.includes(shot.angle)) {
          continue;
        }

        const blob = dataUrlToBlob(shot.dataUrl);
        if (!blob) {
          continue;
        }

        restored[shot.angle] = {
          angle: shot.angle,
          blob,
          previewUrl: toBlobUrl(blob),
          dataUrl: shot.dataUrl,
          capturedAt: shot.capturedAt,
          quality: {
            yaw: 0,
            pitch: 0,
            faceAreaRatio: 0,
            centerOffset: 0,
            blurVariance: 0,
            brightness: 0,
          },
        };
      }

      setCapturedShots(restored);
      if (guidedAngles.includes(parsed.activeAngle)) {
        setActiveAngle(parsed.activeAngle);
      }
    } catch {
      // Ignore stale or malformed session payload.
    }
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (!persistenceEnabledRef.current) {
      return;
    }

    const payload = getStoragePayload(activeAngle, capturedShots);
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(payload));
    } catch (error) {
      persistenceEnabledRef.current = false;
      console.warn('[capture] capture session persistence disabled', {
        reason: 'session_storage_write_failed',
        error,
      });
    }
  }, [activeAngle, capturedShots, storageKey]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        console.log('[capture] loading face landmarker model');
        setModelErrorMessage(null);
        const landmarker = await loadFaceLandmarker();
        if (cancelled) {
          return;
        }
        landmarkerRef.current = landmarker;
        setModelReady(true);
        console.log('[capture] face landmarker model ready');
      } catch (error) {
        if (cancelled) {
          return;
        }
        console.error('[capture] failed to load face landmark model', error);
        setModelErrorMessage('Face guidance is temporarily unavailable. Please refresh and try again.');
        setModelReady(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      for (const shot of Object.values(latestShotsRef.current)) {
        if (shot) {
          URL.revokeObjectURL(shot.previewUrl);
        }
      }

      if (landmarkerRef.current) {
        try {
          landmarkerRef.current.close();
          console.log('[capture] face landmarker closed');
        } catch (error) {
          console.warn('[capture] failed to close face landmarker', error);
        } finally {
          landmarkerRef.current = null;
          faceLandmarkerPromise = null;
        }
      }
    };
  }, []);

  const safeDetect = useCallback((targetVideoElement: HTMLVideoElement | null) => {
    if (!landmarkerRef.current) {
      return null;
    }
    if (!targetVideoElement) {
      return null;
    }
    if (targetVideoElement.readyState < 2) {
      return null;
    }

    try {
      return landmarkerRef.current.detectForVideo(targetVideoElement, performance.now());
    } catch (error) {
      const details = describeError(error);
      if (isDetectInfoMessage(details.message)) {
        return null;
      }
      logCaptureError('detect_for_video', error, {
        targetAngle: currentAngleRef.current,
        blocker: 'detect_failed',
      }, 'warn');
      return null;
    }
  }, []);

  useEffect(() => {
    if (!streamActive || !videoElement || !modelReady) {
      return;
    }
    runningRef.current = true;
    const requiredStableFrames = Math.max(
      minStableFramesRequired,
      Math.ceil(STABILITY_WINDOW_MS / detectionIntervalMs)
    );

    if (!offscreenCanvasRef.current) {
      offscreenCanvasRef.current = document.createElement('canvas');
    }

    if (!offscreenContextRef.current) {
      offscreenContextRef.current = offscreenCanvasRef.current.getContext('2d', {
        willReadFrequently: true,
      });
    }

    const offscreenCanvas = offscreenCanvasRef.current;
    const context = offscreenContextRef.current;
    if (!offscreenCanvas || !context) {
      setModelErrorMessage('Unable to initialize image analysis on this browser.');
      return;
    }

    let cancelled = false;

    const scheduleNext = () => {
      if (cancelled) {
        return;
      }
      detectionTimerRef.current = window.setTimeout(loop, detectionIntervalMs);
    };

    const loop = () => {
      if (cancelled || !runningRef.current) {
        return;
      }

      console.log('[loop] running');

      if (!landmarkerRef.current) {
        console.log('[detect] result:', false);
        stableWindowStartRef.current = null;
        scheduleNext();
        return;
      }

      if (
        !videoElement ||
        videoElement.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
        videoElement.videoWidth === 0 ||
        videoElement.videoWidth <= 0 ||
        videoElement.videoHeight <= 0 ||
        videoElement.paused ||
        videoElement.ended
      ) {
        console.log('[detect] result:', false);
        stableWindowStartRef.current = null;
        stableFramesRef.current = 0;
        lastAllValidAtRef.current = null;
        scheduleNext();
        return;
      }

      const now = performance.now();
      if (now < cooldownUntilRef.current) {
        console.log('[detect] result:', false);
        stableWindowStartRef.current = null;
        stableFramesRef.current = 0;
        lastAllValidAtRef.current = null;
        stickyGuidanceUntilRef.current = 0;
        setFeedback((prev) => ({
          ...prev,
          guidanceState: 'cooldown',
          liveMessage: 'Captured. Prepare for next angle',
          holdProgress: 0,
        }));
        scheduleNext();
        return;
      }

      let blocker = 'unknown';
      const activeAngle = currentAngleRef.current;

      try {
        const result = safeDetect(videoElement);
        console.log('[detect] result:', !!result);

        if (!result) {
          stableWindowStartRef.current = null;
          stableFramesRef.current = 0;
          lastAllValidAtRef.current = null;
          scheduleNext();
          return;
        }

        const rawLandmarksByFace = result.faceLandmarks ?? [];
        const landmarksByFace = dedupeLandmarkFaces(rawLandmarksByFace);
        const faceCount = landmarksByFace.length;

        const baseReadiness: CaptureReadiness = {
          faceDetected: faceCount > 0,
          singleFace: faceCount === 1,
          faceLargeEnough: false,
          centered: false,
          sharpEnough: false,
          brightnessOk: false,
          angleMatch: false,
        };

        if (activeAngle === 'right' && now - lastDebugLogRef.current > debugIntervalMs) {
          console.log(`${RIGHT_DEBUG_PREFIX} target=${activeAngle}`);
          console.log(
            `${RIGHT_DEBUG_PREFIX} faceCount=${faceCount} rawDetections=${rawLandmarksByFace.length}`
          );
        }

        if (faceCount === 0) {
          blocker = 'no_face';
          stableWindowStartRef.current = null;
          stableFramesRef.current = 0;
          lastAllValidAtRef.current = null;
          stickyGuidanceUntilRef.current = 0;
          setFeedback({
            guidanceState: 'no_face',
            instruction: perAngleInstruction[currentAngleRef.current],
            liveMessage: 'Center your face',
            holdProgress: 0,
            readiness: baseReadiness,
          });
          scheduleNext();
          return;
        }

        if (faceCount > 1) {
          blocker = 'multiple_faces';
          if (activeAngle === 'right') {
            console.log(`${RIGHT_DEBUG_PREFIX} blocker=multiple_faces`);
          }
          stableWindowStartRef.current = null;
          stableFramesRef.current = 0;
          lastAllValidAtRef.current = null;
          stickyGuidanceUntilRef.current = 0;
          setFeedback({
            guidanceState: 'multiple_faces',
            instruction: perAngleInstruction[currentAngleRef.current],
            liveMessage: 'Only one face should be visible',
            holdProgress: 0,
            readiness: baseReadiness,
          });
          scheduleNext();
          return;
        }

        let faceAreaRatio = 0;
        let centerOffset = 0;
        let yaw = 0;
        let pitch = 0;
        let brightness = 0;
        let blurVariance = 0;

        try {
          const landmarks = landmarksByFace[0];
          const box = computeFaceBox(landmarks);
          const expandedBox = expandNormalizedBox(box, 0.08, 0.09);
          faceAreaRatio = Math.max(
            0,
            (expandedBox.maxX - expandedBox.minX) * (expandedBox.maxY - expandedBox.minY)
          );
          const faceCenterX = (box.minX + box.maxX) / 2;
          const faceCenterY = (box.minY + box.maxY) / 2;
          centerOffset = Math.hypot(faceCenterX - 0.5, faceCenterY - 0.5);
          const pose = estimateYawPitch(landmarks);
          yaw = pose.yaw;
          pitch = pose.pitch;
          const quality = computeBlurAndBrightness(videoElement, expandedBox, offscreenCanvas, context);
          brightness = quality.brightness;
          blurVariance = quality.blurVariance;
        } catch (error) {
          blocker = 'result_processing_error';
          stableWindowStartRef.current = null;
          stableFramesRef.current = 0;
          lastAllValidAtRef.current = null;
          stickyGuidanceUntilRef.current = 0;
          logCaptureError('result_processing', error, {
            targetAngle: activeAngle,
            blocker,
          });
          setFeedback((prev) => ({
            ...prev,
            guidanceState: 'hold_steady',
            liveMessage: 'Hold steady',
            holdProgress: 0,
          }));
          scheduleNext();
          return;
        }

        let readiness: CaptureReadiness;
        try {
          readiness = {
            faceDetected: true,
            singleFace: true,
            faceLargeEnough: faceAreaRatio >= MIN_FACE_AREA_RATIO,
            centered: centerOffset <= MAX_CENTER_OFFSET,
            sharpEnough: blurVariance >= MIN_BLUR_VARIANCE,
            brightnessOk: brightness >= MIN_BRIGHTNESS && brightness <= MAX_BRIGHTNESS,
            angleMatch: isAngleMatch(activeAngle, yaw, pitch),
          };
        } catch (error) {
          blocker = 'angle_classification_error';
          stableWindowStartRef.current = null;
          stableFramesRef.current = 0;
          lastAllValidAtRef.current = null;
          stickyGuidanceUntilRef.current = 0;
          logCaptureError('angle_classification', error, {
            targetAngle: activeAngle,
            blocker,
            yaw,
            pitch,
          });
          setFeedback((prev) => ({
            ...prev,
            guidanceState: 'hold_steady',
            liveMessage: 'Hold steady',
            holdProgress: 0,
          }));
          scheduleNext();
          return;
        }

        // Keep brightness as a quality signal, but do not block capture progression.
        const allValid =
          readiness.faceDetected &&
          readiness.singleFace &&
          readiness.faceLargeEnough &&
          readiness.centered &&
          readiness.angleMatch &&
          readiness.sharpEnough;
        const nearAngleMatch = isNearlyAngleMatch(activeAngle, yaw, pitch);
        const isCenterNearEnough = centerOffset <= MAX_CENTER_OFFSET + NEAR_CENTER_TOLERANCE;
        const isCenterFarOff = centerOffset > MAX_CENTER_OFFSET + HARD_CENTER_TOLERANCE;
        const isBlurNearEnough = blurVariance >= MIN_BLUR_VARIANCE * NEAR_BLUR_RATIO;
        const isBlurTooLow = blurVariance < MIN_BLUR_VARIANCE * HARD_BLUR_RATIO;
        const isNearReady =
          readiness.faceLargeEnough &&
          isCenterNearEnough &&
          (readiness.angleMatch || nearAngleMatch) &&
          isBlurNearEnough;

        const stableDurationMs =
          stableWindowStartRef.current === null ? 0 : now - stableWindowStartRef.current;

        let guidanceState: FaceCaptureState['feedback']['guidanceState'] = 'hold_steady';
        let liveMessage = 'Hold steady';

        if (!readiness.faceLargeEnough) {
          blocker = 'face_too_small';
          guidanceState = 'face_too_small';
          liveMessage = 'Move closer';
        } else if (!readiness.angleMatch && !nearAngleMatch) {
          blocker = 'wrong_angle';
          guidanceState = 'wrong_angle';
          liveMessage = getAngleGuidance(activeAngle, yaw, pitch);
        } else if (!readiness.centered && isCenterFarOff) {
          blocker = 'off_center';
          guidanceState = 'off_center';
          liveMessage = 'Center your face';
        } else if (!readiness.sharpEnough && isBlurTooLow) {
          blocker = 'blurry';
          guidanceState = 'blurry';
          liveMessage = 'Hold steady';
        } else if (!allValid && isNearReady) {
          blocker = 'near_ready';
          guidanceState = 'hold_steady';
          liveMessage = 'Hold steady';
        } else if (allValid) {
          blocker = 'ready';
          guidanceState = 'ready';
        } else {
          blocker = 'hold';
          guidanceState = 'hold_steady';
          liveMessage = 'Hold steady';
        }

        if (!allValid && now < stickyGuidanceUntilRef.current) {
          guidanceState = 'hold_steady';
          liveMessage = 'Hold steady';
        }

        if (activeAngle === 'right' && now - lastDebugLogRef.current > debugIntervalMs) {
          const interpretedDirection = interpretYawDirection(yaw);
          console.log(`${RIGHT_DEBUG_PREFIX} yaw=${Number(yaw.toFixed(1))} pitch=${Number(pitch.toFixed(1))}`);
          console.log(
            `${RIGHT_DEBUG_PREFIX} rawYaw=${Number(yaw.toFixed(1))} interpretedDirection=${interpretedDirection}`
          );
          console.log(
            `${RIGHT_DEBUG_PREFIX} faceSize=${Number(faceAreaRatio.toFixed(3))} centered=${readiness.centered ? 'yes' : 'no'}`
          );
          console.log(`${RIGHT_DEBUG_PREFIX} blocker=${blocker}`);
        }

        if (now - lastDebugLogRef.current > debugIntervalMs) {
          lastDebugLogRef.current = now;
          console.log(
            `[capture] yaw=${Number(yaw.toFixed(1))} pitch=${Number(pitch.toFixed(1))} target=${activeAngle}`
          );
          console.log(
            `[capture] faceSize=${Number(faceAreaRatio.toFixed(3))} centered=${readiness.centered} centerOffset=${Number(centerOffset.toFixed(3))}`
          );
          console.log(`[capture] blocker=${blocker}`);
          console.log('[capture] state:', guidanceState);
          console.log('[capture] angle:', activeAngle);
          console.log('[capture] stableFrames:', stableFramesRef.current);
          console.log('[capture] stableDurationMs:', Number(stableDurationMs.toFixed(0)));
          console.log('[capture] tuning', {
            targetAngle: activeAngle,
            blocker,
            stableFrames: stableFramesRef.current,
            stableDurationMs: Number(stableDurationMs.toFixed(0)),
            yaw: Number(yaw.toFixed(1)),
            pitch: Number(pitch.toFixed(1)),
            triggerAtMs: null,
          });
          console.log('[capture] detection summary', {
            angle: activeAngle,
            state: guidanceState,
            stableFrames: stableFramesRef.current,
            stableDurationMs: Number(stableDurationMs.toFixed(0)),
            yaw: Number(yaw.toFixed(1)),
            pitch: Number(pitch.toFixed(1)),
            brightness: Number(brightness.toFixed(1)),
            blurVariance: Number(blurVariance.toFixed(1)),
            readiness,
            allValid,
          });
        }

        if (!allValid) {
          const withinGrace =
            isNearReady &&
            lastAllValidAtRef.current !== null &&
            now - lastAllValidAtRef.current <= STABILITY_GRACE_MS;

          if (!withinGrace) {
            stableWindowStartRef.current = null;
            stableFramesRef.current = 0;
          }

          stickyGuidanceUntilRef.current =
            guidanceState === 'hold_steady' ? now + GUIDANCE_STICK_MS : 0;
          setFeedback({
            guidanceState,
            instruction: perAngleInstruction[activeAngle],
            liveMessage,
            holdProgress: withinGrace
              ? clamp(stableFramesRef.current / requiredStableFrames, 0, 1)
              : 0,
            readiness,
          });
          scheduleNext();
          return;
        }

        lastAllValidAtRef.current = now;
        if (stableWindowStartRef.current === null) {
          stableWindowStartRef.current = now;
        }
        stableFramesRef.current += 1;
        const holdProgress = clamp(stableFramesRef.current / requiredStableFrames, 0, 1);
        const stableDurationMsNow = now - stableWindowStartRef.current;

        setFeedback({
          guidanceState: holdProgress >= 1 ? 'ready' : 'hold_steady',
          instruction: perAngleInstruction[activeAngle],
          liveMessage: holdProgress >= 1 ? 'Hold still...' : 'Hold steady',
          holdProgress,
          readiness,
        });

        const hasMetStability =
          stableFramesRef.current >= requiredStableFrames &&
          stableDurationMsNow >= STABILITY_WINDOW_MS &&
          stableFramesRef.current > minStableFramesRequired;

        if (!hasMetStability || autoCaptureLockRef.current) {
          scheduleNext();
          return;
        }

        autoCaptureLockRef.current = true;
        setIsAutoCapturing(true);
        console.log('[capture] auto-capture triggered', {
          angle: activeAngle,
          yaw: Number(yaw.toFixed(1)),
          pitch: Number(pitch.toFixed(1)),
          stableFrames: stableFramesRef.current,
          stableDurationMs: Number(stableDurationMsNow.toFixed(0)),
          triggerAtMs: Number(now.toFixed(0)),
        });
        console.log('[capture] tuning', {
          targetAngle: activeAngle,
          blocker: 'trigger_capture',
          stableFrames: stableFramesRef.current,
          stableDurationMs: Number(stableDurationMsNow.toFixed(0)),
          yaw: Number(yaw.toFixed(1)),
          pitch: Number(pitch.toFixed(1)),
          triggerAtMs: Number(now.toFixed(0)),
        });

        void (async () => {
          try {
            const snapshot = await captureSnapshot();
            if (!snapshot) {
              logCaptureError('capture_trigger', new Error('captureSnapshot returned null'), {
                targetAngle: activeAngle,
                blocker: 'snapshot_null',
              });
              setFeedback((prev) => ({
                ...prev,
                guidanceState: 'hold_steady',
                liveMessage: 'Hold steady',
              }));
              stableWindowStartRef.current = null;
              stableFramesRef.current = 0;
              lastAllValidAtRef.current = null;
              stickyGuidanceUntilRef.current = 0;
              return;
            }

            let dataUrl: string;
            try {
              dataUrl = await blobToDataUrl(snapshot);
            } catch (error) {
              logCaptureError('capture_trigger', error, {
                targetAngle: activeAngle,
                blocker: 'snapshot_serialize_failed',
              });
              setFeedback((prev) => ({
                ...prev,
                guidanceState: 'hold_steady',
                liveMessage: 'Hold steady',
              }));
              stableWindowStartRef.current = null;
              stableFramesRef.current = 0;
              lastAllValidAtRef.current = null;
              stickyGuidanceUntilRef.current = 0;
              return;
            }

            const previewUrl = toBlobUrl(snapshot);

            const shot: CapturedShot = {
              angle: activeAngle,
              blob: snapshot,
              dataUrl,
              previewUrl,
              capturedAt: Date.now(),
              quality: {
                yaw,
                pitch,
                faceAreaRatio,
                centerOffset,
                blurVariance,
                brightness,
              },
            };

            setCapturedShots((current) => {
              const previous = current[activeAngle];
              if (previous) {
                URL.revokeObjectURL(previous.previewUrl);
              }

              return {
                ...current,
                [activeAngle]: shot,
              };
            });

            const nextShots: CapturedShotsByAngle = {
              ...latestShotsRef.current,
              [activeAngle]: shot,
            };
            const nextAngle = findFirstMissingAngle(nextShots);
            stableFramesRef.current = 0;
            stableWindowStartRef.current = null;
            lastAllValidAtRef.current = null;
            stickyGuidanceUntilRef.current = 0;
            cooldownUntilRef.current = performance.now() + POST_CAPTURE_COOLDOWN_MS;

            if (nextAngle) {
              setActiveAngle(nextAngle);
            }
            console.log(`[capture] captured angle=${activeAngle}`);
          } catch (error) {
            logCaptureError('capture_trigger', error, {
              targetAngle: activeAngle,
              blocker: 'auto_capture_failed',
            });
            setFeedback((prev) => ({
              ...prev,
              guidanceState: 'hold_steady',
              liveMessage: 'Hold steady',
            }));
            stableWindowStartRef.current = null;
            stableFramesRef.current = 0;
            lastAllValidAtRef.current = null;
            stickyGuidanceUntilRef.current = 0;
          } finally {
            autoCaptureLockRef.current = false;
            setIsAutoCapturing(false);
            scheduleNext();
          }
        })();
        return;
      } catch (error) {
        stableFramesRef.current = 0;
        stableWindowStartRef.current = null;
        lastAllValidAtRef.current = null;
        stickyGuidanceUntilRef.current = 0;
        logCaptureError('detection_loop', error, {
          targetAngle: activeAngle,
          blocker,
        });
        setFeedback((prev) => ({
          ...prev,
          guidanceState: 'hold_steady',
          liveMessage: 'Hold steady',
          holdProgress: 0,
        }));
      } finally {
        if (!autoCaptureLockRef.current) {
          scheduleNext();
        }
      }
    };

    loop();

    return () => {
      cancelled = true;
      runningRef.current = false;
      const timerId = detectionTimerRef.current;
      if (timerId !== null) {
        window.clearTimeout(timerId);
      }
      detectionTimerRef.current = null;
      autoCaptureLockRef.current = false;
      stableFramesRef.current = 0;
      stableWindowStartRef.current = null;
      lastAllValidAtRef.current = null;
      stickyGuidanceUntilRef.current = 0;
    };
  }, [
    captureSnapshot,
    modelReady,
    safeDetect,
    streamActive,
    videoElement,
  ]);

  const retakeAngle = useCallback((angle: VerificationAngle) => {
    setCapturedShots((current) => {
      const nextShots = { ...current };
      const existing = nextShots[angle];
      if (existing) {
        URL.revokeObjectURL(existing.previewUrl);
      }
      nextShots[angle] = null;
      return nextShots;
    });

    stableFramesRef.current = 0;
    stableWindowStartRef.current = null;
    lastAllValidAtRef.current = null;
    stickyGuidanceUntilRef.current = 0;
    cooldownUntilRef.current = 0;
    setActiveAngle(angle);
    setFeedback((prev) => ({
      ...prev,
      instruction: perAngleInstruction[angle],
      liveMessage: 'Align and hold steady',
      holdProgress: 0,
    }));
  }, []);

  const focusAngle = useCallback((angle: VerificationAngle) => {
    setActiveAngle(angle);
    stableFramesRef.current = 0;
    stableWindowStartRef.current = null;
    lastAllValidAtRef.current = null;
    stickyGuidanceUntilRef.current = 0;
  }, []);

  const clearSession = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.removeItem(storageKey);
      } catch (error) {
        console.warn('[capture] failed to clear capture session from storage', error);
      }
    }
    console.log('[capture] cleared capture session');
  }, [storageKey]);

  const capturesByAngle = useMemo(() => {
    return guidedAngles.reduce(
      (accumulator, angle) => {
        accumulator[angle] = capturedShots[angle] ? [capturedShots[angle].blob] : [];
        return accumulator;
      },
      {
        front: [],
        left: [],
        right: [],
        up: [],
        down: [],
      } as VerificationCapturesByAngle
    );
  }, [capturedShots]);

  const state: FaceCaptureState = {
    modelReady,
    modelErrorMessage,
    currentAngle,
    currentAngleIndex,
    capturedShots,
    capturedCount,
    canSubmit,
    isAutoCapturing,
    feedback,
  };

  return {
    state,
    capturesByAngle,
    firstMissingAngle,
    retakeAngle,
    focusAngle,
    clearSession,
  };
}
