import type { WizardRequest } from './requestTemplate';

export interface TestResult {
  via: 'direct' | 'proxy';
  status: number;
  contentType: string;
  body: string;
  truncated?: boolean;
  /** Warum der direkte Aufruf nicht ging (meist CORS) */
  directError?: string;
}

export type DataFormat = 'json' | 'html';

/** JSON, wenn es sich parsen lässt, sonst HTML. */
export function detectFormat(contentType: string, body: string): DataFormat {
  const trimmed = body.trim();
  if (/json/i.test(contentType) || trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch {
      // doch kein JSON
    }
  }
  return 'html';
}

function requestInit(req: WizardRequest): RequestInit {
  if (req.method !== 'POST') return { method: 'GET' };
  return {
    method: 'POST',
    body: req.body,
    headers: { 'Content-Type': req.requestFormat === 'json' ? 'application/json' : 'application/x-www-form-urlencoded' },
  };
}

/**
 * Testabfrage: erst direkt aus dem Browser. Scheitert das (CORS, http auf https-Seite,
 * Netzwerk), über das Backend. via sagt, ob die Config den Backend-Proxy braucht.
 */
export async function runTestRequest(req: WizardRequest): Promise<TestResult> {
  let directError: string;
  try {
    const res = await fetch(req.url.trim(), requestInit(req));
    return {
      via: 'direct',
      status: res.status,
      contentType: res.headers.get('content-type') || '',
      body: await res.text(),
    };
  } catch (e) {
    directError = e instanceof Error ? e.message : String(e);
  }

  const res = await fetch('/api/proxy/probe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: req.url.trim(), method: req.method, body: req.body, requestFormat: req.requestFormat }),
  });
  if (!res.ok) throw new Error(`Backend test request failed (HTTP ${res.status})`);
  const probe = await res.json();
  if (probe.error) throw new Error(probe.error);
  return {
    via: 'proxy',
    status: probe.status,
    contentType: probe.contentType || '',
    body: probe.body || '',
    truncated: probe.truncated,
    directError,
  };
}

/** Lässt sich das Bild direkt (mit CORS) laden? Sonst braucht die Config "Proxy Images". */
export async function imageNeedsProxy(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { mode: 'cors' });
    return !res.ok;
  } catch {
    return true;
  }
}
