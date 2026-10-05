import { SearchResult } from '../service/ApiFactory';

const normalize = (name: string) => name.trim().toLowerCase();

/** Eine verbundene Karte (z.B. Treasure), gesammelt über alle Deckkarten und APIs. */
export interface ConnectedCandidate {
  name: string;
  typeLine?: string;
  // Deckkarten, die diese Karte brauchen
  parents: string[];
  // Pro API der erste Link auf das exakte Objekt
  links: { apiKey: string; link: string }[];
}

/**
 * Sammelt die verbundenen Karten aller Treffer ein. Gleichnamige werden zusammengefasst,
 * Namen, die schon als Eintrag existieren (Deckliste, Kartenseiten), fallen weg.
 * apiResults: apiKey -> Kartenname -> Treffer.
 */
export function collectConnectedCards(
  apiResults: Record<string, Record<string, SearchResult[]>>,
  takenNames: string[]
): ConnectedCandidate[] {
  const taken = new Set(takenNames.map(normalize));
  const byName = new Map<string, ConnectedCandidate>();

  Object.entries(apiResults).forEach(([apiKey, resultsByCard]) => {
    Object.entries(resultsByCard).forEach(([cardName, results]) => {
      results.forEach(result => {
        (result.connectedCards || []).forEach(connected => {
          const key = normalize(connected.name);
          if (!key || taken.has(key)) return;
          let candidate = byName.get(key);
          if (!candidate) {
            candidate = { name: connected.name.trim(), typeLine: connected.typeLine, parents: [], links: [] };
            byName.set(key, candidate);
          }
          if (!candidate.typeLine && connected.typeLine) candidate.typeLine = connected.typeLine;
          if (!candidate.parents.includes(cardName)) candidate.parents.push(cardName);
          if (connected.link && !candidate.links.some(link => link.apiKey === apiKey)) {
            candidate.links.push({ apiKey, link: connected.link });
          }
        });
      });
    });
  });

  return Array.from(byName.values());
}

/** Treffer ohne doppelte Bilder (gleiche API + gleiche Bild-URL), Reihenfolge bleibt. */
export function dedupeResults<T extends SearchResult>(results: T[]): T[] {
  const seen = new Set<string>();
  return results.filter(result => {
    const key = `${result.apiName}|${result.imageUrl}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
