import React, { CSSProperties, useCallback, useEffect, useState } from "react";
import SearchCacheService, { SearchCacheEntryInfo } from "../../service/cache/SearchCacheService";

type SearchesByApi = Record<string, Record<string, SearchCacheEntryInfo>>;

const cellStyle: CSSProperties = {
  border: "1px solid var(--border)",
  padding: 4,
};

const headerStyle: CSSProperties = {
  ...cellStyle,
  background: "var(--surface-muted)",
};

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

  // Löscht eine Suche und lädt neu
  const handleRemove = async (apiKey: string, cardName: string) => {
    await SearchCacheService.removeSearch(apiKey, cardName);
    await reload();
    onChange?.();
  };

  if (!open) return null;

  const apiKeys = Object.keys(searches).sort();
  const cardNames = Array.from(new Set(apiKeys.flatMap(api => Object.keys(searches[api] || {})))).sort();

  return (
    <div className="search-cache-manager-dialog" style={{ maxWidth: 800, margin: "0 auto", color: "var(--text)" }}>
      <h2>Search Cache Manager</h2>
      <table style={{ borderCollapse: "collapse", width: "100%", marginTop: 16 }}>
        <thead>
          <tr>
            <th style={headerStyle}>Card Name</th>
            {apiKeys.map(apiKey => (
              <th key={apiKey} style={headerStyle}>
                {apiKey}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cardNames.length === 0 && (
            <tr>
              <td colSpan={apiKeys.length + 1} style={{ textAlign: "center", padding: 8 }}>
                Keine gespeicherten Suchen
              </td>
            </tr>
          )}
          {cardNames.map(cardName => (
            <tr key={cardName}>
              <td style={{ ...cellStyle, fontWeight: 600 }}>{cardName}</td>
              {apiKeys.map(apiKey => {
                const entry = searches[apiKey]?.[cardName];
                return (
                  <td
                    key={apiKey}
                    style={{
                      ...cellStyle,
                      textAlign: "center",
                      cursor: entry ? "pointer" : "default",
                      background: entry ? "var(--accent-soft)" : "var(--surface-muted)",
                      color: entry ? "var(--text)" : "var(--text-muted)",
                      fontWeight: entry ? 600 : 400,
                      userSelect: "none",
                    }}
                    title={entry ? "Klick zum Löschen" : ""}
                    onClick={() => entry && handleRemove(apiKey, cardName)}
                  >
                    {entry ? entry.size : ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <button style={{ marginTop: 16 }} onClick={onClose}>Schließen</button>
    </div>
  );
}
