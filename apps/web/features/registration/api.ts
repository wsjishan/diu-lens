import type {
  VerificationAngle,
  VerificationCapturesByAngle,
  VerificationFrameMetadataByAngle,
} from '@/features/registration/verification/types';
import {
  captureAngles,
  getRequiredFramesForAngle,
} from '@/features/registration/capture/constants';

const GENERIC_ENROLLMENT_ERROR =
  'Unable to continue right now. Please try again.';
const GENERIC_REGISTRATION_COMPLETION_ERROR =
  'Unable to complete registration right now. Please try again.';
const MIN_CAPTURE_FILE_SIZE_BYTES = 10 * 1024;
const ALLOWED_CAPTURE_CONTENT_TYPES = new Set(['image/jpeg', 'image/png']);
const REQUIRED_VERIFICATION_ANGLES: VerificationAngle[] = [
  ...captureAngles,
];
const MAX_CAPTURES_PER_ANGLE = 5;

export type EnrollmentPayload = {
  student_id: string;
  full_name: string;
  phone: string;
  university_email: string;
};

export type AngleCaptureSummaryPayload = {
  angle: string;
  accepted_shots: number;
  required_shots: number;
};

export type EnrollmentCompletionPayload = EnrollmentPayload & {
  verification_completed: boolean;
  total_required_shots: number;
  total_accepted_shots: number;
  angles: AngleCaptureSummaryPayload[];
  frame_metadata_by_angle?: {
    angle: string;
    frames: { captured_at: number }[];
  }[];
};

type EnrollmentResponse = {
  success: boolean;
  message: string;
};

export type EnrollmentSubmissionResult = EnrollmentResponse;

function getApiBaseUrl() {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

  if (!apiBaseUrl) {
    throw new Error(GENERIC_ENROLLMENT_ERROR);
  }

  return apiBaseUrl.replace(/\/+$/, '');
}

function isEnrollmentResponse(value: unknown): value is EnrollmentResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const result = value as Partial<EnrollmentResponse>;

  return (
    typeof result.success === 'boolean' && typeof result.message === 'string'
  );
}

function toMessageFromUnknown(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (typeof record.message === 'string' && record.message.trim()) {
    return record.message.trim();
  }

  if (typeof record.detail === 'string' && record.detail.trim()) {
    return record.detail.trim();
  }

  if (record.detail && typeof record.detail === 'object') {
    const detail = record.detail as Record<string, unknown>;
    if (typeof detail.message === 'string' && detail.message.trim()) {
      return detail.message.trim();
    }
  }

  return null;
}

function toValidationReasonMessage(value: unknown): string | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const detail = record.detail;
  if (!detail || typeof detail !== 'object') {
    return null;
  }

  const detailRecord = detail as Record<string, unknown>;
  if (
    detailRecord.error === 'sanity_failed' &&
    Array.isArray(detailRecord.details)
  ) {
    const failedReasons = detailRecord.details
      .map((entry) => {
        if (!entry || typeof entry !== 'object') {
          return null;
        }
        const failed = entry as Record<string, unknown>;
        const angle =
          typeof failed.angle === 'string' && failed.angle.trim()
            ? failed.angle.trim()
            : 'unknown';
        const reason =
          typeof failed.reason === 'string' && failed.reason.trim()
            ? failed.reason.trim()
            : 'unknown';
        return `${angle}: ${reason}`;
      })
      .filter((entry): entry is string => Boolean(entry));

    if (failedReasons.length > 0) {
      return `Image sanity checks failed (${failedReasons.join('; ')})`;
    }
  }

  const validation = detailRecord.validation;
  if (!validation || typeof validation !== 'object') {
    return null;
  }

  const validationRecord = validation as Record<string, unknown>;
  const reports = validationRecord.image_reports;
  if (!Array.isArray(reports)) {
    return null;
  }

  const reasons = new Set<string>();

  for (const report of reports) {
    if (!report || typeof report !== 'object') {
      continue;
    }

    const reportRecord = report as Record<string, unknown>;
    const angle =
      typeof reportRecord.angle === 'string' ? reportRecord.angle : 'unknown';
    const failureReasons = reportRecord.failure_reasons;

    if (!Array.isArray(failureReasons)) {
      continue;
    }

    for (const reason of failureReasons) {
      if (typeof reason === 'string' && reason.trim()) {
        reasons.add(`${angle}: ${reason.trim()}`);
      }
    }
  }

  if (reasons.size === 0) {
    return null;
  }

  return `Image sanity checks failed (${Array.from(reasons).join('; ')})`;
}

function toFastApiValidationMessage(value: unknown): string | null {
  let source: unknown = value;
  if (!Array.isArray(source) && source && typeof source === 'object') {
    const record = source as Record<string, unknown>;
    source = record.detail;
  }
  if (!Array.isArray(source)) {
    return null;
  }

  const messages = source
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      const record = entry as Record<string, unknown>;
      if (typeof record.msg === 'string' && record.msg.trim()) {
        return record.msg.trim();
      }
      return null;
    })
    .filter((message): message is string => Boolean(message));

  if (messages.length === 0) {
    return null;
  }

  return messages.join('; ');
}

export async function submitEnrollment(payload: EnrollmentPayload) {
  return submitEnrollmentRequest(payload, GENERIC_ENROLLMENT_ERROR);
}

export async function submitEnrollmentCompletion(
  payload: EnrollmentCompletionPayload,
  capturesByAngle: VerificationCapturesByAngle,
  frameMetadataByAngle: VerificationFrameMetadataByAngle
) {
  return submitEnrollmentCompletionRequest(
    payload,
    capturesByAngle,
    frameMetadataByAngle,
    GENERIC_REGISTRATION_COMPLETION_ERROR
  );
}

async function submitEnrollmentRequest(
  payload: EnrollmentPayload | EnrollmentCompletionPayload,
  errorMessage: string
) {
  try {
    console.log('[enroll] request payload', payload);

    const response = await fetch(`${getApiBaseUrl()}/enroll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    return await parseEnrollmentResponse(response, errorMessage);
  } catch (error) {
    console.error('[enroll] request failed', error);
    throw error;
  }
}

async function submitEnrollmentCompletionRequest(
  payload: EnrollmentCompletionPayload,
  capturesByAngle: VerificationCapturesByAngle,
  frameMetadataByAngle: VerificationFrameMetadataByAngle,
  errorMessage: string
) {
  try {
    const requestStartMs = performance.now();
    const logTiming = (stage: string, details: Record<string, unknown> = {}) => {
      const nowMs = performance.now();
      console.log('[verification-timing]', stage, {
        nowMs: Number(nowMs.toFixed(2)),
        elapsedMs: Number((nowMs - requestStartMs).toFixed(2)),
        ...details,
      });
    };

    console.log('[verification] request start', {
      student_id: payload.student_id,
      total_required_shots: payload.total_required_shots,
      total_accepted_shots: payload.total_accepted_shots,
    });

    const metadataWithFrames: EnrollmentCompletionPayload = {
      ...payload,
      frame_metadata_by_angle: REQUIRED_VERIFICATION_ANGLES.map((angle) => ({
        angle,
        frames: (frameMetadataByAngle[angle] ?? []).map((frame) => ({
          captured_at: frame.capturedAt,
        })),
      })),
    };

    logTiming('FormData creation started');
    const formData = new FormData();
    formData.append('metadata', JSON.stringify(metadataWithFrames));

    let appendedFiles = 0;
    let totalUploadBytes = 0;

    for (const angle of REQUIRED_VERIFICATION_ANGLES) {
      const captures = capturesByAngle[angle];
      const requiredFramesForAngle = getRequiredFramesForAngle(angle);
      if (!Array.isArray(captures)) {
        return {
          success: false,
          message: `Missing captured verification files for angle: ${angle}. Please retake this shot.`,
        };
      }

      if (captures.length < requiredFramesForAngle) {
        return {
          success: false,
          message: `Expected at least ${requiredFramesForAngle} captured files for angle: ${angle}. Please retake this angle.`,
        };
      }
      if (captures.length > MAX_CAPTURES_PER_ANGLE) {
        return {
          success: false,
          message: `Too many captured files for angle: ${angle}. Maximum is ${MAX_CAPTURES_PER_ANGLE}.`,
        };
      }

      for (const [index, capture] of captures.entries()) {
        if (!(capture instanceof Blob)) {
          return {
            success: false,
            message: `Captured file is invalid for angle: ${angle}. Please retake this shot.`,
          };
        }

        if (capture.size <= 0) {
          return {
            success: false,
            message: `Captured file is empty for angle: ${angle}. Please retake this shot.`,
          };
        }

        if (capture.size < MIN_CAPTURE_FILE_SIZE_BYTES) {
          return {
            success: false,
            message: `Captured file is too small for angle: ${angle}. Please retake this shot.`,
          };
        }

        const normalizedType = capture.type.toLowerCase();
        if (!ALLOWED_CAPTURE_CONTENT_TYPES.has(normalizedType)) {
          return {
            success: false,
            message: `Captured file type is invalid for angle: ${angle}. Please retake this shot.`,
          };
        }

        console.log(angle, capture.size, capture.type);
        const sizeKb = Math.round(capture.size / 1024);
        console.log('[verification-upload]', angle, sizeKb, 'KB');
        console.log('[verification] attaching capture', {
          angle,
          index,
          size: capture.size,
          type: capture.type,
        });
        const extension = normalizedType === 'image/png' ? 'png' : 'jpg';
        formData.append(angle, capture, `${angle}_${index + 1}.${extension}`);
        appendedFiles += 1;
        totalUploadBytes += capture.size;
        logTiming('each file appended', {
          angle,
          index,
          sizeKb,
          fileType: capture.type,
          appendedFiles,
        });
      }
    }

    if (appendedFiles === 0) {
      return {
        success: false,
        message:
          'No captured verification images found. Please retake the guided shots.',
      };
    }
    console.log('[verification] files attached', { appendedFiles });
    const totalKb = Math.round(totalUploadBytes / 1024);
    const totalMb = Number((totalUploadBytes / (1024 * 1024)).toFixed(2));
    console.log('[verification-upload] total', totalKb, 'KB', `${totalMb} MB`);
    logTiming('upload size summary', {
      appendedFiles,
      totalKb,
      totalMb,
    });

    logTiming('fetch request started');
    const response = await fetch(`${getApiBaseUrl()}/enroll/verification`, {
      method: 'POST',
      body: formData,
    });
    logTiming('response headers received', {
      status: response.status,
      ok: response.ok,
    });

    const parsed = await parseEnrollmentResponse(
      response,
      errorMessage,
      'verification'
    );
    logTiming('response body parsed', {
      success: parsed.success,
      message: parsed.message,
    });
    return parsed;
  } catch (error) {
    console.error('[verification] request failed', error);
    throw error;
  }
}

async function parseEnrollmentResponse(
  response: Response,
  errorMessage: string,
  logPrefix = 'enroll'
): Promise<EnrollmentSubmissionResult> {
  const rawText = await response.text();
  console.log(`[${logPrefix}] raw response`, {
    status: response.status,
    ok: response.ok,
    body: rawText,
  });

  let parsedData: unknown = null;
  if (rawText.trim()) {
    try {
      parsedData = JSON.parse(rawText);
    } catch {
      parsedData = rawText;
    }
  }

  if (isEnrollmentResponse(parsedData)) {
    if (response.status >= 500) {
      throw new Error(parsedData.message || errorMessage);
    }
    return parsedData;
  }

  const derivedMessage =
    toValidationReasonMessage(parsedData) ||
    toFastApiValidationMessage(parsedData) ||
    toMessageFromUnknown(parsedData) ||
    (response.ok ? 'Request completed.' : errorMessage);

  if (response.status >= 500) {
    throw new Error(derivedMessage);
  }

  if (!response.ok) {
    return {
      success: false,
      message: derivedMessage,
    };
  }

  return {
    success: true,
    message: derivedMessage,
  };
}

export { GENERIC_ENROLLMENT_ERROR, GENERIC_REGISTRATION_COMPLETION_ERROR };
