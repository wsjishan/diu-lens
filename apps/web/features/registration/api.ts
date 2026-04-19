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
    console.log('[enroll completion] request payload', payload);

    const formData = new FormData();
    formData.append('metadata', JSON.stringify(payload));

    let appendedFiles = 0;

    for (const [angle, captures] of Object.entries(capturesByAngle)) {
      if (!Array.isArray(captures)) {
        continue;
      }

      for (const [index, capture] of captures.entries()) {
        formData.append(angle, capture, `${angle}_${index + 1}.jpg`);
        appendedFiles += 1;
      }
    }

    if (appendedFiles === 0) {
      throw new Error(errorMessage);
    }

    const response = await fetch(`${getApiBaseUrl()}/enroll/verification`, {
      method: 'POST',
      body: formData,
    });

    return await parseEnrollmentResponse(response, errorMessage);
  } catch (error) {
    console.error('[enroll completion] request failed', error);
    throw error;
  }
}

async function parseEnrollmentResponse(
  response: Response,
  errorMessage: string
): Promise<EnrollmentSubmissionResult> {
  console.log('[enroll] response.status', response.status);

  let parsedData: unknown = null;

  try {
    parsedData = await response.json();
    console.log('[enroll] parsed response JSON', parsedData);
  } catch {
    console.log('[enroll] parsed response JSON', null);
    throw new Error(errorMessage);
  }

  if (!isEnrollmentResponse(parsedData)) {
    throw new Error(errorMessage);
  }

  if (response.status >= 500) {
    throw new Error(parsedData.message || errorMessage);
  }

  return parsedData;
}

export { GENERIC_ENROLLMENT_ERROR, GENERIC_REGISTRATION_COMPLETION_ERROR };
