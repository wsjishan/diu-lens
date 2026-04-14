import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  CameraHookResult,
  FrameAnalysis,
  PermissionState,
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

export function useCamera(): CameraHookResult {
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const analysisCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previousLumaRef = useRef<Float32Array | null>(null);
  const [videoAttachVersion, setVideoAttachVersion] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<PermissionState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const streamActive = Boolean(stream);

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

    stopMediaTracks(stream);
    setStream(null);
  }, [stream]);

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

    const playVideo = async () => {
      try {
        await videoElement.play();
      } catch {
        videoElement.pause();
      }
    };

    void playVideo();
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

      if (stream) {
        stopMediaTracks(stream);
      }

      setStream(nextStream);

      setStatus('granted');
      return true;
    } catch {
      stopStream();
      setStatus('denied');
      setErrorMessage(
        'Camera permission was denied. Please allow access and try again.'
      );
      return false;
    }
  }, [stopStream, stream]);

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

        if (x > 0) {
          edgeSum += Math.abs(value - (luma[pixelIndex - 1] ?? value));
        }

        if (y > 0) {
          edgeSum += Math.abs(value - (luma[pixelIndex - width] ?? value));
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

    return {
      brightness: avgBrightness / 255,
      contrast: Math.sqrt(variance) / 255,
      sharpness: edgeSum / (pixelCount * 255 * 2),
      motion: hadPrevious ? motionSum / (pixelCount * 255) : 1,
      horizontalBalance: (rightAverage - leftAverage) / 255,
      verticalBalance: (topAverage - bottomAverage) / 255,
      centerContrastRatio:
        Math.sqrt(centerVariance) / (Math.sqrt(variance) + 0.0001),
    };
  }, [stream]);

  const resetPermission = useCallback(() => {
    setErrorMessage(null);
    if (status === 'denied' || status === 'unsupported') {
      setStatus('idle');
    }
  }, [status]);

  useEffect(() => {
    return () => {
      stopMediaTracks(stream);
      previousLumaRef.current = null;
    };
  }, [stream]);

  return {
    videoRef,
    status,
    errorMessage,
    streamActive,
    requestAccess,
    captureFrame,
    readFrameAnalysis,
    resetPermission,
    stopStream,
  };
}
