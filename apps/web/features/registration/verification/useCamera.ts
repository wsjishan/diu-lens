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

    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;

    const context = canvas.getContext('2d');
    if (!context) {
      return null;
    }

    context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

    if (
      canvas.width <= MIN_CAPTURE_DIMENSION_PX ||
      canvas.height <= MIN_CAPTURE_DIMENSION_PX
    ) {
      console.warn('[capture] snapshot skipped due to invalid canvas size', {
        width: canvas.width,
        height: canvas.height,
      });
      return null;
    }

    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            console.error('[capture] canvas.toBlob returned null');
          }
          resolve(blob);
        },
        'image/jpeg',
        0.9
      );
    });
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
