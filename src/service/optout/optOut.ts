import { responseErrorText } from '../../i18n/backendError';
import i18n from '../../i18n';

/** Selbst-Sperre für Betreiber (Backend /api/blocklist): Host per Mail-Link oder DNS/Datei-Nachweis auf die Blocklist setzen. */

export interface OptOutInfo {
  mail: boolean;
  mailboxes: string[];
}

export interface OptOutResult {
  status: 'sent' | 'challenge' | 'blocked';
  host: string;
  email?: string | null;
  token?: string | null;
  dnsName?: string | null;
  dnsValue?: string | null;
  fileUrl?: string | null;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };
const LINK_PARAM = 'blockverify';

const post = async (path: string, body: unknown): Promise<OptOutResult> => {
  const response = await fetch(`/api/blocklist/${path}`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) });
  if (!response.ok) {
    throw new Error(await responseErrorText(response, i18n.t('configCommon.operationFailed', { status: response.status })));
  }
  return response.json();
};

export const fetchOptOutInfo = async (): Promise<OptOutInfo> => {
  try {
    const response = await fetch('/api/blocklist/info', { headers: JSON_HEADERS });
    if (response.ok) return response.json();
  } catch {
    // Backend nicht erreichbar: nur DNS/Datei anbieten
  }
  return { mail: false, mailboxes: [] };
};

export const requestOptOut = (host: string, method: 'mail' | 'challenge', mailbox?: string): Promise<OptOutResult> =>
  post('request', { host, method, mailbox, language: i18n.language });

export const verifyOptOut = (token: string): Promise<OptOutResult> => post('verify', { token });

/** Token aus dem Mail-Link (?blockverify=…) lesen und aus der Adresse entfernen. */
export const takeBlockVerifyToken = (): string | null => {
  const params = new URLSearchParams(window.location.search);
  const token = params.get(LINK_PARAM);
  if (!token) return null;
  params.delete(LINK_PARAM);
  const query = params.toString();
  window.history.replaceState(null, '', window.location.pathname + (query ? `?${query}` : '') + window.location.hash);
  return token;
};
