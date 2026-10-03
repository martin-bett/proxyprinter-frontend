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
}

export type CardResultsMap = Record<string, CardGroup>;

/** Selected card per slot for each card name; null when no image is selected/visible. */
export type SelectedCardsMap = Record<string, (CardResult | null)[]>;

export type GroupedResults = Record<string, CardResult[]>;

export interface LogEntry {
  message: string;
  configName: string;
  rawResponse?: string;
}

/** A single line parsed from the decklist textarea. */
export interface DeckEntry {
  count: number;
  name: string;
  set?: string;
}
