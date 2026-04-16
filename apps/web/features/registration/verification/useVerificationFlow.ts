import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  autoCaptureDelayMs,
  betweenCapturePauseMs,
  captureConfirmedDisplayMs,
  requiredCapturesPerAngle,
  verificationAngles,
} from '@/features/registration/verification/constants';
import { useCaptureValidation } from '@/features/registration/verification/useCaptureValidation';
import type {
  CaptureState,
  CaptureSource,
  CaptureValidation,
  CapturedFrame,
  CapturesByAngle,
  FrameAnalysis,
  PoseReading,
  VerificationAngle,
  VerificationAngleId,
} from '@/features/registration/verification/types';

type VerificationFlowState = {
  angles: VerificationAngle[];
  currentAngle: VerificationAngle;
  step: number;
  currentAngleIndex: number;
  currentAngleAccepted: number;
  currentCaptureIndex: number;
  capture: number;
  capturesByAngle: CapturesByAngle;
  capturedImages: CapturedFrame[];
  feedback: string;
  statusLabel: string;
  captureState: CaptureState;
  validation: CaptureValidation;
  canCapture: boolean;
  rejectedMessage: string | null;
  lastAcceptedAt: number | null;
  overallAccepted: number;
  totalRequired: number;
  progress: number;
  progressPercent: number;
  isAutoCaptureEnabled: boolean;
  isAutoCaptureActive: boolean;
  isCapturing: boolean;
  isDebugModeEnabled: boolean;
  isRelaxThresholdsEnabled: boolean;
  isManualFallback: boolean;
  isComplete: boolean;
  debug: {
    yaw: number;
    rawYaw: number;
    pitch: number;
    rawPitch: number;
    rawFaceCenter: { x: number; y: number } | null;
    currentAngle: VerificationAngleId;
    faceDetected: boolean;
    isCentered: boolean;
    poseMatched: boolean;
    isStable: boolean;
    lightingOk: boolean;
    isSharpEnough: boolean;
    canCapture: boolean;
    poseHoldSatisfied: boolean;
    acceptedShotsForCurrentAngle: number;
    totalAcceptedShots: number;
    cooldownRemainingMs: number;
    cameraReady: boolean;
    landmarkModelLoaded: boolean;
    landmarksDetected: boolean;
    fallbackPoseUsed: boolean;
    rawLandmarkCount: number | null;
    captureTriggerCount: number;
    blockingReason: string;
    expectedYawRange: [number, number] | null;
    expectedPitchRange: [number, number] | null;
    poseHoldMs: number;
    requiredPoseHoldMs: number;
    stabilityMs: number;
    requiredStabilityMs: number;
  };
  toggleDebugMode: () => void;
  toggleRelaxThresholds: () => void;
  captureManually: () => void;
  retakeCurrentShot: () => void;
  enableManualFallback: () => void;
  resumeAutoCapture: () => void;
};

function createInitialCaptureMap(): CapturesByAngle {
  return {
    front: [],
    left: [],
    right: [],
    up: [],
    down: [],
  };
}

function makeCaptureId(angleId: VerificationAngleId) {
  return `${angleId}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

type UseVerificationFlowOptions = {
  streamActive: boolean;
  captureFrame: () => string | null;
  readFrameAnalysis: () => FrameAnalysis | null;
  readPoseEstimation: () => PoseReading | null;
};

export function useVerificationFlow({
  streamActive,
  captureFrame,
  readFrameAnalysis,
  readPoseEstimation,
}: UseVerificationFlowOptions): VerificationFlowState {
  const [capturesByAngle, setCapturesByAngle] = useState<CapturesByAngle>(
    createInitialCaptureMap
  );
  const [currentAngleIndex, setCurrentAngleIndex] = useState(0);
  const [isAutoCaptureEnabled, setIsAutoCaptureEnabled] = useState(false);
  const [isDebugModeEnabled, setIsDebugModeEnabled] = useState(true);
  const [isRelaxThresholdsEnabled, setIsRelaxThresholdsEnabled] =
    useState(false);
  const [isManualFallback, setIsManualFallback] = useState(true);
  const [isCapturing, setIsCapturing] = useState(false);
  const [rejectedMessage, setRejectedMessage] = useState<string | null>(null);
  const [lastAcceptedAt, setLastAcceptedAt] = useState<number | null>(null);
  const [frame, setFrame] = useState<FrameAnalysis | null>(null);
  const [faceFromPose, setFaceFromPose] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [pose, setPose] = useState({ yaw: 0, pitch: 0 });
  const [rawPose, setRawPose] = useState<{
    yaw: number;
    pitch: number;
    faceCenter: { x: number; y: number } | null;
    cameraReady: boolean;
    landmarkModelLoaded: boolean;
    landmarksDetected: boolean;
    fallbackPoseUsed: boolean;
    rawLandmarkCount: number | null;
  }>({
    yaw: 0,
    pitch: 0,
    faceCenter: null,
    cameraReady: false,
    landmarkModelLoaded: false,
    landmarksDetected: false,
    fallbackPoseUsed: true,
    rawLandmarkCount: null,
  });
  const [cooldownRemainingMs, setCooldownRemainingMs] = useState(0);
  const [captureTriggerCount, setCaptureTriggerCount] = useState(0);
  const lastCaptureTimeRef = useRef(0);
  const previousCanCaptureRef = useRef(false);
  const acceptCaptureRef = useRef<(source: CaptureSource) => void>(() => {});
  const previousDebugRef = useRef<{
    angle: VerificationAngleId | null;
    canCapture: boolean | null;
    poseMatched: boolean | null;
    poseHoldSatisfied: boolean | null;
    accepted: number;
  }>({
    angle: null,
    canCapture: null,
    poseMatched: null,
    poseHoldSatisfied: null,
    accepted: 0,
  });
  const CAPTURE_COOLDOWN = 1000;

  const clamp = (value: number, min: number, max: number) => {
    return Math.max(min, Math.min(max, value));
  };

  const currentAngle = verificationAngles[currentAngleIndex];
  const currentAngleAccepted = capturesByAngle[currentAngle.id].length;
  const totalRequired = verificationAngles.length * requiredCapturesPerAngle;

  const overallAccepted = useMemo(
    () =>
      verificationAngles.reduce(
        (total, angle) => total + capturesByAngle[angle.id].length,
        0
      ),
    [capturesByAngle]
  );

  const capturedImages = useMemo(
    () =>
      verificationAngles
        .flatMap((angle) => capturesByAngle[angle.id])
        .sort((a, b) => {
          return a.capturedAt - b.capturedAt;
        }),
    [capturesByAngle]
  );

  const progressPercent = Math.round((overallAccepted / totalRequired) * 100);
  const progress = progressPercent;
  const isComplete = overallAccepted >= totalRequired;

  useEffect(() => {
    if (!streamActive || isComplete) {
      return;
    }

    let frameRequest = 0;
    let mounted = true;

    const readNextFrame = () => {
      if (!mounted) {
        return;
      }

      const nextFrame = readFrameAnalysis();
      const nextPose = readPoseEstimation();
      setFrame(nextFrame);

      if (nextPose?.face) {
        setFaceFromPose(nextPose.face);
        setRawPose({
          yaw: nextPose.rawYaw,
          pitch: nextPose.rawPitch,
          faceCenter: nextPose.rawFaceCenter,
          cameraReady: nextPose.cameraReady,
          landmarkModelLoaded: nextPose.landmarkModelLoaded,
          landmarksDetected: nextPose.landmarksDetected,
          fallbackPoseUsed: nextPose.fallbackPoseUsed,
          rawLandmarkCount: nextPose.rawLandmarkCount,
        });
        setPose((previous) => ({
          yaw: previous.yaw * 0.76 + nextPose.yaw * 0.24,
          pitch: previous.pitch * 0.76 + nextPose.pitch * 0.24,
        }));
      } else if (nextFrame) {
        setFaceFromPose(null);
        const rawYaw = clamp(
          -(nextFrame.faceOffsetX * 32 + nextFrame.horizontalBalance * 85),
          -45,
          45
        );
        const rawPitch = clamp(
          nextFrame.faceOffsetY * 28 - nextFrame.verticalBalance * 55,
          -35,
          35
        );

        setRawPose({
          yaw: rawYaw,
          pitch: rawPitch,
          faceCenter: {
            x: clamp((nextFrame.faceOffsetX + 1) / 2, 0, 1),
            y: clamp((nextFrame.faceOffsetY + 1) / 2, 0, 1),
          },
          cameraReady: true,
          landmarkModelLoaded: false,
          landmarksDetected: false,
          fallbackPoseUsed: true,
          rawLandmarkCount: null,
        });

        setPose((previous) => ({
          yaw: previous.yaw * 0.72 + rawYaw * 0.28,
          pitch: previous.pitch * 0.72 + rawPitch * 0.28,
        }));
      } else {
        setRawPose((previous) => ({
          ...previous,
          cameraReady: false,
          landmarksDetected: false,
        }));
      }

      frameRequest = window.requestAnimationFrame(readNextFrame);
    };

    frameRequest = window.requestAnimationFrame(readNextFrame);

    return () => {
      mounted = false;
      if (frameRequest) {
        window.cancelAnimationFrame(frameRequest);
      }
    };
  }, [isComplete, readFrameAnalysis, readPoseEstimation, streamActive]);

  const inferredFace = useMemo(() => {
    if (faceFromPose) {
      return faceFromPose;
    }

    if (!frame) {
      return null;
    }

    const detectableFace =
      frame.contrast > 0.018 &&
      frame.sharpness > 0.012 &&
      frame.centerContrastRatio > 0.42;

    if (!detectableFace) {
      return null;
    }

    return {
      x: (frame.faceOffsetX + 1) / 2,
      y: (frame.faceOffsetY + 1) / 2,
    };
  }, [faceFromPose, frame]);

  const yaw = pose.yaw;
  const pitch = pose.pitch;

  const { validation, captureState, primaryMessage, statusLabel } =
    useCaptureValidation({
      face: inferredFace,
      yaw,
      pitch,
      frame,
      currentAngle: currentAngle.id,
      relaxThresholdsEnabled: isRelaxThresholdsEnabled,
    });

  const feedback = rejectedMessage ?? validation.feedback ?? primaryMessage;
  const canCapture = validation.canCapture;
  const isAutoCaptureActive =
    streamActive &&
    !isComplete &&
    isAutoCaptureEnabled &&
    !isManualFallback &&
    currentAngleAccepted < requiredCapturesPerAngle;

  const blockingReason = useMemo(() => {
    if (!rawPose.cameraReady || !streamActive) {
      return 'camera-not-ready';
    }

    if (!rawPose.landmarkModelLoaded && !rawPose.fallbackPoseUsed) {
      return 'landmarks-missing';
    }

    if (!validation.faceDetected) {
      return 'no-face';
    }

    if (!validation.isCentered) {
      return 'not-centered';
    }

    if (!validation.poseMatched) {
      return 'wrong-pose';
    }

    if (!validation.isStable) {
      return 'unstable';
    }

    if (!validation.lightingOk) {
      return 'bad-lighting';
    }

    if (!validation.isSharpEnough) {
      return 'blurry';
    }

    if (!validation.poseHoldSatisfied) {
      return 'pose-hold-not-satisfied';
    }

    if (isCapturing) {
      return 'already-capturing';
    }

    if (cooldownRemainingMs > 0) {
      return 'cooldown-active';
    }

    if (validation.canCapture) {
      return 'ready';
    }

    return 'unknown';
  }, [
    cooldownRemainingMs,
    isCapturing,
    rawPose.cameraReady,
    rawPose.fallbackPoseUsed,
    rawPose.landmarkModelLoaded,
    streamActive,
    validation.canCapture,
    validation.faceDetected,
    validation.isCentered,
    validation.isSharpEnough,
    validation.isStable,
    validation.lightingOk,
    validation.poseHoldSatisfied,
    validation.poseMatched,
  ]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCooldownRemainingMs(
        Math.max(
          0,
          CAPTURE_COOLDOWN - (Date.now() - lastCaptureTimeRef.current)
        )
      );
    }, 100);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!rejectedMessage) {
      return;
    }

    const timer = window.setTimeout(() => {
      setRejectedMessage(null);
    }, 1200);

    return () => {
      window.clearTimeout(timer);
    };
  }, [rejectedMessage]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production' || !isDebugModeEnabled) {
      return;
    }

    if (previousDebugRef.current.angle !== currentAngle.id) {
      previousDebugRef.current.angle = currentAngle.id;
      console.log('[verification-debug]', {
        event: 'angle-change',
        currentAngle: currentAngle.id,
        acceptedShotsForCurrentAngle: currentAngleAccepted,
      });
    }
  }, [currentAngle.id, currentAngleAccepted, isDebugModeEnabled]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production' || !isDebugModeEnabled) {
      return;
    }

    if (previousDebugRef.current.canCapture !== validation.canCapture) {
      previousDebugRef.current.canCapture = validation.canCapture;
      console.log('[verification-debug]', {
        event: 'can-capture-change',
        canCapture: validation.canCapture,
        blockingReason,
      });
    }
  }, [blockingReason, isDebugModeEnabled, validation.canCapture]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production' || !isDebugModeEnabled) {
      return;
    }

    console.log('[verification-debug]', {
      event: 'blocking-reason-change',
      blockingReason,
    });
  }, [blockingReason, isDebugModeEnabled]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production' || !isDebugModeEnabled) {
      return;
    }

    if (previousDebugRef.current.poseMatched !== validation.poseMatched) {
      previousDebugRef.current.poseMatched = validation.poseMatched;
      console.log('[pose]', {
        event: 'pose-matched-change',
        poseMatched: validation.poseMatched,
        currentAngle: currentAngle.id,
        yaw,
        pitch,
        expectedYawRange: validation.expectedYawRange,
        expectedPitchRange: validation.expectedPitchRange,
      });
    }
  }, [
    currentAngle.id,
    isDebugModeEnabled,
    pitch,
    validation.expectedPitchRange,
    validation.expectedYawRange,
    validation.poseMatched,
    yaw,
  ]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production' || !isDebugModeEnabled) {
      return;
    }

    if (
      previousDebugRef.current.poseHoldSatisfied !==
      validation.poseHoldSatisfied
    ) {
      previousDebugRef.current.poseHoldSatisfied = validation.poseHoldSatisfied;
      console.log('[pose]', {
        event: 'pose-hold-change',
        poseHoldSatisfied: validation.poseHoldSatisfied,
        poseHoldMs: validation.poseHoldMs,
        requiredPoseHoldMs: validation.requiredPoseHoldMs,
      });
    }
  }, [
    isDebugModeEnabled,
    validation.poseHoldMs,
    validation.poseHoldSatisfied,
    validation.requiredPoseHoldMs,
  ]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production' || !isDebugModeEnabled) {
      return;
    }

    if (!rawPose.landmarkModelLoaded && !rawPose.landmarksDetected) {
      console.log('[verification-debug]', {
        event: 'missing-landmark-model-state',
        landmarkModelLoaded: rawPose.landmarkModelLoaded,
        landmarksDetected: rawPose.landmarksDetected,
        fallbackPoseUsed: rawPose.fallbackPoseUsed,
      });
    }
  }, [
    isDebugModeEnabled,
    rawPose.fallbackPoseUsed,
    rawPose.landmarkModelLoaded,
    rawPose.landmarksDetected,
  ]);

  const acceptCapture = useCallback(
    (source: CaptureSource) => {
      if (!streamActive || isComplete) {
        if (process.env.NODE_ENV !== 'production' && isDebugModeEnabled) {
          console.log('[capture]', {
            event: 'capture-rejected',
            source,
            reason: 'camera-not-ready',
          });
        }
        setIsCapturing(false);
        return;
      }

      if (currentAngleAccepted >= requiredCapturesPerAngle) {
        setRejectedMessage('Current angle is complete. Preparing next angle.');
        setIsCapturing(false);
        return;
      }

      if (!validation.canCapture) {
        if (process.env.NODE_ENV !== 'production' && isDebugModeEnabled) {
          console.log('[capture]', {
            event: 'capture-rejected',
            source,
            reason: blockingReason,
            validationMessage: validation.feedback || primaryMessage,
          });
        }
        setRejectedMessage(validation.feedback || primaryMessage);
        setIsCapturing(false);
        return;
      }

      const frameDataUrl = captureFrame();
      if (!frameDataUrl) {
        if (process.env.NODE_ENV !== 'production' && isDebugModeEnabled) {
          console.log('[capture]', {
            event: 'capture-rejected',
            source,
            reason: 'unknown',
            details: 'captureFrame returned null',
          });
        }
        setRejectedMessage(
          'Unable to capture frame. Please hold still and retry.'
        );
        setIsCapturing(false);
        return;
      }

      const capture: CapturedFrame = {
        id: makeCaptureId(currentAngle.id),
        angleId: currentAngle.id,
        source,
        dataUrl: frameDataUrl,
        capturedAt: Date.now(),
      };

      const nextCount = Math.min(
        currentAngleAccepted + 1,
        requiredCapturesPerAngle
      );

      setCapturesByAngle((current) => ({
        ...current,
        [currentAngle.id]: [...current[currentAngle.id], capture].slice(
          0,
          requiredCapturesPerAngle
        ),
      }));
      setRejectedMessage(null);
      setLastAcceptedAt(Date.now());

      if (process.env.NODE_ENV !== 'production' && isDebugModeEnabled) {
        console.log('[capture]', {
          event: 'capture-accepted',
          source,
          angle: currentAngle.id,
          acceptedShotsForCurrentAngle: nextCount,
          totalAcceptedShots: overallAccepted + 1,
        });
      }

      if (nextCount >= requiredCapturesPerAngle) {
        const hasNextAngle = currentAngleIndex < verificationAngles.length - 1;

        if (hasNextAngle) {
          if (process.env.NODE_ENV !== 'production' && isDebugModeEnabled) {
            console.log('[capture]', {
              event: 'next-angle-progression-fired',
              nextAngleIndex: currentAngleIndex + 1,
            });
          }
          window.setTimeout(() => {
            setCurrentAngleIndex((index) => index + 1);
          }, betweenCapturePauseMs);
        }
        setIsCapturing(false);
        return;
      }

      setIsCapturing(false);
    },
    [
      captureFrame,
      currentAngle.id,
      currentAngleAccepted,
      currentAngleIndex,
      isDebugModeEnabled,
      isComplete,
      blockingReason,
      overallAccepted,
      primaryMessage,
      streamActive,
      validation.feedback,
      validation.canCapture,
    ]
  );

  useEffect(() => {
    acceptCaptureRef.current = acceptCapture;
  }, [acceptCapture]);

  const captureManually = useCallback(() => {
    if (isComplete) {
      return;
    }

    setIsManualFallback(true);
    setIsAutoCaptureEnabled(false);
    acceptCapture('manual');
  }, [acceptCapture, isComplete]);

  const retakeCurrentShot = useCallback(() => {
    if (currentAngleAccepted === 0 || isComplete) {
      return;
    }

    setCapturesByAngle((current) => ({
      ...current,
      [currentAngle.id]: current[currentAngle.id].slice(0, -1),
    }));
    setLastAcceptedAt(null);
    setRejectedMessage('Latest shot removed. Capture again when ready.');
  }, [currentAngle.id, currentAngleAccepted, isComplete]);

  const enableManualFallback = useCallback(() => {
    setIsManualFallback(true);
    setIsAutoCaptureEnabled(false);
  }, []);

  const resumeAutoCapture = useCallback(() => {
    if (isComplete) {
      return;
    }

    setIsManualFallback(false);
    setIsAutoCaptureEnabled(true);
  }, [isComplete]);

  useEffect(() => {
    const canAutoCaptureNow =
      isAutoCaptureActive &&
      streamActive &&
      !isComplete &&
      !isCapturing &&
      currentAngleAccepted < requiredCapturesPerAngle;

    const justBecameCapturable =
      validation.canCapture && !previousCanCaptureRef.current;

    previousCanCaptureRef.current = validation.canCapture;

    if (!canAutoCaptureNow || !justBecameCapturable) {
      return;
    }

    if (process.env.NODE_ENV !== 'production' && isDebugModeEnabled) {
      console.log('[auto-capture]', {
        event: 'trigger-attempt',
        canAutoCaptureNow,
        canCapture: validation.canCapture,
        blockingReason,
      });
    }
    const triggerCountTimer = window.setTimeout(() => {
      setCaptureTriggerCount((value) => value + 1);
    }, 0);

    const now = Date.now();
    if (now - lastCaptureTimeRef.current < CAPTURE_COOLDOWN) {
      if (process.env.NODE_ENV !== 'production' && isDebugModeEnabled) {
        console.log('[auto-capture]', {
          event: 'cooldown-block',
          cooldownRemainingMs:
            CAPTURE_COOLDOWN - (now - lastCaptureTimeRef.current),
        });
      }
      window.clearTimeout(triggerCountTimer);
      window.setTimeout(() => {
        setCaptureTriggerCount((value) => value + 1);
      }, 0);
      return;
    }

    const timer = window.setTimeout(() => {
      lastCaptureTimeRef.current = Date.now();
      if (process.env.NODE_ENV !== 'production' && isDebugModeEnabled) {
        console.log('[auto-capture]', {
          event: 'capture-frame-invoked',
          source: 'auto',
        });
      }
      setIsCapturing(true);
      acceptCaptureRef.current('auto');
    }, autoCaptureDelayMs);

    return () => {
      window.clearTimeout(triggerCountTimer);
      window.clearTimeout(timer);
    };
  }, [
    acceptCapture,
    currentAngleAccepted,
    currentAngle.id,
    isAutoCaptureActive,
    isDebugModeEnabled,
    isCapturing,
    isComplete,
    streamActive,
    blockingReason,
    validation.canCapture,
  ]);

  useEffect(() => {
    if (!lastAcceptedAt) {
      return;
    }

    const timer = window.setTimeout(() => {
      setLastAcceptedAt(null);
    }, captureConfirmedDisplayMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [lastAcceptedAt]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production' || !isDebugModeEnabled) {
      return;
    }

    if (previousDebugRef.current.accepted !== overallAccepted) {
      previousDebugRef.current.accepted = overallAccepted;
      console.log('[verification-debug]', {
        event: 'accepted-shot-progression',
        acceptedShotsForCurrentAngle: currentAngleAccepted,
        totalAcceptedShots: overallAccepted,
      });
    }
  }, [currentAngleAccepted, isDebugModeEnabled, overallAccepted]);

  const toggleDebugMode = useCallback(() => {
    setIsDebugModeEnabled((value) => !value);
  }, []);

  const toggleRelaxThresholds = useCallback(() => {
    setIsRelaxThresholdsEnabled((value) => !value);
  }, []);

  return {
    angles: verificationAngles,
    currentAngle,
    step: currentAngleIndex,
    currentAngleIndex,
    currentAngleAccepted,
    currentCaptureIndex: Math.min(
      currentAngleAccepted + 1,
      requiredCapturesPerAngle
    ),
    capture: Math.min(currentAngleAccepted + 1, requiredCapturesPerAngle),
    capturesByAngle,
    capturedImages,
    feedback,
    statusLabel,
    captureState,
    validation,
    canCapture,
    rejectedMessage,
    lastAcceptedAt,
    overallAccepted,
    totalRequired,
    progress,
    progressPercent,
    isAutoCaptureEnabled,
    isAutoCaptureActive,
    isCapturing,
    isDebugModeEnabled,
    isRelaxThresholdsEnabled,
    isManualFallback,
    isComplete,
    debug: {
      yaw,
      rawYaw: rawPose.yaw,
      pitch,
      rawPitch: rawPose.pitch,
      rawFaceCenter: rawPose.faceCenter,
      currentAngle: currentAngle.id,
      faceDetected: validation.faceDetected,
      isCentered: validation.isCentered,
      poseMatched: validation.poseMatched,
      isStable: validation.isStable,
      lightingOk: validation.lightingOk,
      isSharpEnough: validation.isSharpEnough,
      canCapture: validation.canCapture,
      poseHoldSatisfied: validation.poseHoldSatisfied,
      acceptedShotsForCurrentAngle: currentAngleAccepted,
      totalAcceptedShots: overallAccepted,
      cooldownRemainingMs,
      cameraReady: rawPose.cameraReady,
      landmarkModelLoaded: rawPose.landmarkModelLoaded,
      landmarksDetected: rawPose.landmarksDetected,
      fallbackPoseUsed: rawPose.fallbackPoseUsed,
      rawLandmarkCount: rawPose.rawLandmarkCount,
      captureTriggerCount,
      blockingReason,
      expectedYawRange: validation.expectedYawRange,
      expectedPitchRange: validation.expectedPitchRange,
      poseHoldMs: validation.poseHoldMs,
      requiredPoseHoldMs: validation.requiredPoseHoldMs,
      stabilityMs: validation.stabilityMs,
      requiredStabilityMs: validation.requiredStabilityMs,
    },
    toggleDebugMode,
    toggleRelaxThresholds,
    captureManually,
    retakeCurrentShot,
    enableManualFallback,
    resumeAutoCapture,
  };
}
