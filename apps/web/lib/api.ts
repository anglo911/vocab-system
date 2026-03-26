import { getToken } from './auth';

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

function buildHeaders() {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function parseResponse<T>(res: Response, method: string, path: string): Promise<T> {
  if (res.status === 401) {
    throw new Error('UNAUTHORIZED');
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} failed`);
  }
  return res.json();
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    cache: 'no-store',
    headers: buildHeaders()
  });
  return parseResponse<T>(res, 'GET', path);
}

export async function apiPost<T>(path: string, body: any): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(body)
  });
  return parseResponse<T>(res, 'POST', path);
}
