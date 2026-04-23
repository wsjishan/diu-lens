import type { VerificationCapturesByAngle } from '@/features/registration/verification/types';

const GENERIC_ENROLLMENT_ERROR =
  'Unable to continue right now. Please try again.';
const GENERIC_REGISTRATION_COMPLETION_ERROR =
  'Unable to complete registration right now. Please try again.';

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
    const angle = typeof reportRecord.angle === 'string' ? reportRecord.angle : 'unknown';
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

  return `Image quality checks failed (${Array.from(reasons).join('; ')})`;
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
  capturesByAngle: VerificationCapturesByAngle
) {
  return submitEnrollmentCompletionRequest(
    payload,
    capturesByAngle,
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
  errorMessage: string
) {
  try {
    console.log('[verification] request start', {
      student_id: payload.student_id,
      total_required_shots: payload.total_required_shots,
      total_accepted_shots: payload.total_accepted_shots,
    });

    const formData = new FormData();
    formData.append('metadata', JSON.stringify(payload));

    let appendedFiles = 0;

    for (const [angle, captures] of Object.entries(capturesByAngle)) {
      if (!Array.isArray(captures)) {
        continue;
      }

      for (const [index, capture] of captures.entries()) {
        console.log('[verification] attaching capture', {
          angle,
          index,
          size: capture.size,
          type: capture.type,
        });
        formData.append(angle, capture, `${angle}_${index + 1}.jpg`);
        appendedFiles += 1;
      }
    }

    if (appendedFiles === 0) {
      return {
        success: false,
        message: 'No captured verification images found. Please retake the guided shots.',
      };
    }
    console.log('[verification] files attached', { appendedFiles });

    const response = await fetch(`${getApiBaseUrl()}/enroll/verification`, {
      method: 'POST',
      body: formData,
    });

    return await parseEnrollmentResponse(response, errorMessage, 'verification');
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
