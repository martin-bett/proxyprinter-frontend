// Set-Katalog, Stufe 1/2 aus concepts/set-suche.md: jedes Set mit allen Kennungen
// (Code, Arena-Code, MTGO-Code, Name), damit "(DAR)" aus der Decklist und "Dominaria"
// aus einem Suchtreffer als dasselbe Set erkannt werden. Quelle ist Scryfall.
import { DeckEntry } from '../../api/types/types';
import { SearchResult } from '../ApiFactory';

const SCRYFALL_SETS_URL = 'https://api.scryfall.com/sets';
const STORAGE_KEY = 'set-catalog:scryfall';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Alias (klein geschrieben) -> kanonischer Set-Code */
let aliases = new Map<string, string>();
let loading: Promise<void> | null = null;

const normalize = (value: string) => value.trim().toLowerCase();

interface ScryfallSet {
  code: string;
  name: string;
  arena_code?: string;
  mtgo_code?: string;
}

/** Baut den Alias-Index; exportiert für Tests. */
export function setCatalogEntries(sets: ScryfallSet[]): void {
  const next = new Map<string, string>();
  sets.forEach(set => {
    const code = normalize(set.code);
    // Codes gewinnen gegen Namen und Arena-/MTGO-Codes anderer Sets
    [set.name, set.arena_code, set.mtgo_code].forEach(alias => {
      if (alias && !next.has(normalize(alias))) next.set(normalize(alias), code);
    });
  });
  sets.forEach(set => next.set(normalize(set.code), normalize(set.code)));
  aliases = next;
}

/** Lädt den Katalog einmal (localStorage, sonst Scryfall). Fehler lassen den Abgleich auf Rohwerte zurückfallen. */
export function loadSetCatalog(): Promise<void> {
  if (aliases.size > 0) return Promise.resolve();
  if (!loading) {
    loading = (async () => {
      try {
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
        if (stored && Date.now() - stored.fetchedAt < MAX_AGE_MS && Array.isArray(stored.sets)) {
          setCatalogEntries(stored.sets);
          return;
        }
      } catch {
        // kaputter oder gesperrter Speicher: neu laden
      }
      try {
        const response = await fetch(SCRYFALL_SETS_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const body = await response.json();
        const sets: ScryfallSet[] = (body.data || []).map((set: ScryfallSet) => ({
          code: set.code, name: set.name, arena_code: set.arena_code, mtgo_code: set.mtgo_code,
        }));
        setCatalogEntries(sets);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ fetchedAt: Date.now(), sets }));
        } catch {
          // ohne Speicher wird beim nächsten Mal neu geladen
        }
      } catch (error) {
        console.warn('Set-Katalog nicht geladen, vergleiche Sets nur roh', error);
      } finally {
        loading = null;
      }
    })();
  }
  return loading;
}

/** Kanonische Kennung eines Sets; unbekannte Werte bleiben klein geschrieben roh. */
export function canonicalSet(value: string): string {
  const key = normalize(value);
  return aliases.get(key) ?? key;
}

const normalizeNumber = (value: string) => normalize(value).replace(/^0+(?=\d)/, '');

/** Gewünschter Druck für einen Platz. */
export type WantedPrint = Pick<DeckEntry, 'set' | 'number'>;

/** 2 = Set und Nummer passen, 1 = nur das Set, 0 = kein Treffer oder kein Wunsch. */
export function printMatchScore(result: Pick<SearchResult, 'set' | 'setNumber'>, wanted: WantedPrint | null | undefined): number {
  if (!wanted?.set || !result.set || canonicalSet(result.set) !== canonicalSet(wanted.set)) return 0;
  if (wanted.number && result.setNumber && normalizeNumber(result.setNumber) === normalizeNumber(wanted.number)) return 2;
  return 1;
}
