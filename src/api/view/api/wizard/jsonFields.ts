// Hilfen für JSON-Antworten im API-Wizard: Pfade wie ApiFactory sie liest
// ("data", "image_uris.png"), Listen finden und Felder vorschlagen.

export type FieldRole = 'dataListField' | 'nameField' | 'imageUrlField' | 'languageField' | 'setField' | 'setNumberField';

export type FieldAssignment = Partial<Record<FieldRole, string>>;

export type JsonPath = (string | number)[];

export function pathToString(path: JsonPath): string {
  return path.map(String).join('.');
}

export function getAt(root: unknown, path: JsonPath): unknown {
  return path.reduce<any>((o, key) => (o == null ? undefined : o[key as any]), root);
}

function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

export interface ListCandidate {
  path: string;
  length: number;
}

/** Alle Arrays mit Objekten darin, größte zuerst. Root-Array hat den Pfad "". */
export function findObjectLists(root: unknown, maxDepth = 6): ListCandidate[] {
  const found: ListCandidate[] = [];
  const walk = (value: unknown, path: JsonPath, depth: number) => {
    if (depth > maxDepth) return;
    if (Array.isArray(value)) {
      if (value.some(isObject)) found.push({ path: pathToString(path), length: value.length });
      // nur in das erste Element schauen, sonst explodiert das bei großen Listen
      if (value.length > 0) walk(value[0], [...path, 0], depth + 1);
    } else if (isObject(value)) {
      Object.entries(value).forEach(([k, v]) => walk(v, [...path, k], depth + 1));
    }
  };
  walk(root, [], 0);
  // Listen innerhalb eines Listenelements (z.B. data.0.card_faces) sind keine Trefferlisten
  return found
    .filter(c => !/(^|\.)\d+(\.|$)/.test(c.path))
    .sort((a, b) => b.length - a.length);
}

/** Die Liste, aus der ApiFactory die Treffer liest (leerer Pfad = Root-Array). */
export function getList(root: unknown, listPath: string | undefined): unknown[] {
  const value = listPath ? getAt(root, listPath.split('.')) : root;
  return Array.isArray(value) ? value : [];
}

interface Leaf {
  path: string;
  key: string;
  value: string | number | boolean;
  depth: number;
}

/** Einfache Werte eines Listenelements mit relativem Pfad. */
export function leaves(item: unknown, maxDepth = 4): Leaf[] {
  const out: Leaf[] = [];
  const walk = (value: unknown, path: JsonPath, depth: number) => {
    if (depth > maxDepth) return;
    if (Array.isArray(value)) {
      if (value.length > 0) walk(value[0], [...path, 0], depth + 1);
    } else if (isObject(value)) {
      Object.entries(value).forEach(([k, v]) => walk(v, [...path, k], depth + 1));
    } else if (value !== null && value !== undefined && path.length > 0) {
      out.push({
        path: pathToString(path),
        key: String(path[path.length - 1]),
        value: value as string | number | boolean,
        depth,
      });
    }
  };
  walk(item, [], 0);
  return out;
}

const IMAGE_URL = /^(https?:)?\/\/\S+\.(png|jpe?g|webp|avif|gif)(\?\S*)?$/i;
const HTTP_URL = /^(https?:)?\/\/\S+$/i;

export function looksLikeImageUrl(value: unknown): boolean {
  return typeof value === 'string' && IMAGE_URL.test(value.trim());
}

function imageScore(leaf: Leaf): number {
  if (typeof leaf.value !== 'string') return -Infinity;
  const v = leaf.value.trim();
  const p = leaf.path.toLowerCase();
  let score: number;
  if (IMAGE_URL.test(v)) score = 10;
  else if (HTTP_URL.test(v) && /(image|img|picture|art|scan)/.test(p)) score = 6;
  else return -Infinity;
  if (/png/.test(p) || /\.png(\?|$)/i.test(v)) score += 3;
  if (/(large|full|high|hires|original)/.test(p)) score += 2;
  if (/normal|medium/.test(p)) score += 1;
  if (/(small|thumb|tiny|icon|preview|crop|art_crop|symbol|logo)/.test(p)) score -= 4;
  // Pfade durch Unterlisten (z.B. card_faces.0) nur notfalls
  if (/(^|\.)\d+(\.|$)/.test(leaf.path)) score -= 3;
  return score - leaf.depth * 0.1;
}

const NAME_KEYS = ['name', 'card_name', 'cardname', 'title', 'search_card_name'];
const LANGUAGE_KEYS = ['lang', 'language', 'locale', 'language_code', 'lang_code'];
const SET_KEYS = ['set', 'set_code', 'setcode', 'edition', 'set_name', 'setname', 'expansion'];
const SET_NUMBER_KEYS = ['collector_number', 'number', 'card_number', 'collectornumber', 'set_number'];

function byKey(list: Leaf[], keys: string[]): Leaf | undefined {
  for (const key of keys) {
    const hit = list
      .filter(l => l.key.toLowerCase() === key && !/(^|\.)\d+(\.|$)/.test(l.path))
      .sort((a, b) => a.depth - b.depth)[0];
    if (hit) return hit;
  }
  return undefined;
}

/**
 * Vorschlag für Liste und Felder. Bevorzugt die Liste, in der der gesuchte Name
 * vorkommt; Name = Feld mit genau diesem Namen, Bild = beste Bild-URL.
 */
export function guessJsonFields(root: unknown, searchName: string): FieldAssignment {
  const name = searchName.trim().toLowerCase();
  const lists = findObjectLists(root);
  if (lists.length === 0) return {};

  const containsName = (item: unknown) =>
    leaves(item).some(l => typeof l.value === 'string' && l.value.toLowerCase().includes(name));
  const list =
    lists.find(c => name && getList(root, c.path).slice(0, 20).some(containsName)) || lists[0];
  const items = getList(root, list.path).filter(isObject);
  const item = (name && items.find(containsName)) || items[0];
  if (!item) return { dataListField: list.path };

  const all = leaves(item);
  const result: FieldAssignment = { dataListField: list.path };

  const exactName = all
    .filter(l => typeof l.value === 'string' && l.value.trim().toLowerCase() === name)
    .sort((a, b) => (NAME_KEYS.includes(b.key.toLowerCase()) ? 1 : 0) - (NAME_KEYS.includes(a.key.toLowerCase()) ? 1 : 0) || a.depth - b.depth)[0];
  const nameLeaf = exactName || byKey(all, NAME_KEYS);
  if (nameLeaf) result.nameField = nameLeaf.path;

  const image = all
    .map(l => ({ l, s: imageScore(l) }))
    .filter(x => x.s > -Infinity)
    .sort((a, b) => b.s - a.s)[0];
  if (image) result.imageUrlField = image.l.path;

  const lang = byKey(all, LANGUAGE_KEYS);
  if (lang && typeof lang.value === 'string' && lang.value.length <= 20) result.languageField = lang.path;
  const set = byKey(all, SET_KEYS);
  if (set) result.setField = set.path;
  const setNumber = byKey(all, SET_NUMBER_KEYS);
  if (setNumber) result.setNumberField = setNumber.path;
  return result;
}

/**
 * Klick auf einen Knoten im Baum → Pfad für die gewählte Rolle.
 * Für die Liste der Pfad zum Array, für Felder der Pfad relativ zum Listenelement.
 */
export function pathForRole(
  root: unknown,
  clicked: JsonPath,
  role: FieldRole,
  listPath: string | undefined,
): { path: string } | { error: string } {
  if (role === 'dataListField') {
    // Klick auf ein Array oder auf ein Element davon
    for (let i = clicked.length; i >= 0; i--) {
      const sub = clicked.slice(0, i);
      if (Array.isArray(getAt(root, sub))) return { path: pathToString(sub) };
    }
    return { error: 'Click on a list (an array of entries).' };
  }
  if (listPath === undefined) return { error: 'Choose the result list first.' };
  const prefix = listPath ? listPath.split('.') : [];
  const head = clicked.slice(0, prefix.length).map(String);
  if (head.join('.') !== prefix.join('.') || clicked.length < prefix.length + 2 || typeof clicked[prefix.length] !== 'number') {
    return { error: 'Click on a value inside one entry of the result list.' };
  }
  return { path: pathToString(clicked.slice(prefix.length + 1)) };
}

/** Welche Rolle(n) ein Knoten im Baum hat, für die Markierung. */
export function rolesAt(path: JsonPath, fields: FieldAssignment): FieldRole[] {
  const roles: FieldRole[] = [];
  const list = fields.dataListField;
  if (list === undefined) return roles;
  const prefix = list ? list.split('.') : [];
  const full = path.map(String);
  if (full.join('.') === prefix.join('.')) roles.push('dataListField');
  if (full.length > prefix.length + 1 && full.slice(0, prefix.length).join('.') === prefix.join('.') && typeof path[prefix.length] === 'number') {
    const rel = full.slice(prefix.length + 1).join('.');
    (Object.keys(fields) as FieldRole[]).forEach(role => {
      if (role !== 'dataListField' && fields[role] === rel) roles.push(role);
    });
  }
  return roles;
}

/** Link zur nächsten Seite auf oberster Ebene (z.B. Scryfall next_page). */
export function guessPaginationLink(root: unknown): string | undefined {
  if (!isObject(root)) return undefined;
  return Object.keys(root).find(
    k => /^next(_page|page|_url|url|_link|link)?$/i.test(k) && typeof root[k] === 'string' && HTTP_URL.test(String(root[k])),
  );
}
