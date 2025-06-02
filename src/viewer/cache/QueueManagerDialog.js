import React, { useMemo } from "react";
import { imageLoaderService } from "../../service/cache/ImageLoaderService.js";
import { useImageLoaderQueue } from "../../service/cache/hooks/useImageLoaderQueue.js";

// Re-usable Trash Icon
function TrashIcon({ style = {} }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ ...style }}>
      <path d="M3 6h18M9 6v12m6-12v12M5 6v14a2 2 0 002 2h10a2 2 0 002-2V6" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

const cellStyle = {
  border: "1px solid #ccc",
  padding: 4,
  position: "relative",
  textAlign: "center",
  background: "#f9f9f9",
  cursor: "pointer"
};

export default function QueueManagerDialog({ open, onClose }) {
  const queue = useImageLoaderQueue();

  // APIs und Sprachen dynamisch aus der Queue extrahieren
  const apis = useMemo(() => Array.from(new Set(queue.map(e => e.cardInput?.apiName).filter(Boolean))), [queue]);
  const languages = useMemo(() => Array.from(new Set(queue.map(e => e.cardInput?.languageCode || "No Language"))), [queue]);

  if (!open) return null;

  return (
    <div className="queue-manager-dialog" style={{ background: "#fff", padding: 24, borderRadius: 8, maxWidth: 900, margin: "40px auto" }}>
      <h2>Queue Manager</h2>
      <div style={{ marginBottom: 12 }}>
        <b>API abbrechen:</b>{" "}
        {apis.map(api => (
          <button key={api} style={{ margin: 2 }} onClick={() => imageLoaderService.stopQueueForApi(api)}>
            {api}
          </button>
        ))}
      </div>
      <div style={{ marginBottom: 12 }}>
        <b>Sprache abbrechen:</b>{" "}
        {languages.map(lang => (
          <button key={lang} style={{ margin: 2 }} onClick={() => imageLoaderService.stopQueueForLanguage(lang)}>
            {lang}
          </button>
        ))}
      </div>
      <table style={{ borderCollapse: "collapse", width: "100%", marginTop: 16 }}>
        <thead>
          <tr>
            <th style={cellStyle}>API</th>
            <th style={cellStyle}>Sprache</th>
            <th style={cellStyle}>Kartenname</th>
            <th style={cellStyle}>URL</th>
            <th style={cellStyle}>Priorität</th>
            <th style={cellStyle}>Kategorie</th>
            <th style={cellStyle}>Aktion</th>
          </tr>
        </thead>
        <tbody>
          {queue.length === 0 && (
            <tr>
              <td colSpan={7} style={cellStyle}>Keine Einträge in der Queue</td>
            </tr>
          )}
          {queue.map(entry => (
            <tr key={entry.cacheKey}>
              <td style={cellStyle}>{entry.cardInput?.apiName}</td>
              <td style={cellStyle}>{entry.cardInput?.languageCode || "No Language"}</td>
              <td style={cellStyle}>{entry.cardInput?.name}</td>
              <td style={{ ...cellStyle, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {entry.url}
              </td>
              <td style={cellStyle}>{entry.priority}</td>
              <td style={cellStyle}>{entry.category}</td>
              <td style={cellStyle}>
                <button
                  title="Eintrag abbrechen"
                  onClick={() => imageLoaderService.removeFromQueueByCacheKey(entry.cacheKey)}
                  style={{ background: "none", border: "none", cursor: "pointer" }}
                >
                  <TrashIcon />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button style={{ marginTop: 16 }} onClick={onClose}>Schließen</button>
    </div>
  );
}