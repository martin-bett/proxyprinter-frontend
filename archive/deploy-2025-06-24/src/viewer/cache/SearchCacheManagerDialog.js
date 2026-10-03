import React, { useEffect, useState } from "react";
import SearchCacheService from "../../service/cache/SearchCacheService";

export default function SearchCacheManagerDialog({ open, onClose }) {
  const [searches, setSearches] = useState({});
  const [apiKeys, setApiKeys] = useState([]);
  const [cardNames, setCardNames] = useState([]);

  // Lädt alle Suchen beim Öffnen oder nach Änderung
  useEffect(() => {
    if (open) {
      SearchCacheService.getAllSearches().then(data => {
        setSearches(data);
        // Extrahiere alle apiKeys und cardNames
        const apis = Object.keys(data).sort();
        const cards = Array.from(
          new Set(
            apis.flatMap(api => Object.keys(data[api] || {}))
          )
        ).sort();
        setApiKeys(apis);
        setCardNames(cards);
      });
    }
  }, [open]);

  // Löscht eine Suche und lädt neu
  const handleRemove = async (apiKey, cardName) => {
    await SearchCacheService.removeSearch(apiKey, cardName);
    const data = await SearchCacheService.getAllSearches();
    setSearches(data);
    // Aktualisiere apiKeys und cardNames
    const apis = Object.keys(data).sort();
    const cards = Array.from(
      new Set(
        apis.flatMap(api => Object.keys(data[api] || {}))
      )
    ).sort();
    setApiKeys(apis);
    setCardNames(cards);
  };

  if (!open) return null;

  return (
    <div className="cache-manager-dialog" style={{ maxWidth: 800, margin: "0 auto" }}>
      <h2>Search Cache Manager</h2>
      <table style={{ borderCollapse: "collapse", width: "100%", marginTop: 16 }}>
        <thead>
          <tr>
            <th style={{ border: "1px solid #ccc", padding: 4, background: "#f3eaff" }}>Card Name</th>
            {apiKeys.map(apiKey => (
              <th key={apiKey} style={{ border: "1px solid #ccc", padding: 4, background: "#f3eaff" }}>
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
              <td style={{ border: "1px solid #ccc", padding: 4, fontWeight: 600 }}>{cardName}</td>
              {apiKeys.map(apiKey => {
                const entry = searches[apiKey]?.[cardName];
                return (
                  <td
                    key={apiKey}
                    style={{
                      border: "1px solid #ccc",
                      padding: 4,
                      textAlign: "center",
                      cursor: entry ? "pointer" : "default",
                      background: entry ? "#e5d6fa" : "#fafafa",
                      color: entry ? "#5a3577" : "#bbb",
                      fontWeight: entry ? 600 : 400,
                      userSelect: "none"
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