import { AdminUser, EnrollmentRecord } from '@/features/admin/auth/types';

const GENERIC_ADMIN_ERROR = 'Unable to complete the request right now. Please try again.';
const ENROLLMENTS_ENDPOINT =
  process.env.NEXT_PUBLIC_ADMIN_ENROLLMENTS_ENDPOINT?.trim() || '/debug/enrollments';

export class AdminApiAuthError extends Error {
  constructor(message = 'Your session has expired. Please sign in again.') {
    super(message);
    this.name = 'AdminApiAuthError';
  }
}

type ApiBusinessResponse = {
  success: boolean;
  message: string;
};

export type RecognitionMatchCandidate = {
  rank: number;
  student_id: string;
  full_name: string | null;
  best_distance: number;
  support_count: number;
  matched_angles: string[];
  representative_crop_path: string | null;
  representative_source_image_path: string | null;
  is_likely_match: boolean;
};

export type RecognitionMatchResponse = ApiBusinessResponse & {
  match_found: boolean;
  threshold_used: number;
  top_k: number;
  candidate_pool_limit: number;
  query_embedding_dim: number;
  searched_embedding_rows: number;
  candidates: RecognitionMatchCandidate[];
};

type RecognitionMatchOptions = {
  threshold?: number;
  topK?: number;
  candidatePoolLimit?: number;
};

type AdminLoginResponse = ApiBusinessResponse & {
  access_token?: string;
  token_type?: string;
  role?: string;
  admin?: AdminUser;
};

type AdminMeResponse = ApiBusinessResponse & {
  admin?: AdminUser;
};

type JsonPayload = Record<string, unknown> | null;

type RequestOptions = {
  method?: 'GET' | 'POST';
  body?: Record<string, unknown>;
  token?: string;
  treat401AsAuthError?: boolean;
};

function getApiBaseUrl() {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

  if (!apiBaseUrl) {
    throw new Error('NEXT_PUBLIC_API_BASE_URL is not configured.');
  }

  return apiBaseUrl.replace(/\/+$/, '');
}

function getMessageFromPayload(payload: JsonPayload): string {
  if (!payload) {
    return GENERIC_ADMIN_ERROR;
  }

  const directMessage = payload.message;
  if (typeof directMessage === 'string' && directMessage.trim()) {
    return directMessage;
  }

  const detail = payload.detail;
  if (detail && typeof detail === 'object') {
    const detailMessage = (detail as Record<string, unknown>).message;
    if (typeof detailMessage === 'string' && detailMessage.trim()) {
      return detailMessage;
    }
  }

  return GENERIC_ADMIN_ERROR;
}

function isApiBusinessResponse(value: unknown): value is ApiBusinessResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const data = value as Record<string, unknown>;
  return typeof data.success === 'boolean' && typeof data.message === 'string';
}

function parseRecognitionCandidate(value: unknown): RecognitionMatchCandidate | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const row = value as Record<string, unknown>;
  if (typeof row.student_id !== 'string' || !row.student_id.trim()) {
    return null;
  }

  const matchedAnglesRaw = row.matched_angles;
  const matchedAngles = Array.isArray(matchedAnglesRaw)
    ? matchedAnglesRaw.filter((item): item is string => typeof item === 'string')
    : [];

  return {
    rank: typeof row.rank === 'number' ? row.rank : 0,
    student_id: row.student_id,
    full_name: typeof row.full_name === 'string' ? row.full_name : null,
    best_distance: typeof row.best_distance === 'number' ? row.best_distance : Number.POSITIVE_INFINITY,
    support_count: typeof row.support_count === 'number' ? row.support_count : 0,
    matched_angles: matchedAngles,
    representative_crop_path:
      typeof row.representative_crop_path === 'string' ? row.representative_crop_path : null,
    representative_source_image_path:
      typeof row.representative_source_image_path === 'string'
        ? row.representative_source_image_path
        : null,
    is_likely_match: Boolean(row.is_likely_match),
  };
}

function parseRecognitionResponse(payload: JsonPayload): RecognitionMatchResponse {
  if (!payload || typeof payload !== 'object') {
    return {
      success: false,
      message: GENERIC_ADMIN_ERROR,
      match_found: false,
      threshold_used: 0,
      top_k: 0,
      candidate_pool_limit: 0,
      query_embedding_dim: 0,
      searched_embedding_rows: 0,
      candidates: [],
    };
  }

  const data = payload as Record<string, unknown>;
  const candidatesRaw = Array.isArray(data.candidates) ? data.candidates : [];
  const candidates = candidatesRaw
    .map(parseRecognitionCandidate)
    .filter((item): item is RecognitionMatchCandidate => item !== null)
    .sort((a, b) => a.rank - b.rank);

  const success = typeof data.success === 'boolean' ? data.success : false;

  return {
    success,
    message: getMessageFromPayload(payload),
    match_found: typeof data.match_found === 'boolean' ? data.match_found : false,
    threshold_used: typeof data.threshold_used === 'number' ? data.threshold_used : 0,
    top_k: typeof data.top_k === 'number' ? data.top_k : 0,
    candidate_pool_limit: typeof data.candidate_pool_limit === 'number' ? data.candidate_pool_limit : 0,
    query_embedding_dim: typeof data.query_embedding_dim === 'number' ? data.query_embedding_dim : 0,
    searched_embedding_rows: typeof data.searched_embedding_rows === 'number' ? data.searched_embedding_rows : 0,
    candidates,
  };
}

function parseEnrollment(value: unknown): EnrollmentRecord | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const row = value as Record<string, unknown>;
  const studentId = row.student_id;

  if (typeof studentId !== 'string' || !studentId.trim()) {
    return null;
  }

  const statusRaw = row.status;
  const status =
    statusRaw === 'pending' ||
    statusRaw === 'uploaded' ||
    statusRaw === 'validated' ||
    statusRaw === 'failed' ||
    statusRaw === 'processing' ||
    statusRaw === 'approved' ||
    statusRaw === 'rejected' ||
    statusRaw === 'processed' ||
    statusRaw === 'reset'
      ? statusRaw
      : 'pending';

  const validation = row.validation;
  const validationPassed =
    validation && typeof validation === 'object'
      ? (validation as Record<string, unknown>).validation_passed
      : undefined;

  return {
    student_id: studentId,
    full_name: typeof row.full_name === 'string' ? row.full_name : '',
    university_email: typeof row.university_email === 'string' ? row.university_email : '',
    phone: typeof row.phone === 'string' ? row.phone : '',
    status,
    verification_completed: Boolean(row.verification_completed),
    created_at: typeof row.created_at === 'string' ? row.created_at : null,
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : null,
    rejection_reason: typeof row.rejection_reason === 'string' ? row.rejection_reason : null,
    validation_passed:
      typeof validationPassed === 'boolean' ? validationPassed : null,
    total_required_shots:
      typeof row.total_required_shots === 'number' ? row.total_required_shots : null,
    total_accepted_shots:
      typeof row.total_accepted_shots === 'number' ? row.total_accepted_shots : null,
  };
}

async function requestJson(
  path: string,
  {
    method = 'GET',
    body,
    token,
    treat401AsAuthError = true,
  }: RequestOptions = {}
): Promise<{ status: number; payload: JsonPayload }> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;

  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
  } catch {
    throw new Error('Network error. Please check your connection and try again.');
  }

  let payload: JsonPayload = null;
  try {
    const parsed = (await response.json()) as unknown;
    payload = parsed && typeof parsed === 'object' ? (parsed as JsonPayload) : null;
  } catch {
    payload = null;
  }

  if ((response.status === 401 || response.status === 403) && treat401AsAuthError) {
    throw new AdminApiAuthError(getMessageFromPayload(payload));
  }

  if (response.status >= 500) {
    throw new Error(getMessageFromPayload(payload));
  }

  return { status: response.status, payload };
}

export async function loginAdmin(email: string, password: string): Promise<AdminLoginResponse> {
  const { payload } = await requestJson('/auth/admin/login', {
    method: 'POST',
    body: { email, password },
    treat401AsAuthError: false,
  });

  if (!payload || typeof payload !== 'object') {
    return { success: false, message: GENERIC_ADMIN_ERROR };
  }

  const normalized = payload as AdminLoginResponse;

  if (!isApiBusinessResponse(normalized)) {
    return { success: false, message: GENERIC_ADMIN_ERROR };
  }

  return normalized;
}

export async function fetchCurrentAdmin(token: string): Promise<AdminUser> {
  const { payload } = await requestJson('/auth/admin/me', { token });

  if (!payload || typeof payload !== 'object') {
    throw new Error(GENERIC_ADMIN_ERROR);
  }

  const data = payload as AdminMeResponse;

  if (!data.success) {
    throw new Error(data.message || GENERIC_ADMIN_ERROR);
  }

  if (!data.admin) {
    throw new Error(GENERIC_ADMIN_ERROR);
  }

  return data.admin;
}

export async function fetchEnrollments(token: string): Promise<EnrollmentRecord[]> {
  const { payload } = await requestJson(ENROLLMENTS_ENDPOINT, { token });

  if (!payload || typeof payload !== 'object') {
    throw new Error(GENERIC_ADMIN_ERROR);
  }

  const rows = (payload as Record<string, unknown>).enrollments;
  if (!Array.isArray(rows)) {
    throw new Error('Unable to load enrollments from the backend response.');
  }

  return rows
    .map(parseEnrollment)
    .filter((row): row is EnrollmentRecord => row !== null)
    .sort((a, b) => {
      const left = new Date(b.updated_at || b.created_at || '').getTime();
      const right = new Date(a.updated_at || a.created_at || '').getTime();
      return left - right;
    });
}

export async function approveEnrollment(
  token: string,
  studentId: string
): Promise<ApiBusinessResponse> {
  const { payload } = await requestJson(`/admin/enrollments/${encodeURIComponent(studentId)}/approve`, {
    method: 'POST',
    token,
  });

  if (isApiBusinessResponse(payload)) {
    return payload;
  }

  return { success: false, message: GENERIC_ADMIN_ERROR };
}

export async function rejectEnrollment(
  token: string,
  studentId: string,
  reason: string
): Promise<ApiBusinessResponse> {
  const { payload } = await requestJson(`/admin/enrollments/${encodeURIComponent(studentId)}/reject`, {
    method: 'POST',
    token,
    body: { reason },
  });

  if (isApiBusinessResponse(payload)) {
    return payload;
  }

  return { success: false, message: GENERIC_ADMIN_ERROR };
}

export async function resetEnrollment(
  token: string,
  studentId: string
): Promise<ApiBusinessResponse> {
  const { payload } = await requestJson(`/admin/enrollments/${encodeURIComponent(studentId)}/reset`, {
    method: 'POST',
    token,
  });

  if (isApiBusinessResponse(payload)) {
    return payload;
  }

  return { success: false, message: GENERIC_ADMIN_ERROR };
}

export async function matchRecognitionProbe(
  token: string,
  imageFile: File,
  options: RecognitionMatchOptions = {}
): Promise<RecognitionMatchResponse> {
  const params = new URLSearchParams();
  if (typeof options.topK === 'number') {
    params.set('top_k', String(options.topK));
  }
  if (typeof options.threshold === 'number') {
    params.set('threshold', String(options.threshold));
  }
  if (typeof options.candidatePoolLimit === 'number') {
    params.set('candidate_pool_limit', String(options.candidatePoolLimit));
  }

  const query = params.toString();
  const path = query ? `/admin/recognition/match?${query}` : '/admin/recognition/match';

  const formData = new FormData();
  formData.append('image', imageFile);

  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: formData,
      cache: 'no-store',
    });
  } catch {
    throw new Error('Network error. Please check your connection and try again.');
  }

  let payload: JsonPayload = null;
  try {
    const parsed = (await response.json()) as unknown;
    payload = parsed && typeof parsed === 'object' ? (parsed as JsonPayload) : null;
  } catch {
    payload = null;
  }

  if (response.status === 401 || response.status === 403) {
    throw new AdminApiAuthError(getMessageFromPayload(payload));
  }

  if (response.status >= 500) {
    throw new Error(getMessageFromPayload(payload));
  }

  return parseRecognitionResponse(payload);
}
