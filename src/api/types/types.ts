import { CropSettings, ImageInfo, SearchResult } from '../../service/ApiFactory';

/** A single search result, extended with per-card crop/image state as used by the viewer. */
export interface CardResult extends SearchResult {
  cropSettings: CropSettings;
  imageInfo?: ImageInfo;
}

/** All results found for one decklist entry, plus how many copies are needed. */
export interface CardGroup {
  count: number;
  results: CardResult[];
  /** Gewünschter Druck je Platz aus der Decklist, z. B. "(M10) 146"; wird vorausgewählt, wenn er dabei ist */
  wanted?: (Pick<DeckEntry, 'set' | 'number'> | null)[];
  // Verbundene Karte (z.B. Token): Deckkarten, die sie brauchen
  connectedFrom?: string[];
}

export type CardResultsMap = Record<string, CardGroup>;

/** Selected card per slot for each card name; null when no image is selected/visible. */
export type SelectedCardsMap = Record<string, (CardResult | null)[]>;

export type GroupedResults = Record<string, CardResult[]>;

/** One row of the search log: where a search result came from and how many hits it had. */
export interface LogEntry {
  configName: string;
  cardName: string;
  /** cache = lokaler Browser-Cache, server = gemeinsamer Such-Cache im Backend */
  source: 'cache' | 'server' | 'network' | 'error';
  count: number;
  /** Dauer der Suche in Millisekunden (auch Cache-Lesen) */
  durationMs: number;
  /** HTTP-Requests dieser Suche; 0 bei Cache-Treffern, undefined bei Fehlern */
  requestCount?: number;
  rawResponse?: string;
  error?: string;
}

/** A single line parsed from the decklist textarea. */
export interface DeckEntry {
  count: number;
  name: string;
  set?: string;
  /** Sammlernummer, z. B. aus "4 Lightning Bolt (M10) 146" */
  number?: string;
}
