// Filter-Priorität: die Reihenfolge der Filtereinträge legt fest, welches Bild automatisch
// gewählt wird (oben gewinnt, die weiteren angehakten Einträge sind der Fallback).
// Eine manuell gewählte Karte geht vor: passt sie nicht zum Filter, greift die Priorität,
// passt sie wieder, kommt sie zurück.

import { CardResult, CardResultsMap, SelectedCardsMap } from '../api/types/types';
import { printMatchScore, WantedPrint } from '../service/deck/setCatalog';

/** Manuell gewählte Bilder je Karte und Platz, parallel zu SelectedCardsMap. */
export type ManualPicksMap = Record<string, (CardResult | null)[]>;

/** Werte in gespeicherter Reihenfolge, neue Werte hinten in ihrer bisherigen Reihenfolge. */
export const applyOrder = (order: string[], available: Iterable<string>): string[] => {
  const availableList = Array.from(new Set(available));
  const present = new Set(availableList);
  const known = new Set(order);
  return [
    ...order.filter(value => present.has(value)),
    ...availableList.filter(value => !known.has(value)),
  ];
};

/**
 * Übernimmt die neue Reihenfolge der gerade sichtbaren Werte in die gespeicherte.
 * Werte, die gerade nicht vorkommen, behalten ihren Platz (z. B. bleibt Chinesisch oben,
 * auch wenn die aktuelle Suche keine chinesischen Karten hat).
 */
export const mergeOrder = (stored: string[], reordered: string[]): string[] => {
  const moved = new Set(reordered);
  const queue = [...reordered];
  const merged = stored.map(value => (moved.has(value) ? queue.shift()! : value));
  return [...merged, ...queue];
};

/** Verschiebt einen Eintrag an einen neuen Index. */
export const moveItem = <T,>(items: T[], from: number, to: number): T[] => {
  if (from === to || from < 0 || from >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, item);
  return next;
};

const rankIn = (order: string[]) => {
  const ranks = new Map(order.map((value, index) => [value, index]));
  return (value: string) => ranks.get(value) ?? order.length;
};

/**
 * Ergebnisse nach Priorität: erst Sprache, dann API (so wie die Filtergruppen untereinander stehen),
 * bei Gleichstand bleibt die Reihenfolge der Suche.
 */
export const sortByPriority = (
  results: CardResult[],
  languageOrder: string[],
  apiOrder: string[],
  languageOf: (card: CardResult) => string,
): CardResult[] => {
  const languageRank = rankIn(languageOrder);
  const apiRank = rankIn(apiOrder);
  return results
    .map((card, index) => ({ card, index }))
    .sort((a, b) =>
      languageRank(languageOf(a.card)) - languageRank(languageOf(b.card)) ||
      apiRank(a.card.apiName) - apiRank(b.card.apiName) ||
      a.index - b.index
    )
    .map(entry => entry.card);
};

/**
 * Wahl für einen Platz: die manuelle Wahl, wenn sie zum Filter passt, sonst das beste sichtbare Bild.
 * Ist das schon gewählt, bleibt das bisherige Objekt (es kann eigene Crops tragen).
 */
export const pickForSlot = (
  prioritized: CardResult[],
  current: CardResult | null | undefined,
  manual: CardResult | null | undefined,
  manualFits = !!manual && prioritized.some(card => card.imageUrl === manual.imageUrl),
): CardResult | null => {
  if (manual && manualFits) {
    return current?.imageUrl === manual.imageUrl ? current : manual;
  }
  if (prioritized.length === 0) return null;
  const best = prioritized[0];
  return current?.imageUrl === best.imageUrl ? current : best;
};

/** Der Druck aus der Decklist (Set und Nummer, dann nur Set) kommt vor die Filter-Priorität. */
const preferWanted = (prioritized: CardResult[], wanted: WantedPrint): CardResult[] =>
  prioritized
    .map((card, index) => ({ card, index, score: printMatchScore(card, wanted) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(entry => entry.card);

export interface PriorityInput {
  cardResults: CardResultsMap;
  manualPicks: ManualPicksMap;
  isVisible: (card: CardResult) => boolean;
  languageOrder: string[];
  apiOrder: string[];
  languageOf: (card: CardResult) => string;
  /**
   * Gerade erst gewählt: die manuelle Wahl bleibt, auch wenn der Filter sie nicht zeigt
   * (im Dialog kann man über die Filter der Hauptseite hinaus wählen). Gilt bis zur nächsten Filteränderung.
   */
  isFreshPick?: (cardName: string, index: number) => boolean;
}

/** Berechnet die Auswahl aller Karten neu. Liefert prev zurück, wenn sich nichts ändert. */
export const computeSelection = (prev: SelectedCardsMap, input: PriorityInput): SelectedCardsMap => {
  const { cardResults, manualPicks, isVisible, languageOrder, apiOrder, languageOf, isFreshPick } = input;
  const next: SelectedCardsMap = { ...prev };
  let changed = false;

  Object.entries(cardResults).forEach(([cardName, cardData]) => {
    const prioritized = sortByPriority(cardData.results.filter(isVisible), languageOrder, apiOrder, languageOf);
    const slots = Array.from({ length: cardData.count }).map((_, index) => {
      const wanted = cardData.wanted?.[index];
      const forSlot = wanted ? preferWanted(prioritized, wanted) : prioritized;
      const manual = manualPicks[cardName]?.[index];
      const manualFits = !!manual && (isFreshPick?.(cardName, index)
        ? cardData.results.some(card => card.imageUrl === manual.imageUrl)
        : prioritized.some(card => card.imageUrl === manual.imageUrl));
      return pickForSlot(forSlot, prev[cardName]?.[index], manual, manualFits);
    });
    if (slots.every(card => card === null)) {
      if (cardName in prev) {
        delete next[cardName];
        changed = true;
      }
      return;
    }
    const before = prev[cardName];
    if (!before || before.length !== slots.length || slots.some((card, index) => card !== before[index])) {
      next[cardName] = slots;
      changed = true;
    }
  });

  return changed ? next : prev;
};

/**
 * Rang (1 = bevorzugt) eines angehakten Eintrags unter den angehakten Einträgen.
 * Ohne Rang, wenn der Eintrag aus ist oder nur einer an ist (dann gibt es nichts abzuwägen).
 */
export const priorityRank = (order: string[], visible: Set<string>, value: string): number | undefined => {
  if (!visible.has(value)) return undefined;
  const checked = order.filter(entry => visible.has(entry));
  return checked.length > 1 ? checked.indexOf(value) + 1 : undefined;
};
