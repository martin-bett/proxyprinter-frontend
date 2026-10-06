import { Config } from '../ApiFactory';
import { SearchApiResult } from './SearchCacheService';

// Gemeinsamer Such-Cache im Backend (/api/search-cache): Ergebnisse, die irgendein Browser gefunden hat,
// liegen dort ein paar Tage als JSON-Dateien. Vor dem Suchen fragen wir nach, nach dem Suchen schicken wir hin.

const LOOKUP_CHUNK = 25;
const LOOKUP_PARALLEL = 4;
const STORE_CHUNK = 50;
const STORE_MAX_CHARS = 4 * 1024 * 1024;
const FLUSH_DELAY_MS = 1000;

// Felder, die das Suchergebnis nicht verändern: Änderungen daran sollen den Cache nicht ungültig machen
const IGNORED_CONFIG_FIELDS = new Set([
  'published', 'ratingCount', 'averageRating', 'ratingValue', 'lastUsed', 'officialWebsite',
  'concurrentLimit', 'category', 'visitorIdentifier',
]);

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}

// cyrb53: kurzer, schneller Hash; reicht, um geänderte Configs zu erkennen (kein Sicherheitsmerkmal)
function hash53(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

/** Hash über alle Einstellungen, die das Ergebnis beeinflussen (Request, Felder, Sprache, ...). */
export function configHash(config: Config): string {
  const relevant = Object.fromEntries(
    Object.entries(config as unknown as Record<string, unknown>).filter(([key]) => !IGNORED_CONFIG_FIELDS.has(key))
  );
  return hash53(stableStringify(relevant));
}

/** Config-Namen sind nicht eindeutig (Kopien), die Id schon. */
export function configKey(config: Config): string {
  return config.id !== undefined && config.id !== null ? String(config.id) : `name:${config.name}`;
}

interface ServerKey {
  config: string;
  configHash: string;
  term: string;
}

interface StoreEntry extends ServerKey {
  result: SearchApiResult;
}

interface CachedSearch extends ServerKey {
  createdAt: number;
  result: SearchApiResult;
}

export interface ServerLookup {
  apiKey: string;
  config: Config;
  term: string;
}

const normalizeTerm = (term: string) => term.trim().replace(/\s+/g, ' ').toLowerCase();

/** Schlüssel für die Treffer-Map von lookup(). */
export function lookupKey(apiKey: string, term: string): string {
  return `${apiKey}\u0000${term}`;
}

async function runLimited<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const index = next++;
      results[index] = await tasks[index]();
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

/**
 * Ob das Backend den Such-Cache anbietet (searchcache.enabled). Nur ein ausdrückliches "aus"
 * oder ein Backend ohne den Endpunkt (404) schaltet ihn ab; Netzfehler lassen ihn an.
 */
export async function fetchServerCacheEnabled(): Promise<boolean> {
  try {
    const response = await fetch('/api/search-cache/info');
    if (response.status === 404) return false;
    if (!response.ok) return true;
    const info: { enabled?: boolean } = await response.json();
    return info.enabled !== false;
  } catch {
    return true;
  }
}

class ServerSearchCache {
  private queue: StoreEntry[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Fragt das Backend nach gespeicherten Ergebnissen. Liefert nur Treffer, Schlüssel siehe lookupKey().
   * Fehler (Backend alt, offline, ...) zählen als "nichts gefunden".
   */
  async lookup(requests: ServerLookup[]): Promise<Map<string, SearchApiResult>> {
    const hits = new Map<string, SearchApiResult>();
    if (requests.length === 0) return hits;
    // Server-Antworten kommen mit Config-Schlüssel zurück, hier wieder auf apiKey abbilden
    const byServerKey = new Map<string, ServerLookup[]>();
    const keys: ServerKey[] = [];
    requests.forEach(request => {
      const key = { config: configKey(request.config), configHash: configHash(request.config), term: request.term };
      const id = `${key.config}\u0000${key.configHash}\u0000${normalizeTerm(key.term)}`;
      if (!byServerKey.has(id)) {
        byServerKey.set(id, []);
        keys.push(key);
      }
      byServerKey.get(id)!.push(request);
    });
    const chunks: ServerKey[][] = [];
    for (let i = 0; i < keys.length; i += LOOKUP_CHUNK) chunks.push(keys.slice(i, i + LOOKUP_CHUNK));
    await runLimited(chunks.map(chunk => async () => {
      try {
        const response = await fetch('/api/search-cache/lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entries: chunk }),
        });
        if (!response.ok) return;
        const data: { hits?: CachedSearch[] } = await response.json();
        (data.hits || []).forEach(hit => {
          if (!hit?.result || !Array.isArray(hit.result.results)) return;
          const id = `${hit.config}\u0000${hit.configHash}\u0000${normalizeTerm(hit.term)}`;
          (byServerKey.get(id) || []).forEach(request => hits.set(lookupKey(request.apiKey, request.term), hit.result));
        });
      } catch (error) {
        console.warn('Server-Such-Cache nicht erreichbar', error);
      }
    }), LOOKUP_PARALLEL);
    return hits;
  }

  /** Merkt ein frisch aus dem Netz geholtes Ergebnis vor; gesendet wird gesammelt kurz danach. */
  put(config: Config, term: string, result: SearchApiResult): void {
    // Leere Ergebnisse können auch ein vorübergehendes Problem der Quelle sein, die nicht für alle merken
    if (!result || !Array.isArray(result.results) || result.results.length === 0) return;
    this.queue.push({ config: configKey(config), configHash: configHash(config), term, result: { ...result, requestCount: undefined } });
    if (this.flushTimer === null) {
      this.flushTimer = setTimeout(() => {
        this.flushTimer = null;
        void this.flush();
      }, FLUSH_DELAY_MS);
    }
  }

  async flush(): Promise<void> {
    const pending = this.queue;
    this.queue = [];
    let batch: StoreEntry[] = [];
    let batchChars = 0;
    const send = async (entries: StoreEntry[]) => {
      if (entries.length === 0) return;
      try {
        await fetch('/api/search-cache', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entries }),
        });
      } catch (error) {
        console.warn('Konnte Suchergebnisse nicht an den Server-Cache senden', error);
      }
    };
    for (const entry of pending) {
      const size = JSON.stringify(entry).length;
      if (batch.length >= STORE_CHUNK || (batch.length > 0 && batchChars + size > STORE_MAX_CHARS)) {
        await send(batch);
        batch = [];
        batchChars = 0;
      }
      batch.push(entry);
      batchChars += size;
    }
    await send(batch);
  }
}

const serverSearchCache = new ServerSearchCache();
export default serverSearchCache;
