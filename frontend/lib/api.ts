const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api';
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> { const response = await fetch(`${API}${path}`, { ...options, credentials: 'include', headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) } }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.message ?? 'Request failed.'); return body.data as T; }
export const apiBase = API;
