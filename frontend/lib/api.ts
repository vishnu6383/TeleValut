const rawApi = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
const cleanApi = rawApi.trim().replace(/\/+$/, '');
const API = cleanApi.endsWith('/api') ? cleanApi : `${cleanApi}/api`;

export class ApiError extends Error {
  status: number;
  code?: string;
  data?: unknown;

  constructor(message: string, status: number, code?: string, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('televault_token');
}

export function setAuthToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('televault_token', token);
}

export function clearAuthToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('televault_token');
}

export function getFileUrl(fileId: string): string {
  const token = getAuthToken();
  return token
    ? `${API}/files/${fileId}/download?token=${encodeURIComponent(token)}`
    : `${API}/files/${fileId}/download`;
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const fullUrl = `${API}${cleanPath}`;
  const token = getAuthToken();

  try {
    const customHeaders = (options.headers as Record<string, string>) || {};
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...customHeaders,
    };

    const response = await fetch(fullUrl, {
      ...options,
      credentials: 'include',
      headers,
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 401 && typeof window !== 'undefined') {
        // If not checking auth endpoint, clean expired token
        if (!cleanPath.includes('/auth/me')) {
          clearAuthToken();
        }
      }
      throw new ApiError(
        body.message || body.error || `Request failed with status ${response.status}`,
        response.status,
        body.code,
        body.data
      );
    }

    return body.data as T;
  } catch (err: unknown) {
    if (err instanceof TypeError && err.message.toLowerCase().includes('fetch')) {
      throw new ApiError(
        'Unable to connect to backend server. If using Render free tier, the backend may take 30-45 seconds to wake up from idle.',
        0
      );
    }
    throw err;
  }
}

export const apiBase = API;
