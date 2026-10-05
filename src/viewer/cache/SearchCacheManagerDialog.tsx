import React, { useCallback, useEffect, useState } from "react";
import CloseIcon from "@mui/icons-material/Close";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import ActionButton from "../../container/inputs/ActionButton";
import SearchCacheService, { SearchCacheEntryInfo } from "../../service/cache/SearchCacheService";
import { DeletableCell } from "./CacheManagerDialog";
import "./CacheManagerDialog.css";

type SearchesByApi = Record<string, Record<string, SearchCacheEntryInfo>>;

// Zelle mit Trefferzahl; gibt es dort Suchen, färbt sie sich beim Überfahren rot und löscht beim Klick
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
      <h2>Such-Cache</h2>
      <div className="cache-manager-head">
        <div className="cache-manager-usage">
          <span>{allEntries.length} gespeicherte Suchen</span>
        </div>
        <ActionButton
          icon={<DeleteSweepIcon />}
          className="is-danger cache-manager-clear"
          onClick={remove(() => SearchCacheService.removeAllSearches())}
          disabled={allEntries.length === 0}
        >
          Alle Suchen löschen
        </ActionButton>
      </div>
      <p className="cache-manager-hint">Die Zahlen sind gefundene Treffer. Klick auf eine Zelle löscht die Suchen dahinter, die rote Markierung zeigt was gelöscht wird.</p>
      <table className="cache-table">
        <thead>
          <tr>
            <th></th>
            {apiKeys.map(apiKey => (
              <th key={apiKey}>{apiKey}</th>
            ))}
            <th>Alle der Karte</th>
          </tr>
        </thead>
        <tbody>
          <tr className="cache-sum-row">
            <th className="cache-row-label">API gesamt</th>
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
              <td colSpan={apiKeys.length + 2} className="cache-cell is-empty">
                Keine gespeicherten Suchen
              </td>
            </tr>
          )}
          {cardNames.map(cardName => (
            <tr key={cardName}>
              <th className="cache-row-label">{cardName}</th>
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
      <div className="cache-manager-footer">
        <ActionButton icon={<CloseIcon />} onClick={onClose}>Schließen</ActionButton>
      </div>
    </div>
  );
}
