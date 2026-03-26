export const TOKEN_KEY = 'vocab_token';
export const USER_KEY = 'vocab_user';

export type LoginUser = {
  id: string;
  email?: string;
  displayName: string;
  role?: 'USER' | 'ADMIN';
  emailVerified?: boolean;
};

function isBrowser() {
  return typeof window !== 'undefined';
}

export function getToken() {
  if (!isBrowser()) return '';
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function getLoginUser(): LoginUser | null {
  if (!isBrowser()) return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LoginUser;
  } catch {
    return null;
  }
}

export function saveAuth(token: string, user: LoginUser) {
  if (!isBrowser()) return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  if (!isBrowser()) return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isLoggedIn() {
  return Boolean(getToken());
}
