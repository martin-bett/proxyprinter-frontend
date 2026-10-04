import FingerprintJS from '@fingerprintjs/fingerprintjs';
import { Config } from '../../../service/ApiFactory';

const STORAGE_KEY = 'setConfigs';

/** Lädt alle für diesen Browser sichtbaren Configs vom Backend. */
export async function fetchVisibleConfigs(): Promise<Config[]> {
  const fp = await (await FingerprintJS.load()).get();
  const response = await fetch('/api/configs', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', 'X-Fingerprint': fp.visitorId },
  });
  if (!response.ok) throw new Error('Failed to fetch configs');
  return response.json();
}

/**
 * Die aktive Auswahl liegt als Kopie im localStorage. Ersetzt jede gespeicherte Config durch
 * ihre aktuelle Fassung vom Backend, damit spätere Änderungen (z.B. "Proxy Images") ankommen.
 * Liefert die aktualisierte Auswahl oder null, wenn keine gespeichert ist.
 */
export function refreshStoredSelection(fresh: Config[]): Config[] | null {
  let saved: Config[];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    saved = JSON.parse(raw);
  } catch (e) {
    return null;
  }
  const byId = new Map(fresh.map(c => [c.id, c]));
  const updated = saved.map(c => byId.get(c.id) || c);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) { }
  return updated;
}
