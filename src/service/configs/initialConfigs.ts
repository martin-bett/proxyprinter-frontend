import { Config } from '../ApiFactory';

// Gleiche Schlüssel wie im ApiConfigDialog, damit der Dialog die Auswahl übernimmt
const SELECTED_IDS_KEY = 'selectedConfigs';
const SELECTED_CONFIGS_KEY = 'setConfigs';

export const loadSavedConfigs = (): Config[] | null => {
  try {
    const saved = localStorage.getItem(SELECTED_CONFIGS_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

// Erster Besuch: alle sichtbaren Configs vom Backend holen und als ausgewählt speichern.
// Schlägt das fehl, wird nichts gespeichert und beim nächsten Besuch erneut versucht.
export const fetchAndSelectAllConfigs = async (): Promise<Config[]> => {
  const response = await fetch('/api/configs', {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch configs: ${response.status}`);
  }
  const configs: Config[] = await response.json();
  try {
    localStorage.setItem(SELECTED_IDS_KEY, JSON.stringify(configs.map(c => c.id)));
    localStorage.setItem(SELECTED_CONFIGS_KEY, JSON.stringify(configs));
  } catch {
    // Ohne localStorage gilt die Auswahl nur bis zum Neuladen
  }
  return configs;
};
