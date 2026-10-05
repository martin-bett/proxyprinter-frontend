// Deckfinder: Decks per Link, ID oder Name von Deckbuilder-Seiten laden.
// Das Backend ruft die Seite ab (/api/deckfinder/{id}/fetch), hier werden die Felder gelesen
// und das Deck als Decklist-Text im Arena-Format gebaut. Konzept: concepts/deckfinder.md.
import { DeckEntry } from '../../api/types/types';
import { formatDeckLine, parseDeckLine, sectionHeader } from '../deck/deckParser';

export interface DeckFinderConfig {
  id: number;
  name: string;
  category: string;
  officialWebsite?: string;
  published?: boolean;
  linkPattern?: string;
  fetchUrl?: string;
  dataFormat?: string;
  deckNameField?: string;
  entryListFields?: string;
  quantityField?: string;
  nameField?: string;
  setField?: string;
  numberField?: string;
  boardField?: string;
  optionalBoards?: string;
  searchUrl?: string;
  searchListField?: string;
  searchIdField?: string;
  searchNameField?: string;
  searchOwnerField?: string;
  searchImageField?: string;
  searchInfoField?: string;
}

export interface LoadedDeck {
  deckName?: string;
  entries: DeckEntry[];
  /** Fertiger Text fürs Decklist-Feld */
  text: string;
  /** Wie viele Einträge in optionalen Boards übersprungen wurden, je Board */
  skipped: Record<string, number>;
}

export interface DeckSearchHit {
  id: string;
  name: string;
  owner?: string;
  image?: string;
  info?: string;
}

/** Komma-getrennte Liste ohne leere Einträge. */
export function splitList(value?: string): string[] {
  return (value || '').split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * Werte an einem Punkt-Pfad. "*" steht für alle Werte eines Objekts oder einer Liste,
 * daher kommt immer eine Liste zurück (leer, wenn der Pfad nicht passt).
 */
export function valuesAtPath(data: unknown, path: string): unknown[] {
  let current: unknown[] = [data];
  for (const key of path.split('.').map(k => k.trim()).filter(Boolean)) {
    const next: unknown[] = [];
    for (const item of current) {
      if (item === null || item === undefined || typeof item !== 'object') continue;
      if (key === '*') {
        next.push(...Object.values(item as object));
      } else if (key in (item as object)) {
        next.push((item as Record<string, unknown>)[key]);
      }
    }
    current = next;
  }
  return current;
}

function valueAt(data: unknown, path?: string): unknown {
  if (!path) return undefined;
  return valuesAtPath(data, path)[0];
}

function text(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const s = String(value).trim();
  return s ? s : undefined;
}

/** Erkennt einen eingefügten Deck-Link; liefert die erste passende Config. */
export function matchDeckLink(configs: DeckFinderConfig[], input: string): DeckFinderConfig | null {
  const value = input.trim();
  if (!value || /\s/.test(value)) return null;
  for (const config of configs) {
    if (!config.linkPattern || !config.fetchUrl) continue;
    try {
      if (new RegExp(config.linkPattern).test(value)) return config;
    } catch {
      // ungültige Regex in einer fremden Config: ignorieren
    }
  }
  return null;
}

/** Board-Namen vergleichen ohne Groß-/Kleinschreibung. */
function boardKey(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Optionales Board, zu dem ein Eintrag gehört, oder null für das Hauptdeck.
 * Ein Eintrag mit mehreren Kategorien gehört zum Board, sobald eine davon optional ist.
 */
function optionalBoardOf(boards: string[], optional: Map<string, string>): string | null {
  for (const board of boards) {
    const name = optional.get(boardKey(board));
    if (name) return name;
  }
  return null;
}

function buildDeck(entries: (DeckEntry & { board: string | null })[], selected: Set<string>, deckName?: string): LoadedDeck {
  const skipped: Record<string, number> = {};
  const kept: DeckEntry[] = [];
  for (const { board, ...entry } of entries) {
    if (board && !selected.has(boardKey(board))) {
      skipped[board] = (skipped[board] || 0) + entry.count;
      continue;
    }
    kept.push(entry);
  }
  return { deckName, entries: kept, text: kept.map(formatDeckLine).join('\n'), skipped };
}

/**
 * Deck aus der Antwort der Seite lesen.
 * @param selectedBoards optionale Boards, die mitgenommen werden sollen (Standard: keine)
 */
export function extractDeck(config: DeckFinderConfig, body: string, selectedBoards: string[] = []): LoadedDeck {
  const optional = new Map(splitList(config.optionalBoards).map(b => [boardKey(b), b]));
  const selected = new Set(selectedBoards.map(boardKey));

  if ((config.dataFormat || 'json').toLowerCase() === 'text') {
    const entries: (DeckEntry & { board: string | null })[] = [];
    let board: string | null = null;
    for (const line of body.split(/\r?\n/)) {
      const header = sectionHeader(line);
      if (header) {
        board = optionalBoardOf([header], optional);
        continue;
      }
      const entry = parseDeckLine(line);
      if (entry) entries.push({ ...entry, board });
    }
    return buildDeck(entries, selected);
  }

  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    throw new Error('Antwort ist kein JSON. Stimmt das Data Format der Config?');
  }
  const listFields = splitList(config.entryListFields);
  if (listFields.length === 0) throw new Error('Die Config hat keine Entry List Fields.');

  const entries: (DeckEntry & { board: string | null })[] = [];
  for (const field of listFields) {
    // "Sideboard=boards.sideboard.cards.*": alles aus diesem Pfad gehört zum Board "Sideboard"
    const eq = field.indexOf('=');
    const listBoard = eq > 0 ? field.slice(0, eq).trim() : null;
    const path = eq > 0 ? field.slice(eq + 1).trim() : field;
    for (const list of valuesAtPath(data, path)) {
      const items = Array.isArray(list) ? list : [list];
      for (const item of items) {
        const name = text(valueAt(item, config.nameField));
        if (!name) continue;
        const quantity = config.quantityField ? parseInt(String(valueAt(item, config.quantityField) ?? ''), 10) : 1;
        const set = text(valueAt(item, config.setField));
        const number = set ? text(valueAt(item, config.numberField)) : undefined;
        const rawBoards = config.boardField ? valueAt(item, config.boardField) : undefined;
        const boards = [
          ...(listBoard ? [listBoard] : []),
          ...(Array.isArray(rawBoards) ? rawBoards.map(String) : rawBoards !== undefined && rawBoards !== null ? [String(rawBoards)] : []),
        ];
        entries.push({
          count: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
          name,
          ...(set ? { set: set.toUpperCase() } : {}),
          ...(number ? { number } : {}),
          board: optionalBoardOf(boards, optional),
        });
      }
    }
  }
  if (entries.length === 0) throw new Error('Keine Karten in der Antwort gefunden. Stimmen die Felder der Config?');
  return buildDeck(entries, selected, text(valueAt(data, config.deckNameField)));
}

/** Treffer der Namenssuche lesen. */
export function extractSearchHits(config: DeckFinderConfig, body: string): DeckSearchHit[] {
  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    throw new Error('Antwort der Suche ist kein JSON.');
  }
  const list = config.searchListField ? valueAt(data, config.searchListField) : data;
  if (!Array.isArray(list)) return [];
  return list.flatMap(item => {
    const id = text(valueAt(item, config.searchIdField));
    if (!id) return [];
    return [{
      id,
      name: text(valueAt(item, config.searchNameField)) || id,
      owner: text(valueAt(item, config.searchOwnerField)),
      image: text(valueAt(item, config.searchImageField)),
      info: text(valueAt(item, config.searchInfoField)),
    }];
  });
}

function headers(fingerprint?: string | null): HeadersInit {
  return { 'Content-Type': 'application/json', 'X-Fingerprint': fingerprint || '' };
}

async function readError(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (body && typeof body.error === 'string') return body.error;
  } catch {
    // kein JSON
  }
  return `HTTP ${response.status}`;
}

export async function fetchDeckFinderConfigs(fingerprint?: string | null): Promise<DeckFinderConfig[]> {
  const response = await fetch('/api/deckfinder', { headers: headers(fingerprint) });
  if (!response.ok) throw new Error(await readError(response));
  const configs: DeckFinderConfig[] = await response.json();
  return configs.sort((a, b) => Number(!!b.published) - Number(!!a.published) || a.name.localeCompare(b.name));
}

export async function loadDeck(config: DeckFinderConfig, input: string, selectedBoards: string[], fingerprint?: string | null): Promise<LoadedDeck> {
  const response = await fetch(`/api/deckfinder/${config.id}/fetch?input=${encodeURIComponent(input.trim())}`, { headers: headers(fingerprint) });
  if (!response.ok) throw new Error(await readError(response));
  return extractDeck(config, await response.text(), selectedBoards);
}

export async function searchDecks(config: DeckFinderConfig, query: string, page: number, fingerprint?: string | null): Promise<DeckSearchHit[]> {
  const response = await fetch(`/api/deckfinder/${config.id}/search?query=${encodeURIComponent(query.trim())}&page=${page}`, { headers: headers(fingerprint) });
  if (!response.ok) throw new Error(await readError(response));
  return extractSearchHits(config, await response.text());
}

let fingerprintPromise: Promise<string> | null = null;

/** Browser-Fingerprint für eigene (nicht veröffentlichte) Configs, einmal pro Seite berechnet. */
export function getFingerprint(): Promise<string> {
  if (!fingerprintPromise) {
    fingerprintPromise = import('@fingerprintjs/fingerprintjs')
      .then(FingerprintJS => FingerprintJS.load())
      .then(fp => fp.get())
      .then(result => result.visitorId)
      .catch(() => '');
  }
  return fingerprintPromise;
}

/** Verwaltung: create/copy/edit/publish/delete wie bei Gallery-Configs. */
export async function deckFinderConfigOperation(operation: 'create' | 'copy' | 'edit' | 'publish' | 'delete', body?: Partial<DeckFinderConfig>): Promise<void> {
  const fingerprint = await getFingerprint();
  const response = await fetch(`/api/deckfinder/${operation}`, {
    method: operation === 'create' ? 'GET' : 'POST',
    headers: headers(fingerprint),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error(await readError(response));
}

export async function isDeckFinderConfigOwner(configId: number): Promise<boolean> {
  const fingerprint = await getFingerprint();
  const response = await fetch(`/api/deckfinder/${configId}/check`, { headers: headers(fingerprint) });
  return response.ok ? Boolean(await response.json()) : false;
}
