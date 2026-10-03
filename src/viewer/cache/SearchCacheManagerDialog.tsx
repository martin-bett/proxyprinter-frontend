import React, { CSSProperties, useCallback, useEffect, useState } from "react";
import SearchCacheService, { SearchCacheEntryInfo } from "../../service/cache/SearchCacheService";
import { DeletableCell } from "./CacheManagerDialog";

type SearchesByApi = Record<string, Record<string, SearchCacheEntryInfo>>;

// Gleiche Optik wie im Bild-Cache-Manager
const headerStyle: CSSProperties = {
  border: "1px solid var(--border)",
  padding: 4,
  background: "var(--surface-muted)",
  textAlign: "center",
};

const rowLabelStyle: CSSProperties = {
  border: "1px solid var(--border)",
  padding: 4,
  fontWeight: "bold",
};

// Zelle mit Trefferzahl; gibt es dort Suchen, zeigt sie beim Überfahren den Papierkorb und löscht beim Klick
function SearchCell({ entries, onDelete }: { entries: SearchCacheEntryInfo[]; onDelete: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <DeletableCell
      value={entries.reduce((sum, e) => sum + e.size, 0)}
      onDelete={onDelete}
      showTrash={entries.length > 0}
      hover={hover}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    />
  );
}

interface SearchCacheManagerDialogProps {
  open: boolean;
  onClose: () => void;
  onChange?: () => void;
}

export default function SearchCacheManagerDialog({ open, onClose, onChange }: SearchCacheManagerDialogProps) {
  const [searches, setSearches] = useState<SearchesByApi>({});

  const reload = useCallback(async () => {
    setSearches(await SearchCacheService.getAllSearches());
  }, []);

  // Lädt alle Suchen beim Öffnen
  useEffect(() => {
    if (open) reload();
  }, [open, reload]);

  // Führt eine Löschaktion aus und lädt neu
  const remove = (action: () => Promise<void>) => async () => {
    await action();
    await reload();
    onChange?.();
  };

  if (!open) return null;

  const apiKeys = Object.keys(searches).sort();
  const cardNames = Array.from(new Set(apiKeys.flatMap(api => Object.keys(searches[api] || {})))).sort();
  const entriesForApi = (apiKey: string) => Object.values(searches[apiKey] || {});
  const entriesForCard = (cardName: string) => apiKeys.flatMap(api => searches[api]?.[cardName] ?? []);
  const allEntries = apiKeys.flatMap(entriesForApi);

  return (
    <div className="cache-manager-dialog search-cache-manager-dialog">
      <h2>Search Cache Manager</h2>
      <div>Gespeicherte Suchen: {allEntries.length}</div>
      <div>Die Zahlen sind gefundene Treffer; Klick auf eine Zelle löscht die Suchen dahinter.</div>
      <table style={{ borderCollapse: "collapse", width: "100%", marginTop: 16 }}>
        <thead>
          <tr>
            <th style={headerStyle}></th>
            {apiKeys.map(apiKey => (
              <th key={apiKey} style={headerStyle}>{apiKey}</th>
            ))}
            <th style={headerStyle}>Alle der Karte</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ ...rowLabelStyle, background: "var(--surface-muted)" }}>API gesamt</td>
            {apiKeys.map(apiKey => (
              <SearchCell
                key={apiKey}
                entries={entriesForApi(apiKey)}
                onDelete={remove(() => SearchCacheService.removeSearchesForApi(apiKey))}
              />
            ))}
            <SearchCell entries={allEntries} onDelete={remove(() => SearchCacheService.removeAllSearches())} />
          </tr>
          {cardNames.length === 0 && (
            <tr>
              <td colSpan={apiKeys.length + 2} style={{ textAlign: "center", padding: 8 }}>
                Keine gespeicherten Suchen
              </td>
            </tr>
          )}
          {cardNames.map(cardName => (
            <tr key={cardName}>
              <td style={rowLabelStyle}>{cardName}</td>
              {apiKeys.map(apiKey => (
                <SearchCell
                  key={apiKey}
                  entries={searches[apiKey]?.[cardName] ? [searches[apiKey][cardName]] : []}
                  onDelete={remove(() => SearchCacheService.removeSearch(apiKey, cardName))}
                />
              ))}
              <SearchCell
                entries={entriesForCard(cardName)}
                onDelete={remove(() => SearchCacheService.removeSearchesForCard(cardName))}
              />
            </tr>
          ))}
        </tbody>
      </table>
      <button style={{ marginTop: 16 }} onClick={onClose}>Schließen</button>
    </div>
  );
}
