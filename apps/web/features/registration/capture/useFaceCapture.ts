import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  ANGLE_THRESHOLDS,
  BURST_CAPTURE_FRAME_COUNT,
  MIN_FACE_AREA_RATIO,
  POST_CAPTURE_COOLDOWN_MS,
  captureStorageVersion,
  guidedAngles,
  perAngleInstruction,
} from '@/features/registration/capture/constants';
import { useAngleProgress } from '@/features/registration/capture/useAngleProgress';
import type {
  CapturePersistencePayload,
  CapturedShot,
  CapturedShotsByAngle,
  FaceCaptureState,
} from '@/features/registration/capture/types';
import type {
  VerificationAngle,
  VerificationCapturesByAngle,
  VerificationFrameMetadataByAngle,
} from '@/features/registration/verification/types';

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

const detectionIntervalMs = 90;
const MIN_CAPTURE_FILE_SIZE_BYTES = 10 * 1024;
const BURST_CAPTURE_GAP_MS = 60;

let faceLandmarkerPromise: Promise<FaceLandmarker> | null = null;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function emptyCapturedShots(): CapturedShotsByAngle {
  return { front: [], left: [], right: [], up: [], down: [] };
}

function isAngleComplete(
  capturedShots: CapturedShotsByAngle,
  angle: VerificationAngle
) {
  return capturedShots[angle].length >= BURST_CAPTURE_FRAME_COUNT;
}

function allAnglesComplete(capturedShots: CapturedShotsByAngle) {
  return guidedAngles.every((angle) => isAngleComplete(capturedShots, angle));
}

function findFirstMissingAngle(capturedShots: CapturedShotsByAngle): VerificationAngle | null {
  return (
    guidedAngles.find((angle) => capturedShots[angle].length < BURST_CAPTURE_FRAME_COUNT) ??
    null
  );
}

function getStoragePayload(activeAngle: VerificationAngle, capturedShots: CapturedShotsByAngle): CapturePersistencePayload {
  return {
    version: captureStorageVersion,
    activeAngle,
    shots: guidedAngles
      .flatMap((angle) =>
        capturedShots[angle].map((shot) => ({
          angle,
          dataUrl: shot.dataUrl,
          capturedAt: shot.capturedAt,
        }))
      )
      .filter((entry) => entry.dataUrl.length > 0),
  };
}

function dataUrlToBlob(dataUrl: string): Blob | null {
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex < 0) return null;

  const header = dataUrl.slice(0, commaIndex);
  const content = dataUrl.slice(commaIndex + 1);
  const mimeMatch = header.match(/^data:(.*?);base64$/);
  if (!mimeMatch) return null;

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
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject('Failed to convert capture to data URL');
    };
    reader.onerror = () => reject('Failed to read captured blob');
    reader.readAsDataURL(blob);
  });
}

function toBlobUrl(blob: Blob) {
  return URL.createObjectURL(blob);
}

function getLandmark(landmarks: LandmarkPoint[], index: number): LandmarkPoint | null {
  const point = landmarks[index];
  if (!point) return null;
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
  return point;
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

function isRoughAngleMatch(angle: VerificationAngle, yaw: number, pitch: number) {
  const yawMargin = 8;
  const pitchMargin = 8;

  if (angle === 'front') {
    return (
      Math.abs(yaw) <= ANGLE_THRESHOLDS.frontYawAbs + yawMargin &&
      Math.abs(pitch) <= ANGLE_THRESHOLDS.frontPitchAbs + pitchMargin
    );
  }
  if (angle === 'left') {
    return yaw >= ANGLE_THRESHOLDS.leftYaw - yawMargin && Math.abs(pitch) <= ANGLE_THRESHOLDS.sidePitchAbs + pitchMargin;
  }
  if (angle === 'right') {
    return yaw <= ANGLE_THRESHOLDS.rightYaw + yawMargin && Math.abs(pitch) <= ANGLE_THRESHOLDS.sidePitchAbs + pitchMargin;
  }
  if (angle === 'up') {
    return pitch <= ANGLE_THRESHOLDS.upPitch + pitchMargin && Math.abs(yaw) <= ANGLE_THRESHOLDS.verticalYawAbs + yawMargin;
  }
  return pitch >= ANGLE_THRESHOLDS.downPitch - pitchMargin && Math.abs(yaw) <= ANGLE_THRESHOLDS.verticalYawAbs + yawMargin;
}

function getAngleGuidance(angle: VerificationAngle) {
  if (angle === 'front') return 'Look forward';
  if (angle === 'left') return 'Look left';
  if (angle === 'right') return 'Look right';
  if (angle === 'up') return 'Look up';
  return 'Look down';
}

function waitMs(durationMs: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
}

function stopVideoStream(videoElement: HTMLVideoElement | null) {
  if (!videoElement) return;
  const source = videoElement.srcObject;
  if (!(source instanceof MediaStream)) return;
  for (const track of source.getTracks()) {
    track.stop();
  }
  videoElement.srcObject = null;
}

async function loadFaceLandmarker() {
  if (faceLandmarkerPromise) return faceLandmarkerPromise;

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

export function useFaceCapture({
  videoElement,
  streamActive,
  captureSnapshot,
  storageKey,
}: UseFaceCaptureParams) {
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const detectionTimerRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const cooldownUntilRef = useRef<number>(0);
  const autoCaptureLockRef = useRef(false);
  const currentAngleRef = useRef<VerificationAngle>('front');
  const latestShotsRef = useRef<CapturedShotsByAngle>(emptyCapturedShots());
  const finalizedRef = useRef(false);
  const persistenceEnabledRef = useRef(true);

  const [modelReady, setModelReady] = useState(false);
  const [modelErrorMessage, setModelErrorMessage] = useState<string | null>(null);
  const [activeAngle, setActiveAngle] = useState<VerificationAngle>('front');
  const [capturedShots, setCapturedShots] = useState<CapturedShotsByAngle>(emptyCapturedShots());
  const [isAutoCapturing, setIsAutoCapturing] = useState(false);
  const [feedback, setFeedback] = useState<FaceCaptureState['feedback']>({
    guidanceState: 'no_face',
    instruction: perAngleInstruction.front,
    liveMessage: 'Look forward',
    holdProgress: 0,
    readiness: {
      faceDetected: false,
      singleFace: false,
      faceLargeEnough: false,
      centered: true,
      sharpEnough: true,
      brightnessOk: true,
      angleMatch: false,
    },
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
    finalizedRef.current = canSubmit;
  }, [canSubmit]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let raw: string | null = null;
    try {
      raw = window.sessionStorage.getItem(storageKey);
    } catch {
      persistenceEnabledRef.current = false;
      return;
    }

    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as CapturePersistencePayload;
      if (parsed.version !== captureStorageVersion || !Array.isArray(parsed.shots)) return;

      const restored = emptyCapturedShots();
      for (const shot of parsed.shots) {
        if (!guidedAngles.includes(shot.angle)) continue;
        const blob = dataUrlToBlob(shot.dataUrl);
        if (!blob) continue;

        restored[shot.angle].push({
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
        });
      }

      setCapturedShots(restored);
      if (guidedAngles.includes(parsed.activeAngle)) {
        setActiveAngle(parsed.activeAngle);
      }
    } catch {
      // ignore malformed payload
    }
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!persistenceEnabledRef.current) return;

    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(getStoragePayload(activeAngle, capturedShots)));
    } catch {
      persistenceEnabledRef.current = false;
    }
  }, [activeAngle, capturedShots, storageKey]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        setModelErrorMessage(null);
        const landmarker = await loadFaceLandmarker();
        if (cancelled) return;
        landmarkerRef.current = landmarker;
        setModelReady(true);
      } catch {
        if (cancelled) return;
        setModelReady(false);
        setModelErrorMessage('Face guidance is temporarily unavailable. Please refresh and try again.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      for (const shot of Object.values(latestShotsRef.current)) {
        for (const frame of shot) {
          URL.revokeObjectURL(frame.previewUrl);
        }
      }

      if (landmarkerRef.current) {
        try {
          landmarkerRef.current.close();
        } catch {
          // ignore
        } finally {
          landmarkerRef.current = null;
          faceLandmarkerPromise = null;
        }
      }

      stopVideoStream(videoElement);
    };
  }, [videoElement]);

  const safeDetect = useCallback((targetVideoElement: HTMLVideoElement | null) => {
    if (!landmarkerRef.current) return null;
    if (!targetVideoElement || targetVideoElement.readyState < 2) return null;

    try {
      return landmarkerRef.current.detectForVideo(targetVideoElement, performance.now());
    } catch {
      return null;
    }
  }, []);

  const captureAngle = useCallback(
    async (targetAngle: VerificationAngle, force: boolean) => {
      if (!videoElement) return false;
      if (finalizedRef.current) return false;
      if (isAngleComplete(latestShotsRef.current, targetAngle)) return false;
      if (!force && currentAngleRef.current !== targetAngle) return false;

      const candidates: CapturedShot[] = [];
      for (let i = 0; i < BURST_CAPTURE_FRAME_COUNT; i += 1) {
        if (finalizedRef.current) break;
        if (isAngleComplete(latestShotsRef.current, targetAngle)) break;
        if (!force && currentAngleRef.current !== targetAngle) break;
        const detection = safeDetect(videoElement);
        const faces = detection?.faceLandmarks ?? [];

        if (force || faces.length === 1) {
          let yaw = 0;
          let pitch = 0;
          let faceAreaRatio = 0;

          if (faces.length === 1) {
            const landmarks = faces[0];
            const box = computeFaceBox(landmarks);
            faceAreaRatio = Math.max(0, (box.maxX - box.minX) * (box.maxY - box.minY));
            const pose = estimateYawPitch(landmarks);
            yaw = pose.yaw;
            pitch = pose.pitch;
          }

          const angleOk = force ? true : isRoughAngleMatch(targetAngle, yaw, pitch);
          const sizeOk = force ? true : faceAreaRatio >= MIN_FACE_AREA_RATIO;

          const snapshot = await captureSnapshot();
          if (snapshot && snapshot.size >= MIN_CAPTURE_FILE_SIZE_BYTES) {
            const dataUrl = await blobToDataUrl(snapshot);
            const warnings: string[] = [];
            if (force) warnings.push('manual_fallback');
            if (!angleOk) warnings.push('angle');
            if (!sizeOk) warnings.push('face_size');
            candidates.push({
              angle: targetAngle,
              blob: snapshot,
              dataUrl,
              previewUrl: toBlobUrl(snapshot),
              capturedAt: Date.now(),
              quality: {
                yaw,
                pitch,
                faceAreaRatio,
                centerOffset: 0,
                blurVariance: 0,
                brightness: 0,
                captureConfidence: !force && angleOk && sizeOk ? 'ideal' : 'near_ready',
                warnings,
              },
            });
          }
        }

        if (i < BURST_CAPTURE_FRAME_COUNT - 1) {
          await waitMs(BURST_CAPTURE_GAP_MS);
        }
      }

      if (candidates.length === 0) return false;

      setCapturedShots((current) => {
        if (isAngleComplete(current, targetAngle)) {
          for (const candidate of candidates) {
            URL.revokeObjectURL(candidate.previewUrl);
          }
          return current;
        }
        for (const previous of current[targetAngle]) {
          URL.revokeObjectURL(previous.previewUrl);
        }
        return { ...current, [targetAngle]: candidates };
      });

      const nextShots: CapturedShotsByAngle = {
        ...latestShotsRef.current,
        [targetAngle]: candidates,
      };
      const nextAngle = findFirstMissingAngle(nextShots);
      cooldownUntilRef.current = performance.now() + POST_CAPTURE_COOLDOWN_MS;
      if (nextAngle) {
        setActiveAngle(nextAngle);
      } else {
        finalizedRef.current = true;
        stopVideoStream(videoElement);
      }
      return true;
    },
    [captureSnapshot, safeDetect, videoElement]
  );

  useEffect(() => {
    if (!streamActive || !videoElement || !modelReady || canSubmit) return;
    runningRef.current = true;

    let cancelled = false;
    const scheduleNext = () => {
      if (cancelled) return;
      detectionTimerRef.current = window.setTimeout(loop, detectionIntervalMs);
    };

    const loop = () => {
      if (cancelled || !runningRef.current) return;
      if (finalizedRef.current || allAnglesComplete(latestShotsRef.current)) {
        finalizedRef.current = true;
        runningRef.current = false;
        const timerId = detectionTimerRef.current;
        if (timerId !== null) window.clearTimeout(timerId);
        detectionTimerRef.current = null;
        setIsAutoCapturing(false);
        stopVideoStream(videoElement);
        return;
      }
      if (!videoElement || videoElement.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        scheduleNext();
        return;
      }

      const now = performance.now();
      if (now < cooldownUntilRef.current) {
        setFeedback((prev) => ({ ...prev, guidanceState: 'cooldown', liveMessage: 'Captured', holdProgress: 0 }));
        scheduleNext();
        return;
      }

      const angle = currentAngleRef.current;
      if (isAngleComplete(latestShotsRef.current, angle)) {
        const nextAngle = findFirstMissingAngle(latestShotsRef.current);
        if (nextAngle) {
          setActiveAngle(nextAngle);
          scheduleNext();
          return;
        }
        finalizedRef.current = true;
        runningRef.current = false;
        stopVideoStream(videoElement);
        return;
      }
      const detection = safeDetect(videoElement);
      const faces = detection?.faceLandmarks ?? [];

      if (faces.length === 0) {
        setFeedback({
          guidanceState: 'no_face',
          instruction: getAngleGuidance(angle),
          liveMessage: 'Center your face',
          holdProgress: 0,
          readiness: {
            faceDetected: false,
            singleFace: false,
            faceLargeEnough: false,
            centered: true,
            sharpEnough: true,
            brightnessOk: true,
            angleMatch: false,
          },
        });
        scheduleNext();
        return;
      }

      if (faces.length > 1) {
        setFeedback({
          guidanceState: 'multiple_faces',
          instruction: getAngleGuidance(angle),
          liveMessage: 'Only one face should be visible',
          holdProgress: 0,
          readiness: {
            faceDetected: true,
            singleFace: false,
            faceLargeEnough: false,
            centered: true,
            sharpEnough: true,
            brightnessOk: true,
            angleMatch: false,
          },
        });
        scheduleNext();
        return;
      }

      const landmarks = faces[0];
      const box = computeFaceBox(landmarks);
      const faceAreaRatio = Math.max(0, (box.maxX - box.minX) * (box.maxY - box.minY));
      const pose = estimateYawPitch(landmarks);
      const nearAngle = isRoughAngleMatch(angle, pose.yaw, pose.pitch);

      if (faceAreaRatio < MIN_FACE_AREA_RATIO) {
        setFeedback({
          guidanceState: 'face_too_small',
          instruction: getAngleGuidance(angle),
          liveMessage: 'Move closer',
          holdProgress: 0,
          readiness: {
            faceDetected: true,
            singleFace: true,
            faceLargeEnough: false,
            centered: true,
            sharpEnough: true,
            brightnessOk: true,
            angleMatch: nearAngle,
          },
        });
        scheduleNext();
        return;
      }

      setFeedback({
        guidanceState: nearAngle ? 'ready' : 'wrong_angle',
        instruction: getAngleGuidance(angle),
        liveMessage: nearAngle ? `Capturing ${angle}...` : getAngleGuidance(angle),
        holdProgress: nearAngle ? 1 : 0,
        readiness: {
          faceDetected: true,
          singleFace: true,
          faceLargeEnough: true,
          centered: true,
          sharpEnough: true,
          brightnessOk: true,
          angleMatch: nearAngle,
        },
      });

      if (!nearAngle || autoCaptureLockRef.current) {
        scheduleNext();
        return;
      }

      autoCaptureLockRef.current = true;
      setIsAutoCapturing(true);

      void (async () => {
        try {
          await captureAngle(angle, false);
        } finally {
          autoCaptureLockRef.current = false;
          setIsAutoCapturing(false);
          scheduleNext();
        }
      })();
    };

    loop();

    return () => {
      cancelled = true;
      runningRef.current = false;
      const timerId = detectionTimerRef.current;
      if (timerId !== null) window.clearTimeout(timerId);
      detectionTimerRef.current = null;
      autoCaptureLockRef.current = false;
    };
  }, [canSubmit, captureAngle, modelReady, safeDetect, streamActive, videoElement]);

  const retakeAngle = useCallback((angle: VerificationAngle) => {
    setCapturedShots((current) => {
      const next = { ...current };
      for (const existing of next[angle]) {
        URL.revokeObjectURL(existing.previewUrl);
      }
      next[angle] = [];
      return next;
    });
    cooldownUntilRef.current = 0;
    setActiveAngle(angle);
    setFeedback((prev) => ({ ...prev, instruction: getAngleGuidance(angle), liveMessage: getAngleGuidance(angle), holdProgress: 0 }));
  }, []);

  const focusAngle = useCallback((angle: VerificationAngle) => {
    setActiveAngle(angle);
  }, []);

  const captureAnyway = useCallback(async () => {
    if (!streamActive || !videoElement || isAutoCapturing || canSubmit) return false;
    const ok = await captureAngle(currentAngleRef.current, true);
    if (!ok) {
      setFeedback((prev) => ({ ...prev, liveMessage: 'Capture failed. Try again.' }));
    }
    return ok;
  }, [captureAngle, isAutoCapturing, streamActive, videoElement]);

  const clearSession = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.removeItem(storageKey);
      } catch {
        // ignore
      }
    }
  }, [storageKey]);

  const capturesByAngle = useMemo(() => {
    return guidedAngles.reduce(
      (accumulator, angle) => {
        accumulator[angle] = capturedShots[angle].map((shot) => shot.blob);
        return accumulator;
      },
      { front: [], left: [], right: [], up: [], down: [] } as VerificationCapturesByAngle
    );
  }, [capturedShots]);

  const frameMetadataByAngle = useMemo(() => {
    return guidedAngles.reduce(
      (accumulator, angle) => {
        accumulator[angle] = capturedShots[angle].map((shot) => ({
          capturedAt: shot.capturedAt,
        }));
        return accumulator;
      },
      { front: [], left: [], right: [], up: [], down: [] } as VerificationFrameMetadataByAngle
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
    frameMetadataByAngle,
    firstMissingAngle,
    retakeAngle,
    focusAngle,
    captureAnyway,
    clearSession,
  };
}
