import { Config } from '../../../service/ApiFactory';

const STORAGE_KEY = 'setConfigs';
const SELECTED_IDS_KEY = 'selectedConfigs';

/** Lädt die sichtbaren Configs vom Backend: veröffentlichte und, angemeldet, die eigenen. */
export async function fetchVisibleConfigs(): Promise<Config[]> {
  const response = await fetch('/api/configs', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) throw new Error('Failed to fetch configs');
  return response.json();
}

/**
 * Die aktive Auswahl liegt als Kopie im localStorage. Ersetzt jede gespeicherte Config durch
 * ihre aktuelle Fassung vom Backend, damit spätere Änderungen (z.B. "Proxy Images") ankommen.
 * Configs, die das Backend nicht mehr ausliefert, bleiben (z.B. eigene nach dem Abmelden),
 * außer sie stehen in `blocked` (Quelle auf Wunsch des Betreibers gesperrt).
 * Liefert die aktualisierte Auswahl oder null, wenn keine gespeichert ist.
 */
export function refreshStoredSelection(fresh: Config[], blocked: number[] = []): Config[] | null {
  let saved: Config[];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    saved = JSON.parse(raw);
  } catch (e) {
    return null;
  }
  const byId = new Map(fresh.map(c => [c.id, c]));
  const updated = saved.filter(c => !blocked.includes(c.id)).map(c => byId.get(c.id) || c);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    if (blocked.length > 0) {
      const ids: number[] = JSON.parse(localStorage.getItem(SELECTED_IDS_KEY) || '[]');
      localStorage.setItem(SELECTED_IDS_KEY, JSON.stringify(ids.filter(id => !blocked.includes(id))));
    }
  } catch (e) { }
  return updated;
}

/** Gesperrte unter den IDs (Backend /api/configs/blocked). Bei Fehlern keine, die Auswahl bleibt dann wie sie ist. */
export async function fetchBlockedConfigIds(ids: number[]): Promise<number[]> {
  if (ids.length === 0) return [];
  try {
    const response = await fetch('/api/configs/blocked', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ids),
    });
    return response.ok ? await response.json() : [];
  } catch (e) {
    return [];
  }
}

/** refreshStoredSelection, vorher beim Backend nachfragen, ob nicht mehr ausgelieferte Configs gesperrt sind. */
export async function refreshStoredSelectionChecked(fresh: Config[]): Promise<Config[] | null> {
  let saved: Config[] = [];
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch (e) { }
  const freshIds = new Set(fresh.map(c => c.id));
  const missing = saved.map(c => c.id).filter(id => typeof id === 'number' && !freshIds.has(id));
  return refreshStoredSelection(fresh, await fetchBlockedConfigIds(missing));
}

/**
 * Meldet dem Backend, mit welchen Configs gerade gesucht wird. Das Backend löscht
 * User-Configs, die lange niemand benutzt hat. Fehler sind egal, die Suche läuft weiter.
 */
export function markConfigsUsed(configs: (Config | undefined)[]): void {
  const ids = configs.map(c => c?.id).filter((id): id is number => typeof id === 'number');
  if (ids.length === 0) return;
  fetch('/api/configs/used', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ids),
  }).catch(() => undefined);
}
