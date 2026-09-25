const rawApi = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
const cleanApi = rawApi.trim().replace(/\/+$/, '');
const API = cleanApi.endsWith('/api') ? cleanApi : `${cleanApi}/api`;

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const fullUrl = `${API}${cleanPath}`;

  try {
    const response = await fetch(fullUrl, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
      },
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(body.message || body.error || `Request failed with status ${response.status}`);
    }

    return body.data as T;
  } catch (err: unknown) {
    if (err instanceof TypeError && err.message.toLowerCase().includes('fetch')) {
      throw new Error(
        'Unable to connect to backend server. If using Render free tier, the backend may take 30-45 seconds to wake up from idle.'
      );
    }
    throw err;
  }
}

export const apiBase = API;
