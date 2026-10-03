/**
 * Drosselt ausgehende Requests pro Ziel-Host, wiederholt sie bei 429/503 unter
 * Beachtung von Retry-After und fasst identische, gleichzeitig laufende
 * GET-Requests zu einem einzigen Netzwerkaufruf zusammen.
 *
 * Scryfall erlaubt im Schnitt ~10 Requests/s, für /cards/search, /cards/named,
 * /cards/random und /cards/collection aber nur 2 Requests/s. Wer darüber liegt,
 * bekommt 429 mit "Retry-After: 60" und wird bei Wiederholung länger gesperrt.
 */

const DEFAULT_MIN_INTERVAL_MS = 100;
const MAX_RETRIES = 3;
const DEFAULT_RETRY_AFTER_MS = 1000;
const MAX_RETRY_AFTER_MS = 120_000;

// Mindestabstand zwischen zwei Requests auf denselben Host (bzw. Host + Pfad-Präfix).
const HOST_RULES: { host: string; pathPrefix?: string; minIntervalMs: number }[] = [
  { host: 'api.scryfall.com', pathPrefix: '/cards/search', minIntervalMs: 550 },
  { host: 'api.scryfall.com', pathPrefix: '/cards/named', minIntervalMs: 550 },
  { host: 'api.scryfall.com', pathPrefix: '/cards/random', minIntervalMs: 550 },
  { host: 'api.scryfall.com', pathPrefix: '/cards/collection', minIntervalMs: 550 },
  { host: 'api.scryfall.com', minIntervalMs: 120 },
];

interface Lane {
  // Ende der Kette: der nächste Request wartet auf diese Promise.
  tail: Promise<void>;
  // Frühester Zeitpunkt, zu dem der nächste Request rausgehen darf.
  nextAllowedAt: number;
  minIntervalMs: number;
}

const lanes = new Map<string, Lane>();
const inFlight = new Map<string, Promise<Response>>();

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

function resolveLane(target: URL): Lane {
  const rule = HOST_RULES.find(r =>
    r.host === target.hostname && (!r.pathPrefix || target.pathname.startsWith(r.pathPrefix))
  );
  const key = rule ? `${rule.host}${rule.pathPrefix ?? ''}` : target.host;
  let lane = lanes.get(key);
  if (!lane) {
    lane = {
      tail: Promise.resolve(),
      nextAllowedAt: 0,
      minIntervalMs: rule?.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS,
    };
    lanes.set(key, lane);
  }
  return lane;
}

// Reiht den Aufruf in die Lane ein und hält den Mindestabstand ein.
function schedule(lane: Lane): Promise<void> {
  const slot = lane.tail.then(async () => {
    const wait = lane.nextAllowedAt - Date.now();
    if (wait > 0) await sleep(wait);
    lane.nextAllowedAt = Date.now() + lane.minIntervalMs;
  });
  lane.tail = slot;
  return slot;
}

function parseRetryAfter(header: string | null): number {
  if (!header) return DEFAULT_RETRY_AFTER_MS;
  const seconds = Number(header);
  let ms = Number.isFinite(seconds)
    ? seconds * 1000
    : new Date(header).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) ms = DEFAULT_RETRY_AFTER_MS;
  return Math.min(ms, MAX_RETRY_AFTER_MS);
}

async function fetchWithRetry(input: string, init: RequestInit | undefined, target: URL): Promise<Response> {
  const lane = resolveLane(target);
  for (let attempt = 0; ; attempt++) {
    await schedule(lane);
    const response = await fetch(input, init);
    if ((response.status !== 429 && response.status !== 503) || attempt >= MAX_RETRIES) {
      return response;
    }
    const retryAfterMs = parseRetryAfter(response.headers.get('Retry-After'));
    console.warn(`${response.status} von ${target.host}, neuer Versuch in ${Math.round(retryAfterMs / 1000)}s`);
    // Die ganze Lane pausieren, nicht nur diesen Request.
    lane.nextAllowedAt = Math.max(lane.nextAllowedAt, Date.now() + retryAfterMs);
  }
}

/**
 * Wie fetch(), aber gedrosselt und mit Retry.
 * @param targetUrl die eigentliche Ziel-URL, falls der Request über den
 *   Backend-Proxy läuft (dann wird nach dem Ziel-Host gedrosselt).
 */
export function throttledFetch(input: string, init?: RequestInit, targetUrl?: string): Promise<Response> {
  const target = new URL(targetUrl ?? input, window.location.origin);
  const method = (init?.method ?? 'GET').toUpperCase();

  if (method !== 'GET' && !targetUrl) {
    return fetchWithRetry(input, init, target);
  }

  // Identische laufende Requests teilen sich eine Antwort. Für Proxy-POSTs
  // zählt die Ziel-URL samt Body, damit nur wirklich gleiche Anfragen gebündelt werden.
  const bodyKey = typeof init?.body === 'string' || init?.body instanceof URLSearchParams
    ? String(init.body)
    : init?.body ? null : '';
  if (bodyKey === null) {
    return fetchWithRetry(input, init, target);
  }
  const key = `${method} ${input} ${target.href} ${bodyKey}`;
  let shared = inFlight.get(key);
  if (!shared) {
    shared = fetchWithRetry(input, init, target).finally(() => inFlight.delete(key));
    inFlight.set(key, shared);
  }
  return shared.then(response => response.clone());
}
