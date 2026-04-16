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
  payload: EnrollmentCompletionPayload
) {
  return submitEnrollmentRequest(
    payload,
    GENERIC_REGISTRATION_COMPLETION_ERROR
  );
}

async function submitEnrollmentRequest(
  payload: EnrollmentPayload | EnrollmentCompletionPayload,
  errorMessage: string
) {
  const response = await fetch(`${getApiBaseUrl()}/enroll`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(errorMessage);
  }

  let data: unknown;

  try {
    data = await response.json();
  } catch {
    throw new Error(errorMessage);
  }

  if (!isEnrollmentResponse(data) || !data.success) {
    throw new Error(errorMessage);
  }

  return data;
}

export { GENERIC_ENROLLMENT_ERROR, GENERIC_REGISTRATION_COMPLETION_ERROR };
