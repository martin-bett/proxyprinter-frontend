// Snapshots: der Arbeitsstand (Decklist, Suchergebnisse, Auswahl, Crops, Filter,
// PDF-Einstellungen) als reines JSON-Objekt, damit man nach einer Pause genau dort
// weitermachen kann. Snapshots sind unabhängig von der Suche: Analyze nutzt sie nie.
// Konzept: concepts/projekte-speichern.md im Projektordner.

import { CardResult, CardResultsMap, SelectedCardsMap } from '../../api/types/types';
import { CropSettings } from '../ApiFactory';
import { ManualPicksMap } from '../../viewer/filterPriority';
import { PdfSettings, defaultSettings } from '../../viewer/pdf/SettingsDialog';

import i18n from '../../i18n';

export const SNAPSHOT_FORMAT = 'proxyprinter-snapshot';
export const SNAPSHOT_VERSION = 1;

export type SnapshotKind = 'session' | 'generate' | 'manual';

/** PDF-Einstellungen ohne E-Mail-Adresse, die gehört nicht zum Arbeitsstand. */
export type SnapshotPdfSettings = Omit<PdfSettings, 'sendMail'>;

export interface SnapshotSelection {
  /** Index in results */
  i: number;
  /** Zur Kontrolle, falls sich die Reihenfolge der Ergebnisse geändert hat */
  url: string;
  /** Die Auswahl kann eine Kopie mit eigenen Crops sein */
  crop: CropSettings;
}

export interface SnapshotResult {
  name: string;
  apiName: string;
  imageUrl: string;
  set?: string;
  setNumber?: string;
  languageCode?: string;
  cropSettings: CropSettings;
}

export interface SnapshotEntry {
  /** Heutiger cardResults-Key (Kartenname bzw. Name_cropN bei eigenen Karten) */
  key: string;
  name: string;
  count: number;
  results: SnapshotResult[];
  selected: (SnapshotSelection | null)[];
  /** Plätze, deren Auswahl manuell getroffen wurde (gehen vor der Filter-Priorität). Fehlt in älteren Snapshots. */
  manual?: number[];
  /** Verbundene Karte (z.B. Token): Deckkarten, die sie brauchen. Fehlt bei normalen Einträgen. */
  connectedFrom?: string[];
}

export interface GeneratedPdf {
  progressId: string;
  createdAt: number;
}

export interface Snapshot {
  format: typeof SNAPSHOT_FORMAT;
  version: number;
  id: string;
  kind: SnapshotKind;
  createdAt: number;
  label: { cardCount: number; firstCard: string; custom?: string };
  contentHash: string;
  search: {
    decklist: string;
    enabledApis: string[];
    filters: { languages: string[]; apis: string[] };
    uniquePrints: boolean;
    entries: SnapshotEntry[];
  };
  pdf: {
    settings: SnapshotPdfSettings;
    generated?: GeneratedPdf;
  };
}

/** Der Teil des Viewer-Zustands, der in einen Snapshot kommt. */
export interface WorkState {
  decklist: string;
  cardResults: CardResultsMap;
  selectedCards: SelectedCardsMap;
  /** Manuell gewählte Bilder je Platz, siehe viewer/filterPriority */
  manualPicks?: ManualPicksMap;
  enabledApis: Record<string, boolean>;
  visibleLanguages: Set<string>;
  visibleApis: Set<string>;
  uniquePrints: boolean;
  settings: PdfSettings;
}

/** Ergebnis von restoreSnapshot, direkt in den State übernehmbar. */
export interface RestoredState {
  decklist: string;
  cardResults: CardResultsMap;
  selectedCards: SelectedCardsMap;
  manualPicks: ManualPicksMap;
  enabledApis: string[];
  visibleLanguages: Set<string>;
  visibleApis: Set<string>;
  uniquePrints: boolean;
  settings: SnapshotPdfSettings;
}

const CUSTOM_API = 'custom';

const sameCrop = (a: CropSettings | undefined, b: CropSettings | undefined): boolean =>
  JSON.stringify(a ?? {}) === JSON.stringify(b ?? {});

const toResult = (card: CardResult): SnapshotResult => {
  const result: SnapshotResult = {
    name: card.name,
    apiName: card.apiName,
    imageUrl: card.imageUrl,
    cropSettings: { ...card.cropSettings },
  };
  if (card.set !== undefined) result.set = card.set;
  if (card.setNumber !== undefined) result.setNumber = card.setNumber;
  if (card.languageCode !== undefined) result.languageCode = card.languageCode;
  return result;
};

/** FNV-1a über den JSON-Text; reicht, um gleiche Stände zu erkennen. */
export const hashString = (text: string): string => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0') + text.length.toString(16);
};

const newId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const isEmptyState = (state: Pick<WorkState, 'decklist' | 'cardResults'>): boolean =>
  state.decklist.trim() === '' && Object.keys(state.cardResults).length === 0;

/** Baut aus dem aktuellen Zustand einen Snapshot. */
export function createSnapshot(state: WorkState, kind: SnapshotKind, now: number = Date.now()): Snapshot {
  const entries: SnapshotEntry[] = Object.entries(state.cardResults).map(([key, group]) => {
    const results = group.results.map(toResult);
    const selected = (state.selectedCards[key] ?? []).map((card): SnapshotSelection | null => {
      if (!card) return null;
      let i = group.results.indexOf(card);
      if (i < 0) i = group.results.findIndex(r => r.imageUrl === card.imageUrl);
      if (i < 0) return null;
      return { i, url: card.imageUrl, crop: { ...card.cropSettings } };
    });
    const picks = state.manualPicks?.[key] ?? [];
    const manual = selected
      .map((selection, slot) => (selection && picks[slot]?.imageUrl === selection.url ? slot : -1))
      .filter(slot => slot >= 0);
    return {
      key,
      // Eigene Karten heißen Name_cropN, ihr Name steht im Ergebnis
      name: group.results[0]?.apiName === CUSTOM_API ? group.results[0].name : key,
      count: group.count,
      results,
      selected,
      manual,
      ...(group.connectedFrom?.length ? { connectedFrom: [...group.connectedFrom] } : {}),
    };
  });

  const { sendMail, ...pdfSettings } = state.settings;
  const search: Snapshot['search'] = {
    decklist: state.decklist,
    enabledApis: Object.keys(state.enabledApis).filter(name => state.enabledApis[name]).sort(),
    filters: {
      languages: Array.from(state.visibleLanguages).sort(),
      apis: Array.from(state.visibleApis).sort(),
    },
    uniquePrints: state.uniquePrints,
    entries,
  };

  return {
    format: SNAPSHOT_FORMAT,
    version: SNAPSHOT_VERSION,
    id: kind === 'session' ? 'session' : newId(),
    kind,
    createdAt: now,
    label: {
      cardCount: entries.length > 0
        ? entries.reduce((sum, entry) => sum + entry.count, 0)
        : decklistCount(state.decklist),
      firstCard: firstCardName(state.decklist, entries),
    },
    contentHash: hashString(JSON.stringify({ search, pdfSettings })),
    search,
    pdf: { settings: pdfSettings },
  };
}

/**
 * Überschreibt einen gespeicherten Snapshot mit dem aktuellen Stand. ID und angezeigter
 * Name bleiben (auch ein automatischer wird als fester Name übernommen), alles andere ist neu. Ein altes PDF passt dann nicht mehr zum Inhalt,
 * deshalb wird daraus ein manueller Snapshot ohne PDF (fällt so auch nicht unter das
 * Limit der Generate-Snapshots).
 */
export function overwriteSnapshot(target: Snapshot, state: WorkState, now: number = Date.now()): Snapshot {
  const fresh = createSnapshot(state, 'manual', now);
  return {
    ...fresh,
    id: target.id,
    label: { ...fresh.label, custom: snapshotLabel(target) },
  };
}

// Vor der ersten Suche: Anzahlen aus der Decklist
function decklistCount(decklist: string): number {
  return decklist.split('\n').reduce((sum, line) => {
    const match = line.trim().match(/^(\d+)x?\s+\S/);
    return match ? sum + parseInt(match[1], 10) : sum;
  }, 0);
}

/** true, wenn der Snapshot weder Decklist noch Karten enthält. */
export const isEmptySnapshot = (snapshot: Snapshot): boolean =>
  snapshot.search.decklist.trim() === '' && snapshot.search.entries.length === 0;

// Erste Karte der Ergebnisse; vor der ersten Suche die erste Zeile der Decklist
function firstCardName(decklist: string, entries: SnapshotEntry[]): string {
  if (entries.length > 0) return entries[0].name;
  for (const line of decklist.split('\n')) {
    const match = line.trim().match(/^(?:\d+x?\s+)?(.+?)(?:\s+\([^)]*\).*)?$/);
    if (match && match[1]) return match[1].trim();
  }
  return '';
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Zeitstempel MMddHHmm in Ortszeit, z. B. „10081930“. */
export function snapshotTimestamp(ms: number): string {
  const d = new Date(ms);
  return `${pad2(d.getMonth() + 1)}${pad2(d.getDate())}${pad2(d.getHours())}${pad2(d.getMinutes())}`;
}

/** Anzeigename, z. B. „10081930 Lightning Bolt“ (Zeitstempel MMddHHmm + erste Karte). */
export function snapshotLabel(snapshot: Snapshot): string {
  if (snapshot.label.custom) return snapshot.label.custom;
  const stamp = snapshotTimestamp(snapshot.createdAt);
  const { firstCard } = snapshot.label;
  return firstCard ? `${stamp} ${firstCard}` : stamp;
}

/** Kartenzahl für die Infozeile, z. B. „60 cards“. */
export function snapshotCardsText(snapshot: Snapshot): string {
  const { cardCount } = snapshot.label;
  return i18n.t('snapshot.cardsCount', { count: cardCount });
}

/** Bringt ältere Snapshots auf die aktuelle Version. Wirft bei unbekanntem Format oder neuerer Version. */
export function migrateSnapshot(raw: any): Snapshot {
  if (!raw || raw.format !== SNAPSHOT_FORMAT || typeof raw.version !== 'number') {
    throw new Error('Not a valid snapshot');
  }
  if (raw.version > SNAPSHOT_VERSION) {
    throw new Error('This snapshot was saved by a newer version of the site');
  }
  // Migrationen kommen hier hinzu: if (raw.version === 1) raw = migrate_1_to_2(raw); ...
  const snapshot = raw as Snapshot;
  return {
    ...snapshot,
    search: {
      decklist: snapshot.search?.decklist ?? '',
      enabledApis: snapshot.search?.enabledApis ?? [],
      filters: {
        languages: snapshot.search?.filters?.languages ?? [],
        apis: snapshot.search?.filters?.apis ?? [],
      },
      uniquePrints: snapshot.search?.uniquePrints ?? true,
      entries: snapshot.search?.entries ?? [],
    },
    pdf: {
      ...snapshot.pdf,
      settings: { ...withoutEmail(defaultSettings), ...(snapshot.pdf?.settings ?? {}) },
    },
  };
}

function withoutEmail(settings: PdfSettings): SnapshotPdfSettings {
  const { sendMail, ...rest } = settings;
  return rest;
}

/** URLs eigener Uploads (/api/files/download/{id}), die der Snapshot braucht. */
export function customUploadIds(snapshot: Snapshot): string[] {
  const ids = new Set<string>();
  snapshot.search.entries.forEach(entry =>
    entry.results.forEach(result => {
      const match = result.apiName === CUSTOM_API && result.imageUrl.match(/\/api\/files\/download\/([^/?#]+)$/);
      if (match) ids.add(match[1]);
    })
  );
  return Array.from(ids);
}

/**
 * Macht aus einem Snapshot wieder Viewer-Zustand.
 * Einträge mit eigenen Bildern, deren Upload es nicht mehr gibt, fallen weg.
 */
export function restoreSnapshot(snapshot: Snapshot, missingUploadIds: string[] = []): { state: RestoredState; droppedCustomCards: number } {
  const missing = new Set(missingUploadIds);
  const isMissing = (result: SnapshotResult) => {
    if (result.apiName !== CUSTOM_API) return false;
    const match = result.imageUrl.match(/\/api\/files\/download\/([^/?#]+)$/);
    return !!match && missing.has(match[1]);
  };

  const cardResults: CardResultsMap = {};
  const selectedCards: SelectedCardsMap = {};
  const manualPicks: ManualPicksMap = {};
  let droppedCustomCards = 0;

  snapshot.search.entries.forEach(entry => {
    if (entry.results.some(isMissing)) {
      droppedCustomCards += entry.count;
      return;
    }
    const results: CardResult[] = entry.results.map(result => ({ ...result, cropSettings: { ...result.cropSettings } }));
    cardResults[entry.key] = { count: entry.count, results, ...(entry.connectedFrom?.length ? { connectedFrom: [...entry.connectedFrom] } : {}) };
    selectedCards[entry.key] = entry.selected.map(selection => {
      if (!selection) return null;
      let card: CardResult | undefined = results[selection.i];
      if (!card || card.imageUrl !== selection.url) {
        card = results.find(r => r.imageUrl === selection.url);
      }
      if (!card) return results[0] ?? null;
      return sameCrop(card.cropSettings, selection.crop) ? card : { ...card, cropSettings: { ...selection.crop } };
    });
    // Ältere Snapshots kennen keine manuelle Wahl: dann bleibt jede gespeicherte Auswahl wie sie war
    const manual = new Set(entry.manual ?? entry.selected.map((_, slot) => slot));
    const picks = selectedCards[entry.key].map((card, slot) => (manual.has(slot) ? card : null));
    if (picks.some(card => card)) manualPicks[entry.key] = picks;
  });

  return {
    state: {
      decklist: snapshot.search.decklist,
      cardResults,
      selectedCards,
      manualPicks,
      enabledApis: snapshot.search.enabledApis,
      visibleLanguages: new Set(snapshot.search.filters.languages),
      visibleApis: new Set(snapshot.search.filters.apis),
      uniquePrints: snapshot.search.uniquePrints,
      settings: snapshot.pdf.settings,
    },
    droppedCustomCards,
  };
}
