/**
 * Admin-Seite (/admin): Laufzeiten der Backend-Caches und "Jetzt leeren" über /api/admin.
 * Nur für Konten, die das Backend als Admin kennt (ADMIN_EMAILS auf dem Server).
 */
import { responseErrorText } from '../../i18n/backendError';

export interface AdminSetting {
  key: string;
  value: number;
  /** Wert aus der Server-Konfiguration, gilt nach "Zurücksetzen" */
  defaultValue: number;
  min: number;
  max: number;
  /** true, wenn der Wert auf der Admin-Seite geändert wurde */
  overridden: boolean;
}

export interface AdminCache {
  name: string;
  entries: number;
  /** -1 bei Caches im Speicher */
  bytes: number;
  /** Zeitpunkt des ältesten Eintrags (ms) oder null */
  oldest: number | null;
  /** Einstellung für die Laufzeit oder null (feste Laufzeit / unbegrenzt) */
  setting: string | null;
}

export interface AdminOverview {
  settings: AdminSetting[];
  caches: AdminCache[];
}

export type AdminLoadResult =
  | { status: 'ok'; data: AdminOverview }
  | { status: 'login' }
  | { status: 'forbidden' }
  | { status: 'error' };

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export const loadAdmin = async (): Promise<AdminLoadResult> => {
  try {
    const response = await fetch('/api/admin');
    if (response.status === 401) return { status: 'login' };
    if (response.status === 403) return { status: 'forbidden' };
    if (!response.ok) return { status: 'error' };
    return { status: 'ok', data: await response.json() };
  } catch {
    return { status: 'error' };
  }
};

/** Ergebnis einer Aktion: ok mit Antwort oder ein übersetzter Fehlertext. */
export type AdminActionResult<T> = { ok: true; value: T } | { ok: false; error: string };

const send = async <T>(url: string, init: RequestInit, fallback: string): Promise<AdminActionResult<T>> => {
  try {
    const response = await fetch(url, init);
    if (!response.ok) return { ok: false, error: await responseErrorText(response, `${fallback} (${response.status})`) };
    return { ok: true, value: await response.json() };
  } catch {
    return { ok: false, error: fallback };
  }
};

export const saveSetting = (key: string, value: number, fallback: string) =>
  send<AdminSetting>(`/api/admin/settings/${encodeURIComponent(key)}`,
    { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify({ value }) }, fallback);

export const resetSetting = (key: string, fallback: string) =>
  send<AdminSetting>(`/api/admin/settings/${encodeURIComponent(key)}`, { method: 'DELETE' }, fallback);

export const clearCache = (name: string, fallback: string) =>
  send<{ deleted: number }>(`/api/admin/caches/${encodeURIComponent(name)}/clear`, { method: 'POST' }, fallback);

/** Ob die aktuelle Adresse die Admin-Seite ist. */
export const isAdminPath = (pathname: string) => /^\/admin\/?$/.test(pathname);

/** 1536 -> "1.5 KB" */
export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
};
