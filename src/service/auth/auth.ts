/**
 * Konto ohne Passwort: Login per Link oder Code aus einer Mail, Sitzung per HttpOnly-Cookie
 * (pp_session, setzt das Backend). Der Zustand liegt in einem kleinen Store, damit Bubble,
 * Dialog und PDF-Einstellungen denselben Stand sehen.
 */
import { useSyncExternalStore } from 'react';

export interface AuthState {
  /** false, bis GET /api/auth/me geantwortet hat */
  loaded: boolean;
  /** Kann der Server Login-Mails verschicken? */
  loginEnabled: boolean;
  /** Angemeldete Adresse oder null */
  email: string | null;
}

export type RequestLoginResult = 'sent' | 'invalid' | 'rate-limited' | 'disabled' | 'error';

/** devCode ist nur in Testumgebungen gesetzt, dort geht keine Mail raus und der Server nennt den Code direkt. */
export interface RequestLoginAnswer {
  result: RequestLoginResult;
  devCode?: string;
}

let state: AuthState = { loaded: false, loginEnabled: false, email: null };
const listeners = new Set<() => void>();

const setState = (next: Partial<AuthState>) => {
  state = { ...state, ...next };
  listeners.forEach(listener => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

export const useAuth = (): AuthState => useSyncExternalStore(subscribe, () => state);

const JSON_HEADERS = { 'Content-Type': 'application/json' };

const applyMe = (data: any) => setState({
  loaded: true,
  loginEnabled: data?.loginEnabled === true,
  email: typeof data?.email === 'string' ? data.email : null,
});

/** Fragt beim Start, ob eine Sitzung besteht. Ein Fehler heißt „nicht angemeldet“. */
export const refreshAuth = async (): Promise<void> => {
  try {
    const response = await fetch('/api/auth/me');
    applyMe(response.ok ? await response.json() : null);
  } catch {
    applyMe(null);
  }
};

export const requestLogin = async (email: string): Promise<RequestLoginAnswer> => {
  try {
    const response = await fetch('/api/auth/login/request', {
      method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ email: email.trim() }),
    });
    if (response.ok) {
      const data = await response.json().catch(() => null);
      return { result: 'sent', ...(typeof data?.devCode === 'string' ? { devCode: data.devCode } : {}) };
    }
    if (response.status === 400) return { result: 'invalid' };
    if (response.status === 429) return { result: 'rate-limited' };
    if (response.status === 503) return { result: 'disabled' };
    return { result: 'error' };
  } catch {
    return { result: 'error' };
  }
};

const verify = async (body: object): Promise<boolean> => {
  try {
    const response = await fetch('/api/auth/login/verify', {
      method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body),
    });
    if (!response.ok) return false;
    applyMe(await response.json());
    return true;
  } catch {
    return false;
  }
};

export const verifyCode = (email: string, code: string) => verify({ email: email.trim(), code: code.trim() });
export const verifyToken = (token: string) => verify({ token });

const call = async (url: string, method: string): Promise<boolean> => {
  try {
    return (await fetch(url, { method })).ok;
  } catch {
    return false;
  }
};

export const logout = async () => {
  await call('/api/auth/logout', 'POST');
  setState({ email: null });
};

export const logoutEverywhere = async () => {
  if (await call('/api/auth/logout-all', 'POST')) setState({ email: null });
};

export const deleteAccount = async (): Promise<boolean> => {
  const ok = await call('/api/auth/account', 'DELETE');
  if (ok) setState({ email: null });
  return ok;
};

/** Liest ?login=<token> aus der Adresse, löst ihn ein und entfernt ihn aus der URL. */
export const handleLoginLink = async (): Promise<boolean> => {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('login');
  if (!token) return false;
  params.delete('login');
  const query = params.toString();
  window.history.replaceState(null, '', window.location.pathname + (query ? `?${query}` : '') + window.location.hash);
  return verifyToken(token);
};

/** Nur für Tests: zurück auf den Ausgangszustand. */
export const resetAuthForTests = () => {
  state = { loaded: false, loginEnabled: false, email: null };
};
