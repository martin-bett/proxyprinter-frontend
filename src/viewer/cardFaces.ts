import { CardResultsMap } from '../api/types/types';

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Mehrseitige Karten: Treffer anderer Seiten (z.B. die Rückseite von "Delver of Secrets")
 * werden zu einem eigenen Eintrag mit gleicher Anzahl, damit beide Seiten gedruckt werden.
 * Getrennt wird nur, wenn der gesuchte Name einer Seite entspricht. Steht die andere Seite
 * schon selbst in der Liste, bleibt sie dort und wird hier nicht noch einmal angelegt.
 */
export function splitCardFaces(results: CardResultsMap, reservedNames: string[] = []): CardResultsMap {
  const taken = [...Object.keys(results), ...reservedNames];
  const split: CardResultsMap = {};

  Object.entries(results).forEach(([cardName, group]) => {
    const matchesSearchedFace = group.results.some(result => result.faceName && sameName(result.faceName, cardName));
    if (!matchesSearchedFace) {
      split[cardName] = group;
      return;
    }

    const own = group.results.filter(result => !result.faceName || sameName(result.faceName, cardName));
    split[cardName] = { ...group, results: own };

    group.results
      .filter(result => result.faceName && !sameName(result.faceName, cardName))
      .forEach(result => {
        const faceName = result.faceName!;
        if (taken.some(name => sameName(name, faceName))) {
          return;
        }
        const existing = split[faceName];
        split[faceName] = existing ?
          { ...existing, results: [...existing.results, result] } :
          { count: group.count, results: [result], ...(group.wanted ? { wanted: group.wanted } : {}) };
      });
  });

  return split;
}
