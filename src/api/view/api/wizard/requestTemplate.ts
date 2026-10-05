// Baut aus einer echten Beispielabfrage (URL/Body mit einem Kartennamen darin)
// die Config-Felder baseUrl + parameterMap, in denen der Name durch {cardname}
// ersetzt ist. ApiFactory setzt den Platzhalter bei jeder Suche wieder ein.

export type WizardMethod = 'GET' | 'POST';
export type WizardBodyFormat = 'json' | 'urlencoded';

export interface WizardRequest {
  url: string;
  method: WizardMethod;
  body: string;
  requestFormat: WizardBodyFormat;
}

export interface RequestTemplate {
  baseUrl: string;
  parameterMap: { request: Record<string, string>; url: Record<string, string> };
  /** Parameter, in denen der Kartenname gefunden wurde */
  nameParams: string[];
  warnings: string[];
}

export type TemplateResult = RequestTemplate | { error: string };

export function isTemplateError(r: TemplateResult): r is { error: string } {
  return 'error' in r;
}

const PLACEHOLDER = '{cardname}';

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Ersetzt den Suchnamen (ohne Groß-/Kleinschreibung) durch {cardname}. */
export function replaceName(value: string, searchName: string): string {
  const name = searchName.trim();
  if (!name) return value;
  return value.replace(new RegExp(escapeRegExp(name), 'gi'), PLACEHOLDER);
}

function templateParams(
  entries: [string, string][],
  searchName: string,
): { request: Record<string, string>; nameParams: string[] } {
  const request: Record<string, string> = {};
  const nameParams: string[] = [];
  entries.forEach(([key, value]) => {
    const replaced = replaceName(value, searchName);
    if (replaced !== value) nameParams.push(key);
    request[key] = replaced;
  });
  return { request, nameParams };
}

function parseUrl(raw: string): URL | null {
  try {
    const url = new URL(raw.trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

export function validateRequest(req: WizardRequest): string | null {
  if (!parseUrl(req.url)) return 'Please enter a full URL starting with http:// or https://';
  if (req.method === 'POST' && req.requestFormat === 'json' && req.body.trim()) {
    try {
      const parsed = JSON.parse(req.body);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return 'The JSON body must be an object like {"q": "Lightning Bolt"}';
      }
    } catch {
      return 'The body is not valid JSON';
    }
  }
  return null;
}

/** Name in Pfad statt Query/Body: kann ApiFactory nicht abbilden. */
function nameInPath(url: URL, searchName: string): boolean {
  let path = url.pathname;
  try {
    path = decodeURIComponent(path);
  } catch {
    // kaputte Kodierung: roh vergleichen
  }
  return path.toLowerCase().includes(searchName.trim().toLowerCase());
}

export function buildTemplate(req: WizardRequest, searchName: string): TemplateResult {
  const invalid = validateRequest(req);
  if (invalid) return { error: invalid };
  if (!searchName.trim()) return { error: 'Please enter the card name used in your query' };
  const url = parseUrl(req.url) as URL;
  const warnings: string[] = [];

  if (req.method === 'GET') {
    const { request, nameParams } = templateParams(Array.from(url.searchParams.entries()), searchName);
    if (nameParams.length === 0) {
      return {
        error: nameInPath(url, searchName)
          ? 'The card name is part of the URL path. Only query parameters (…?q=Name) can be used for searching.'
          : `"${searchName.trim()}" was not found in the query parameters of the URL.`,
      };
    }
    if (new Set(Array.from(url.searchParams.keys())).size < Array.from(url.searchParams.keys()).length) {
      warnings.push('The URL repeats a parameter; only its last value is kept.');
    }
    return {
      baseUrl: url.origin + url.pathname,
      parameterMap: { request, url: {} },
      nameParams,
      warnings,
    };
  }

  // POST: Query-Teil der URL bleibt in der baseUrl, die Parameter gehen in den Body
  let entries: [string, string][];
  if (req.requestFormat === 'json') {
    const parsed = req.body.trim() ? JSON.parse(req.body) : {};
    entries = Object.entries(parsed).map(([key, value]) => {
      if (value !== null && typeof value === 'object') {
        warnings.push(`"${key}" is nested JSON; it is stored as text.`);
        return [key, JSON.stringify(value)];
      }
      if (typeof value !== 'string') {
        warnings.push(`"${key}" is sent as text ("${String(value)}") instead of ${typeof value}.`);
      }
      return [key, String(value)];
    });
  } else {
    entries = Array.from(new URLSearchParams(req.body.trim()).entries());
  }
  const { request, nameParams } = templateParams(entries, searchName);
  if (nameParams.length === 0) {
    const inUrl = replaceName(req.url, searchName) !== req.url;
    return {
      error: inUrl
        ? 'For POST the card name has to be in the body, not in the URL.'
        : `"${searchName.trim()}" was not found in the request body.`,
    };
  }
  return {
    baseUrl: url.toString(),
    parameterMap: { request, url: {} },
    nameParams,
    warnings,
  };
}
