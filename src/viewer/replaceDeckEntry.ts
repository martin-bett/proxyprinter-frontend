import { CardResultsMap } from '../api/types/types';

/**
 * Ersetzt einen Eintrag im Deck durch neue Einträge an derselben Stelle.
 * Die neuen Einträge übernehmen die Anzahl des alten. Steht ein neuer Name schon
 * anderswo im Deck, wandert er an die ersetzte Stelle und die Anzahlen werden addiert.
 */
export function replaceDeckEntry(deck: CardResultsMap, oldKey: string, replacement: CardResultsMap): CardResultsMap {
  if (!deck[oldKey]) return { ...deck, ...replacement };
  const count = deck[oldKey].count;
  const result: CardResultsMap = {};
  Object.entries(deck).forEach(([key, group]) => {
    if (key === oldKey) {
      Object.entries(replacement).forEach(([newKey, newGroup]) => {
        const existing = newKey !== oldKey ? deck[newKey] : undefined;
        result[newKey] = { ...newGroup, count: count + (existing?.count ?? 0) };
      });
    } else if (!(key in replacement)) {
      result[key] = group;
    }
  });
  return result;
}
