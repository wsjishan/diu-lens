const GENERIC_API_CONFIG_ERROR = 'Unable to continue right now. Please try again.';

export function getApiBaseUrl(): string {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

  if (!apiBaseUrl) {
    throw new Error(GENERIC_API_CONFIG_ERROR);
  }

  return apiBaseUrl.replace(/\/+$/, '');
}

export function buildApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
}

export async function request(path: string, options?: RequestInit): Promise<Response> {
  return fetch(buildApiUrl(path), options);
}
