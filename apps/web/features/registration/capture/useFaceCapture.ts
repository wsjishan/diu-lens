import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  ANGLE_THRESHOLDS,
  MAX_BRIGHTNESS,
  MAX_CENTER_OFFSET,
  MIN_BLUR_VARIANCE,
  MIN_BRIGHTNESS,
  MIN_FACE_AREA_RATIO,
  POST_CAPTURE_COOLDOWN_MS,
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

const detectionIntervalMs = 120;
const CANVAS_SIZE = 72;

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
        reject(new Error('Failed to convert capture to data URL'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read captured blob'));
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

function isAngleMatch(angle: VerificationAngle, yaw: number, pitch: number) {
  if (angle === 'front') {
    return (
      Math.abs(yaw) <= ANGLE_THRESHOLDS.frontYawAbs &&
      Math.abs(pitch) <= ANGLE_THRESHOLDS.frontPitchAbs
    );
  }

  if (angle === 'left') {
    return yaw <= ANGLE_THRESHOLDS.leftYaw;
  }

  if (angle === 'right') {
    return yaw >= ANGLE_THRESHOLDS.rightYaw;
  }

  if (angle === 'up') {
    return pitch <= ANGLE_THRESHOLDS.upPitch;
  }

  return pitch >= ANGLE_THRESHOLDS.downPitch;
}

function getAngleGuidance(angle: VerificationAngle, yaw: number, pitch: number): string {
  if (angle === 'front') {
    if (Math.abs(yaw) > ANGLE_THRESHOLDS.frontYawAbs) {
      return yaw < 0 ? 'Turn slightly right' : 'Turn slightly left';
    }

    if (Math.abs(pitch) > ANGLE_THRESHOLDS.frontPitchAbs) {
      return pitch < 0 ? 'Lower your chin slightly' : 'Lift your chin slightly';
    }

    return 'Look straight ahead';
  }

  if (angle === 'left') {
    return 'Turn slightly left';
  }

  if (angle === 'right') {
    return 'Turn slightly right';
  }

  if (angle === 'up') {
    return 'Look slightly up';
  }

  return 'Look slightly down';
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
  const frameRequestIdRef = useRef<number | null>(null);
  const validSinceRef = useRef<number | null>(null);
  const cooldownUntilRef = useRef<number>(0);
  const lastDetectionRunRef = useRef<number>(0);
  const latestShotsRef = useRef<CapturedShotsByAngle>(emptyCapturedShots());

  const [modelReady, setModelReady] = useState(false);
  const [modelErrorMessage, setModelErrorMessage] = useState<string | null>(null);
  const [activeAngle, setActiveAngle] = useState<VerificationAngle>('front');
  const [capturedShots, setCapturedShots] = useState<CapturedShotsByAngle>(
    emptyCapturedShots()
  );
  const [isAutoCapturing, setIsAutoCapturing] = useState(false);
  const [feedback, setFeedback] = useState({
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
    if (typeof window === 'undefined') {
      return;
    }

    const raw = window.sessionStorage.getItem(storageKey);
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

    const payload = getStoragePayload(activeAngle, capturedShots);
    window.sessionStorage.setItem(storageKey, JSON.stringify(payload));
  }, [activeAngle, capturedShots, storageKey]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        setModelErrorMessage(null);
        const landmarker = await loadFaceLandmarker();
        if (cancelled) {
          return;
        }
        landmarkerRef.current = landmarker;
        setModelReady(true);
      } catch (error) {
        if (cancelled) {
          return;
        }
        console.error('[capture] failed to load face landmark model', error);
        setModelErrorMessage('Unable to load face guidance. Please refresh and try again.');
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
    };
  }, []);

  useEffect(() => {
    if (!streamActive || !videoElement || !modelReady) {
      return;
    }

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

    const runDetection = () => {
      if (cancelled) {
        return;
      }

      frameRequestIdRef.current = window.requestAnimationFrame(runDetection);

      const now = performance.now();
      if (now - lastDetectionRunRef.current < detectionIntervalMs) {
        return;
      }
      lastDetectionRunRef.current = now;

      const landmarker = landmarkerRef.current;
      if (!landmarker) {
        return;
      }

      if (videoElement.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        return;
      }

      if (now < cooldownUntilRef.current) {
        setFeedback((prev) => ({
          ...prev,
          liveMessage: 'Captured. Prepare for next angle',
          holdProgress: 0,
        }));
        return;
      }

      const result = landmarker.detectForVideo(videoElement, Date.now());
      const landmarksByFace = result.faceLandmarks ?? [];

      const baseReadiness: CaptureReadiness = {
        faceDetected: landmarksByFace.length > 0,
        singleFace: landmarksByFace.length === 1,
        faceLargeEnough: false,
        centered: false,
        sharpEnough: false,
        brightnessOk: false,
        angleMatch: false,
      };

      if (landmarksByFace.length === 0) {
        validSinceRef.current = null;
        setFeedback({
          instruction: perAngleInstruction[currentAngle],
          liveMessage: 'Align your face inside the guide',
          holdProgress: 0,
          readiness: baseReadiness,
        });
        return;
      }

      if (landmarksByFace.length > 1) {
        validSinceRef.current = null;
        setFeedback({
          instruction: perAngleInstruction[currentAngle],
          liveMessage: 'Only one face should be visible',
          holdProgress: 0,
          readiness: baseReadiness,
        });
        return;
      }

      const landmarks = landmarksByFace[0];
      const box = computeFaceBox(landmarks);
      const faceAreaRatio = Math.max(0, (box.maxX - box.minX) * (box.maxY - box.minY));
      const faceCenterX = (box.minX + box.maxX) / 2;
      const faceCenterY = (box.minY + box.maxY) / 2;
      const centerOffset = Math.hypot(faceCenterX - 0.5, faceCenterY - 0.5);

      const { yaw, pitch } = estimateYawPitch(landmarks);
      const { brightness, blurVariance } = computeBlurAndBrightness(
        videoElement,
        box,
        offscreenCanvas,
        context
      );

      const readiness: CaptureReadiness = {
        faceDetected: true,
        singleFace: true,
        faceLargeEnough: faceAreaRatio >= MIN_FACE_AREA_RATIO,
        centered: centerOffset <= MAX_CENTER_OFFSET,
        sharpEnough: blurVariance >= MIN_BLUR_VARIANCE,
        brightnessOk: brightness >= MIN_BRIGHTNESS && brightness <= MAX_BRIGHTNESS,
        angleMatch: isAngleMatch(currentAngle, yaw, pitch),
      };

      const allValid = Object.values(readiness).every(Boolean);

      let liveMessage = 'Hold steady';

      if (!readiness.faceLargeEnough) {
        liveMessage = 'Move closer';
      } else if (!readiness.centered) {
        liveMessage = 'Center your face';
      } else if (!readiness.brightnessOk) {
        liveMessage = brightness < MIN_BRIGHTNESS ? 'Lighting is too low' : 'Lighting is too bright';
      } else if (!readiness.sharpEnough) {
        liveMessage = 'Hold steady';
      } else if (!readiness.angleMatch) {
        liveMessage = getAngleGuidance(currentAngle, yaw, pitch);
      }

      if (!allValid) {
        validSinceRef.current = null;
        setFeedback({
          instruction: perAngleInstruction[currentAngle],
          liveMessage,
          holdProgress: 0,
          readiness,
        });
        return;
      }

      if (!validSinceRef.current) {
        validSinceRef.current = now;
      }

      const holdProgress = clamp((now - validSinceRef.current) / STABILITY_WINDOW_MS, 0, 1);

      setFeedback({
        instruction: perAngleInstruction[currentAngle],
        liveMessage,
        holdProgress,
        readiness,
      });

      if (holdProgress < 1 || isAutoCapturing) {
        return;
      }

      setIsAutoCapturing(true);

      void (async () => {
        try {
          const snapshot = await captureSnapshot();
          if (!snapshot) {
            throw new Error('Capture failed');
          }

          const dataUrl = await blobToDataUrl(snapshot);
          const previewUrl = toBlobUrl(snapshot);

          const shot: CapturedShot = {
            angle: currentAngle,
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
            const previous = current[currentAngle];
            if (previous) {
              URL.revokeObjectURL(previous.previewUrl);
            }

            return {
              ...current,
              [currentAngle]: shot,
            };
          });

          validSinceRef.current = null;
          cooldownUntilRef.current = performance.now() + POST_CAPTURE_COOLDOWN_MS;

          setActiveAngle((prevAngle) => {
            const currentIndex = guidedAngles.findIndex((angle) => angle === prevAngle);
            const nextIndex = Math.min(currentIndex + 1, guidedAngles.length - 1);
            return guidedAngles[nextIndex];
          });
        } catch (error) {
          console.error('[capture] auto-capture failed', error);
          setFeedback((prev) => ({
            ...prev,
            liveMessage: 'Capture failed. Hold steady and try again',
          }));
        } finally {
          setIsAutoCapturing(false);
        }
      })();
    };

    frameRequestIdRef.current = window.requestAnimationFrame(runDetection);

    return () => {
      cancelled = true;
      const requestId = frameRequestIdRef.current;
      if (requestId !== null) {
        window.cancelAnimationFrame(requestId);
      }
      frameRequestIdRef.current = null;
      validSinceRef.current = null;
    };
  }, [
    captureSnapshot,
    currentAngle,
    isAutoCapturing,
    modelReady,
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

    validSinceRef.current = null;
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
    validSinceRef.current = null;
  }, []);

  const clearSession = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(storageKey);
    }
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
