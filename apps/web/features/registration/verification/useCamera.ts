import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  CameraHookResult,
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
const MIN_CAPTURE_DIMENSION_PX = 100;
const MAX_UPLOAD_WIDTH_PX = 640;
const CAPTURE_JPEG_QUALITY = 0.75;
const MAX_TO_DATA_URL_LENGTH = 10 * 1024 * 1024;

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

async function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<{ blob: Blob | null; dataUrlLength: number | null }> {
  if (canvas.toBlob) {
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((result) => resolve(result), type, quality);
    });
    return { blob, dataUrlLength: null };
  }

  try {
    const dataUrl = canvas.toDataURL(type, quality);
    const dataUrlLength = dataUrl.length;
    if (dataUrlLength > MAX_TO_DATA_URL_LENGTH) {
      return { blob: null, dataUrlLength };
    }
    return { blob: dataUrlToBlob(dataUrl), dataUrlLength };
  } catch {
    return { blob: null, dataUrlLength: null };
  }
}

function stopMediaTracks(stream: MediaStream | null) {
  if (!stream) {
    return;
  }

  stream.getTracks().forEach((track) => track.stop());
}

export function useCamera(): CameraHookResult {
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
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
    console.log('[capture] camera stream stopped');
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
    console.log('[capture] camera access requested');
    if (!navigator?.mediaDevices?.getUserMedia) {
      setStatus('unsupported');
      setErrorMessage('Camera API is not supported by this browser.');
      console.warn('[capture] camera api unsupported');
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
      console.log('[capture] camera access granted');
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
      console.error('[capture] camera access failed', {
        errorName,
        error,
      });
      return false;
    }
  }, [stopStream]);

  const resetPermission = useCallback(() => {
    setErrorMessage(null);
    if (status === 'denied' || status === 'unsupported') {
      setStatus('idle');
    }
  }, [status]);

  const captureSnapshot = useCallback(async () => {
    const videoElement = videoElementRef.current;

    if (
      !videoElement ||
      !streamRef.current ||
      videoElement.videoWidth <= MIN_CAPTURE_DIMENSION_PX ||
      videoElement.videoHeight <= MIN_CAPTURE_DIMENSION_PX
    ) {
      console.warn('[capture] snapshot skipped due to invalid frame size', {
        width: videoElement?.videoWidth ?? 0,
        height: videoElement?.videoHeight ?? 0,
      });
      return null;
    }

    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = videoElement.videoWidth;
    sourceCanvas.height = videoElement.videoHeight;
    console.log('[capture] source canvas size', {
      width: sourceCanvas.width,
      height: sourceCanvas.height,
    });

    const sourceContext = sourceCanvas.getContext('2d');
    if (!sourceContext) {
      return null;
    }

    sourceContext.drawImage(
      videoElement,
      0,
      0,
      sourceCanvas.width,
      sourceCanvas.height
    );

    const shouldResize = sourceCanvas.width > MAX_UPLOAD_WIDTH_PX;
    const targetWidth = shouldResize ? MAX_UPLOAD_WIDTH_PX : sourceCanvas.width;
    const targetHeight = Math.max(
      1,
      Math.round((sourceCanvas.height * targetWidth) / sourceCanvas.width)
    );

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = targetWidth;
    exportCanvas.height = targetHeight;
    console.log('[capture] export canvas size', {
      width: exportCanvas.width,
      height: exportCanvas.height,
      resized: shouldResize,
    });

    const exportContext = exportCanvas.getContext('2d');
    if (!exportContext) {
      return null;
    }

    exportContext.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight);

    if (
      exportCanvas.width <= MIN_CAPTURE_DIMENSION_PX ||
      exportCanvas.height <= MIN_CAPTURE_DIMENSION_PX
    ) {
      console.warn('[capture] snapshot skipped due to invalid canvas size', {
        width: exportCanvas.width,
        height: exportCanvas.height,
      });
      return null;
    }

    const { blob, dataUrlLength } = await canvasToBlob(
      exportCanvas,
      'image/jpeg',
      CAPTURE_JPEG_QUALITY
    );

    if (!blob) {
      console.error('[capture] canvasToBlob failed', {
        dataUrlLength,
        width: exportCanvas.width,
        height: exportCanvas.height,
      });
      return null;
    }

    console.log('[capture] blob created', {
      size: blob.size,
      type: blob.type,
      dataUrlLength,
    });

    return blob;
  }, []);

  useEffect(() => {
    return () => {
      stopMediaTracks(streamRef.current);
      streamRef.current = null;
      console.log('[capture] camera hook cleanup complete');
    };
  }, []);

  return {
    videoRef,
    status,
    errorMessage,
    streamActive,
    requestAccess,
    resetPermission,
    stopStream,
    captureSnapshot,
  };
}
