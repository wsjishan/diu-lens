import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  CameraHookResult,
  FrameAnalysis,
  PermissionState,
  PoseReading,
} from '@/features/registration/verification/types';

const mediaConstraints: MediaStreamConstraints = {
  audio: false,
  video: {
    facingMode: { ideal: 'user' },
    width: { ideal: 1280 },
    height: { ideal: 720 },
  },
};

function stopMediaTracks(stream: MediaStream | null) {
  if (!stream) {
    return;
  }

  stream.getTracks().forEach((track) => track.stop());
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function useCamera(): CameraHookResult {
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const analysisCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previousLumaRef = useRef<Float32Array | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const poseRef = useRef<PoseReading | null>(null);
  const lastPoseAtRef = useRef(0);
  const [videoAttachVersion, setVideoAttachVersion] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<PermissionState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const streamActive = Boolean(stream);

  useEffect(() => {
    streamRef.current = stream;
  }, [stream]);

  const videoRef = useCallback((node: HTMLVideoElement | null) => {
    videoElementRef.current = node;
    setVideoAttachVersion((value) => value + 1);
  }, []);

  const stopStream = useCallback(() => {
    const videoElement = videoElementRef.current;

    if (videoElement) {
      videoElement.pause();
      videoElement.srcObject = null;
    }

    stopMediaTracks(streamRef.current);
    streamRef.current = null;
    setStream(null);
    previousLumaRef.current = null;
    poseRef.current = null;
  }, []);

  useEffect(() => {
    const videoElement = videoElementRef.current;

    if (!videoElement) {
      return;
    }

    if (!stream) {
      videoElement.pause();
      videoElement.srcObject = null;
      return;
    }

    videoElement.srcObject = stream;
    videoElement.muted = true;
    videoElement.playsInline = true;

    const playVideo = async () => {
      try {
        await videoElement.play();
      } catch {
        // Ignore initial autoplay races and retry on media readiness events.
      }
    };

    const retryPlayback = () => {
      void playVideo();
    };

    videoElement.addEventListener('loadedmetadata', retryPlayback);
    videoElement.addEventListener('canplay', retryPlayback);

    void playVideo();

    return () => {
      videoElement.removeEventListener('loadedmetadata', retryPlayback);
      videoElement.removeEventListener('canplay', retryPlayback);
    };
  }, [stream, videoAttachVersion]);

  const requestAccess = useCallback(async () => {
    if (!navigator?.mediaDevices?.getUserMedia) {
      setStatus('unsupported');
      setErrorMessage('Camera API is not supported by this browser.');
      return false;
    }

    try {
      setStatus('requesting');
      setErrorMessage(null);

      const nextStream =
        await navigator.mediaDevices.getUserMedia(mediaConstraints);

      if (streamRef.current) {
        stopMediaTracks(streamRef.current);
      }

      streamRef.current = nextStream;
      setStream(nextStream);

      setStatus('granted');
      return true;
    } catch (error) {
      stopStream();
      setStatus('denied');

      const errorName =
        error instanceof DOMException ? error.name : 'UnknownError';

      const messageByError: Record<string, string> = {
        NotAllowedError:
          'Camera permission was denied. Please allow access and try again.',
        NotFoundError: 'No camera device was found on this device.',
        NotReadableError:
          'Camera is currently in use by another app. Close other camera apps and retry.',
        OverconstrainedError:
          'Camera constraints could not be satisfied. Try a different device or browser.',
        SecurityError:
          'Camera access requires a secure context (HTTPS or localhost).',
      };

      setErrorMessage(
        messageByError[errorName] ??
          'Unable to start camera. Check camera permissions and try again.'
      );
      return false;
    }
  }, [stopStream]);

  const captureFrame = useCallback(() => {
    const videoElement = videoElementRef.current;

    if (!videoElement || !stream) {
      return null;
    }

    if (videoElement.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return null;
    }

    const width = videoElement.videoWidth;
    const height = videoElement.videoHeight;

    if (!width || !height) {
      return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) {
      return null;
    }

    context.drawImage(videoElement, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', 0.9);
  }, [stream]);

  const readFrameAnalysis = useCallback((): FrameAnalysis | null => {
    const videoElement = videoElementRef.current;

    if (!videoElement || !stream) {
      return null;
    }

    if (videoElement.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return null;
    }

    const width = 96;
    const height = 72;

    if (!analysisCanvasRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      analysisCanvasRef.current = canvas;
    }

    const canvas = analysisCanvasRef.current;
    const context = canvas.getContext('2d', {
      willReadFrequently: true,
    });

    if (!context) {
      return null;
    }

    context.drawImage(videoElement, 0, 0, width, height);
    const data = context.getImageData(0, 0, width, height).data;
    const pixelCount = width * height;

    let brightnessSum = 0;
    let leftSum = 0;
    let rightSum = 0;
    let topSum = 0;
    let bottomSum = 0;
    let centerSum = 0;
    let centerCount = 0;
    let edgeSum = 0;
    let weightedX = 0;
    let weightedY = 0;
    let gradientWeightSum = 0;

    const luma = new Float32Array(pixelCount);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const pixelIndex = y * width + x;
        const i = pixelIndex * 4;

        const r = data[i] ?? 0;
        const g = data[i + 1] ?? 0;
        const b = data[i + 2] ?? 0;

        const value = 0.299 * r + 0.587 * g + 0.114 * b;
        luma[pixelIndex] = value;
        brightnessSum += value;

        if (x < width / 2) {
          leftSum += value;
        } else {
          rightSum += value;
        }

        if (y < height / 2) {
          topSum += value;
        } else {
          bottomSum += value;
        }

        if (
          x >= width * 0.28 &&
          x <= width * 0.72 &&
          y >= height * 0.24 &&
          y <= height * 0.76
        ) {
          centerSum += value;
          centerCount += 1;
        }

        const horizontalGradient =
          x > 0 ? Math.abs(value - (luma[pixelIndex - 1] ?? value)) : 0;
        const verticalGradient =
          y > 0 ? Math.abs(value - (luma[pixelIndex - width] ?? value)) : 0;
        const gradientWeight = horizontalGradient + verticalGradient;

        edgeSum += gradientWeight;

        if (gradientWeight > 0) {
          weightedX += x * gradientWeight;
          weightedY += y * gradientWeight;
          gradientWeightSum += gradientWeight;
        }
      }
    }

    const avgBrightness = brightnessSum / pixelCount;

    let varianceSum = 0;
    let centerVarianceSum = 0;

    for (let i = 0; i < pixelCount; i += 1) {
      const value = luma[i] ?? avgBrightness;
      varianceSum += (value - avgBrightness) ** 2;
    }

    const centerAverage =
      centerCount > 0 ? centerSum / centerCount : avgBrightness;

    for (
      let y = Math.floor(height * 0.24);
      y <= Math.floor(height * 0.76);
      y += 1
    ) {
      for (
        let x = Math.floor(width * 0.28);
        x <= Math.floor(width * 0.72);
        x += 1
      ) {
        const index = y * width + x;
        const value = luma[index] ?? centerAverage;
        centerVarianceSum += (value - centerAverage) ** 2;
      }
    }

    const variance = varianceSum / pixelCount;
    const centerVariance =
      centerCount > 0 ? centerVarianceSum / centerCount : variance;

    let motionSum = 0;
    const hadPrevious = Boolean(previousLumaRef.current);

    if (hadPrevious && previousLumaRef.current) {
      for (let i = 0; i < pixelCount; i += 1) {
        motionSum += Math.abs(
          (luma[i] ?? 0) - (previousLumaRef.current[i] ?? 0)
        );
      }
    }

    previousLumaRef.current = luma;

    const leftAverage = leftSum / (pixelCount / 2);
    const rightAverage = rightSum / (pixelCount / 2);
    const topAverage = topSum / (pixelCount / 2);
    const bottomAverage = bottomSum / (pixelCount / 2);

    const estimatedCenterX =
      gradientWeightSum > 0 ? weightedX / gradientWeightSum : width / 2;
    const estimatedCenterY =
      gradientWeightSum > 0 ? weightedY / gradientWeightSum : height / 2;

    const faceOffsetX = (estimatedCenterX - width / 2) / (width / 2);
    const faceOffsetY = (estimatedCenterY - height / 2) / (height / 2);

    const bounded = (value: number) => Math.max(-1, Math.min(1, value));

    return {
      brightness: avgBrightness / 255,
      contrast: Math.sqrt(variance) / 255,
      sharpness: edgeSum / (pixelCount * 255 * 2),
      motion: hadPrevious ? motionSum / (pixelCount * 255) : 1,
      horizontalBalance: (rightAverage - leftAverage) / 255,
      verticalBalance: (topAverage - bottomAverage) / 255,
      faceOffsetX: bounded(faceOffsetX),
      faceOffsetY: bounded(faceOffsetY),
      centerContrastRatio:
        Math.sqrt(centerVariance) / (Math.sqrt(variance) + 0.0001),
    };
  }, [stream]);

  const readPoseEstimation = useCallback((): PoseReading | null => {
    const videoElement = videoElementRef.current;
    const cameraReady = Boolean(
      videoElement &&
      stream &&
      videoElement.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
    );

    if (!videoElement || !stream) {
      return null;
    }

    if (videoElement.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return null;
    }

    const now = performance.now();
    if (now - lastPoseAtRef.current < 66) {
      return poseRef.current;
    }

    lastPoseAtRef.current = now;
    const analysis = readFrameAnalysis();
    if (!analysis) {
      return poseRef.current;
    }

    const detectableFace =
      analysis.contrast > 0.018 &&
      analysis.sharpness > 0.012 &&
      analysis.centerContrastRatio > 0.42;

    if (!detectableFace) {
      poseRef.current = null;
      return null;
    }

    const yaw = clamp(
      -(analysis.faceOffsetX * 36 + analysis.horizontalBalance * 92),
      -45,
      45
    );
    const pitch = clamp(
      analysis.faceOffsetY * 30 - analysis.verticalBalance * 58,
      -30,
      30
    );

    const confidence = clamp(
      analysis.contrast * 3 + analysis.centerContrastRatio * 0.7,
      0,
      1
    );

    poseRef.current = {
      face: {
        x: clamp((analysis.faceOffsetX + 1) / 2, 0, 1),
        y: clamp((analysis.faceOffsetY + 1) / 2, 0, 1),
      },
      yaw,
      pitch,
      confidence,
      rawYaw: yaw,
      rawPitch: pitch,
      rawFaceCenter: {
        x: clamp((analysis.faceOffsetX + 1) / 2, 0, 1),
        y: clamp((analysis.faceOffsetY + 1) / 2, 0, 1),
      },
      landmarkModelLoaded: false,
      landmarksDetected: true,
      fallbackPoseUsed: true,
      rawLandmarkCount: null,
      cameraReady,
    };

    return poseRef.current;
  }, [readFrameAnalysis, stream]);

  const resetPermission = useCallback(() => {
    setErrorMessage(null);
    if (status === 'denied' || status === 'unsupported') {
      setStatus('idle');
    }
  }, [status]);

  useEffect(() => {
    return () => {
      stopMediaTracks(streamRef.current);
      streamRef.current = null;
      previousLumaRef.current = null;
      poseRef.current = null;
    };
  }, []);

  return {
    videoRef,
    status,
    errorMessage,
    streamActive,
    requestAccess,
    captureFrame,
    readFrameAnalysis,
    readPoseEstimation,
    resetPermission,
    stopStream,
  };
}
