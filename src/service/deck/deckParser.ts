// Decklist-Zeilen lesen, Stufe 0 aus concepts/set-suche.md:
// Anzahl optional (auch "4x"), Arena-Form "Name (SET) 123", Marker wie *F* oder [Ramp]
// abschneiden, Kopfzeilen und Kommentare überspringen.
import { DeckEntry } from '../../api/types/types';

/** Abschnittsköpfe, die ohne Anzahl in Listen stehen und keine Karten sind. */
const SECTION_HEADERS = new Set([
  'deck', 'main', 'maindeck', 'mainboard', 'main deck', 'sideboard', 'side', 'commander', 'commanders',
  'companion', 'companions', 'maybeboard', 'maybe', 'considering', 'tokens', 'token', 'about',
  'creature', 'creatures', 'land', 'lands', 'instant', 'instants', 'sorcery', 'sorceries',
  'artifact', 'artifacts', 'enchantment', 'enchantments', 'planeswalker', 'planeswalkers', 'battle', 'battles',
  'pokemon', 'pokémon', 'trainer', 'trainers', 'energy', 'energies', 'other', 'spells',
]);

/** Liefert den Namen des Abschnitts, wenn die Zeile ein Kopf ist ("Sideboard", "Sideboard:", "Lands (36)", "// Lands"). */
export function sectionHeader(line: string): string | null {
  const text = line.trim().replace(/^\/\/\s*/, '');
  if (/^\d/.test(text)) return null;
  const m = text.match(/^([^:()]+?)\s*(?::\s*\d*|\(\d+\))?\s*$/);
  if (!m) return null;
  const name = m[1].trim();
  const hasMarker = /[:(]/.test(text) || line.trim().startsWith('//');
  if (SECTION_HEADERS.has(name.toLowerCase()) || (hasMarker && !/[,']/.test(name) && name.split(/\s+/).length <= 3)) {
    return name;
  }
  return null;
}

/** Eine Zeile lesen; null bei Leerzeilen, Kommentaren, Köpfen und Links. */
export function parseDeckLine(rawLine: string): DeckEntry | null {
  let line = rawLine.trim();
  if (!line || line.startsWith('#') || line.startsWith('//') || /:\/\//.test(line)) return null;
  if (/^total cards\b/i.test(line)) return null;
  if (sectionHeader(line)) return null;

  // Anzahl: "4", "4x", "4 x", altes PTCGO mit "* " davor
  line = line.replace(/^\*\s+/, '');
  let count = 1;
  const countMatch = line.match(/^(\d+)\s*x?\s+(.*)$/i);
  if (countMatch) {
    count = parseInt(countMatch[1], 10);
    line = countMatch[2];
  }

  // Marker am Ende: *F*, *E*, [Tag], ^Tag^ (auch mehrere)
  let previous;
  do {
    previous = line;
    line = line.replace(/\s+(\*[A-Za-z]+\*|\[[^\]]*\]|\^[^^]*\^)\s*$/, '');
  } while (line !== previous);

  // Klammer-Form: "Name (SET)", "Name (SET) 123", "Name (SET 123)"
  const setMatch = line.match(/^(.+?)\s+\(([A-Za-z0-9-]{2,8})(?:\s+([A-Za-z]{0,4}\d+[A-Za-z★]?))?\)(?:\s+([A-Za-z]{0,4}\d+[A-Za-z★]?))?$/);
  if (setMatch) {
    const number = setMatch[3] || setMatch[4];
    return {
      count,
      name: setMatch[1].trim(),
      set: setMatch[2].toUpperCase(),
      ...(number ? { number } : {}),
    };
  }

  const name = line.trim();
  return name ? { count, name } : null;
}

export function parseDecklist(text: string): DeckEntry[] {
  return text.split('\n')
    .map(parseDeckLine)
    .filter((entry): entry is DeckEntry => entry !== null);
}

/** Zeile im Arena-Format, wie sie der Parser wieder liest: "1 Name (SET) 123". */
export function formatDeckLine(entry: DeckEntry): string {
  let line = `${entry.count} ${entry.name}`;
  if (entry.set) {
    line += ` (${entry.set.toUpperCase()})`;
    if (entry.number) line += ` ${entry.number}`;
  }
  return line;
}
