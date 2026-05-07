import type {
  VerificationAngle,
  VerificationCapturesByAngle,
  VerificationFrameMetadataByAngle,
} from '@/features/registration/verification/types';
import {
  guidedAngles,
  captureAngles,
  getRequiredFramesForAngle,
} from '@/features/registration/capture/constants';
import { request } from '@/lib/api';

const GENERIC_ENROLLMENT_ERROR =
  'Unable to continue right now. Please try again.';
const GENERIC_REGISTRATION_COMPLETION_ERROR =
  'Unable to complete registration right now. Please try again.';
const MIN_CAPTURE_FILE_SIZE_BYTES = 10 * 1024;
const ALLOWED_CAPTURE_CONTENT_TYPES = new Set(['image/jpeg', 'image/png']);
const REQUIRED_VERIFICATION_ANGLES: VerificationAngle[] = [...guidedAngles];

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
  payload: EnrollmentPayload,
  errorMessage: string
) {
  try {
    const normalizedPayload: EnrollmentPayload = {
      student_id: payload.student_id.trim(),
      full_name: payload.full_name.trim(),
      phone: payload.phone.trim(),
      university_email: payload.university_email.trim(),
    };

    if (
      !normalizedPayload.student_id ||
      !normalizedPayload.full_name ||
      !normalizedPayload.phone ||
      !normalizedPayload.university_email
    ) {
      console.error('[enroll] invalid payload', normalizedPayload);
      return {
        success: false,
        message: 'Missing required fields for enrollment submission.',
      };
    }

    console.log('🚀 sending enroll request', normalizedPayload);

    const response = await request('/enroll', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(normalizedPayload),
    });
    console.log('✅ response received', response);

    return await parseEnrollmentResponse(response, errorMessage);
  } catch (error) {
    console.error('❌ enroll failed', error);
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
    const logTiming = (
      stage: string,
      details: Record<string, unknown> = {}
    ) => {
      const nowMs = performance.now();
      console.log('[verification-timing]', stage, {
        nowMs: Number(nowMs.toFixed(2)),
        elapsedMs: Number((nowMs - requestStartMs).toFixed(2)),
        ...details,
      });
    };

    const anglesSummary = REQUIRED_VERIFICATION_ANGLES.map((angle) => ({
      angle,
      accepted_shots: capturesByAngle[angle]?.length ?? 0,
      required_shots: getRequiredFramesForAngle(angle),
    }));
    const totalRequiredShots = anglesSummary.reduce(
      (total, entry) => total + entry.required_shots,
      0
    );
    const totalAcceptedShots = anglesSummary.reduce(
      (total, entry) => total + entry.accepted_shots,
      0
    );
    console.log('[verification] request start', {
      student_id: payload.student_id,
      total_required_shots: totalRequiredShots,
      total_accepted_shots: totalAcceptedShots,
    });
    const metadataWithFrames: EnrollmentCompletionPayload = {
      ...payload,
      total_required_shots: totalRequiredShots,
      total_accepted_shots: totalAcceptedShots,
      angles: anglesSummary,
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
    formData.append('student_id', payload.student_id);
    console.log('[verification] form data seed', {
      student_id: payload.student_id,
      metadata_keys: Object.keys(metadataWithFrames),
    });

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

      if (captures.length !== requiredFramesForAngle) {
        return {
          success: false,
          message: `Expected exactly ${requiredFramesForAngle} captured files for angle: ${angle}. Please retake this angle.`,
        };
      }

      for (const [index, captureInput] of captures.entries()) {
        let capture = captureInput;
        if (typeof capture === 'string') {
          const converted = dataUrlToBlob(capture);
          if (!converted) {
            return {
              success: false,
              message: `Captured image data is invalid for angle: ${angle}. Please retake this shot.`,
            };
          }
          capture = converted;
        }

        if (!(capture instanceof Blob)) {
          return {
            success: false,
            message: `Captured file is invalid for angle: ${angle}. Please retake this shot.`,
          };
        }

        console.log('[verification] capture input', {
          angle,
          index,
          isFile: capture instanceof File,
          size: capture.size,
          type: capture.type,
        });

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

        const normalizedType = (capture.type || 'image/jpeg').toLowerCase();
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
        const fileName = `${angle}_${index + 1}.${extension}`;
        const fileToAppend =
          capture instanceof File
            ? capture
            : new File([capture], fileName, { type: normalizedType });
        if (fileToAppend.size <= 0) {
          return {
            success: false,
            message: `Captured file is empty for angle: ${angle}. Please retake this shot.`,
          };
        }
        formData.append(angle, fileToAppend, fileName);
        console.log('[verification] appended file', {
          angle,
          index,
          fileName,
          size: fileToAppend.size,
          type: fileToAppend.type,
        });
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
    const formEntries = Array.from(formData.entries());
    const fileEntries = formEntries.filter(
      ([, value]) => value instanceof Blob
    );
    const fileCountsByKey = fileEntries.reduce<Record<string, number>>(
      (acc, [key]) => {
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      },
      {}
    );
    console.log('[verification] form data summary', {
      total_keys: formEntries.length,
      file_entries: fileEntries.length,
      file_counts_by_key: fileCountsByKey,
      all_keys: formEntries.map(([key]) => key),
    });
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
    const requestOptions: RequestInit = {
      method: 'POST',
      body: formData,
    };
    console.log('[verification] request init', {
      headers: requestOptions.headers ?? null,
      isFormData: formData instanceof FormData,
      formEntryCount: formEntries.length,
    });
    const response = await request('/enroll/verification', requestOptions);
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

  const statusLabel = response.status
    ? `${response.status}${response.statusText ? ` ${response.statusText}` : ''}`
    : 'unknown';
  const logResponseIssue = (body: unknown) => {
    const logPayload = {
      status: response.status,
      statusText: response.statusText,
      body,
    };

    if (response.status >= 500) {
      console.error(`[${logPrefix}] non-OK response`, logPayload);
      return;
    }

    console.warn(`[${logPrefix}] non-OK response`, logPayload);
  };

  let parsedData: unknown = null;
  if (rawText.trim()) {
    try {
      parsedData = JSON.parse(rawText);
    } catch {
      parsedData = rawText;
    }
  }

  if (isEnrollmentResponse(parsedData)) {
    if (!response.ok) {
      logResponseIssue(parsedData);
    }
    if (response.status >= 500) {
      throw new Error(parsedData.message || errorMessage);
    }
    return parsedData;
  }

  const derivedMessage =
    toValidationReasonMessage(parsedData) ||
    toFastApiValidationMessage(parsedData) ||
    toMessageFromUnknown(parsedData) ||
    (response.ok ? 'Request completed.' : `Request failed (${statusLabel}).`);

  if (response.status >= 500) {
    throw new Error(derivedMessage);
  }

  if (!response.ok) {
    logResponseIssue(parsedData);
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
