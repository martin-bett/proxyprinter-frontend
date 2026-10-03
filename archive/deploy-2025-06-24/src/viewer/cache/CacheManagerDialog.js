import React, { useState } from "react";
import { imageLoaderService } from "../../service/cache/ImageLoaderService.js";
import { useImageLoaderCache } from "../../service/cache/hooks/useImageLoaderCache.js";
import { CacheProgressBar } from "./CacheProgressBar.js";
import "./CacheManagerDialog.css";

// Wiederverwendbares Papierkorb-Icon
function TrashIcon({ style = {} }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ ...style }}>
      <path d="M3 6h18M9 6v12m6-12v12M5 6v14a2 2 0 002 2h10a2 2 0 002-2V6" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// CSS für das Overlay
const cellStyle = {
  border: "1px solid #ccc",
  padding: 4,
  position: "relative",
  textAlign: "center",
  background: "#f9f9f9",
  cursor: "pointer"
};
const trashOverlayStyle = {
  position: "absolute",
  top: 2,
  right: 2,
  opacity: 0.7,
  display: "none",
  pointerEvents: "none"
};
const cellHoverStyle = {
  ...cellStyle,
  background: "#ffeaea"
};

function DeletableCell({ value, mbValue, showTrash, onDelete, hover, onMouseEnter, onMouseLeave }) {
  return (
    <td
      style={showTrash ? (hover ? cellHoverStyle : cellStyle) : { ...cellStyle, cursor: "default", background: "#fafafa" }}
      onClick={showTrash ? onDelete : undefined}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      title={showTrash ? "Cache löschen" : ""}
    >
      {mbValue !== undefined ? (
        <>
          {mbValue}
          {showTrash && hover && (
            <span style={{ marginLeft: 6, verticalAlign: "middle" }}>
              <TrashIcon />
            </span>
          )}
        </>
      ) : (
        <>
          {value}
          {showTrash && hover && (
            <span style={{ marginLeft: 6, verticalAlign: "middle" }}>
              <TrashIcon />
            </span>
          )}
        </>
      )}
    </td>
  );
}

// Zeilen-Komponente für API-Gesamtsummen
function ApiSumRow({ allApis, byApi, toMB }) {
  return (
    <tr>
      <td style={{ border: "1px solid #ccc", padding: 4, fontWeight: "bold", background: "#f8f8f8" }}>API gesamt</td>
      {allApis.map(api => (
        <DeletableApiSumCells key={api} api={api} entries={byApi[api] || []} toMB={toMB} />
      ))}
      <td style={{ border: "1px solid #ccc", padding: 4, background: "#f8f8f8" }}></td>
      <td style={{ border: "1px solid #ccc", padding: 4, background: "#f8f8f8" }}></td>
    </tr>
  );
}

function DeletableApiSumCells({ api, entries, toMB }) {
  const [hover, setHover] = useState(false);
  const size = entries.reduce((sum, e) => sum + (e.sizeBytes || 0), 0);
  return (
    <>
      <DeletableCell
        value={entries.length}
        onDelete={() => imageLoaderService.clearCacheForApiName(api)}
        showTrash={entries.length > 0}
        hover={hover}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      />
      <DeletableCell
        mbValue={toMB(size)}
        onDelete={() => imageLoaderService.clearCacheForApiName(api)}
        showTrash={entries.length > 0}
        hover={hover}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      />
    </>
  );
}

// Zeilen-Komponente für Karten-Zeilen
function CardRow({ cardName, allApis, byCard, toMB }) {
  const entries = byCard[cardName] || [];
  return (
    <tr>
      <td style={{ border: "1px solid #ccc", padding: 4, fontWeight: "bold" }}>{cardName}</td>
      {allApis.map(api => (
        <DeletableCardCells
          key={api}
          api={api}
          cardName={cardName}
          entries={entries.filter(e => e.cardInput?.apiName === api)}
          toMB={toMB}
        />
      ))}
      <DeletableSummaryCells
        cardName={cardName}
        entries={entries}
        toMB={toMB}
      />
    </tr>
  );
}

function DeletableCardCells({ api, cardName, entries, toMB }) {
  const [hover, setHover] = useState(false);
  const size = entries.reduce((sum, e) => sum + (e.sizeBytes || 0), 0);
  return (
    <>
      <DeletableCell
        value={entries.length}
        onDelete={() => imageLoaderService.clearCacheForApiAndCard(api, cardName)}
        showTrash={entries.length > 0}
        hover={hover}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      />
      <DeletableCell
        mbValue={toMB(size)}
        onDelete={() => imageLoaderService.clearCacheForApiAndCard(api, cardName)}
        showTrash={entries.length > 0}
        hover={hover}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      />
    </>
  );
}

function DeletableSummaryCells({ cardName, entries, toMB }) {
  const [hover, setHover] = useState(false);
  const size = entries.reduce((sum, e) => sum + (e.sizeBytes || 0), 0);
  return (
    <>
      <DeletableCell
        value={entries.length}
        onDelete={() => imageLoaderService.clearCacheForCardName(cardName)}
        showTrash={entries.length > 0}
        hover={hover}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      />
      <DeletableCell
        mbValue={toMB(size)}
        onDelete={() => imageLoaderService.clearCacheForCardName(cardName)}
        showTrash={entries.length > 0}
        hover={hover}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      />
    </>
  );
}

export default function CacheManagerDialog({ open, onClose }) {
  const { byApi, byCard, totalSize } = useImageLoaderCache();
  const [limitMB, setLimitMB] = useState(imageLoaderService.cacheLimit / (1024 * 1024));

  if (!open) return null;

  const allApis = Object.keys(byApi);
  const allCards = Object.keys(byCard);
  const toMB = (bytes) => (bytes / (1024 * 1024)).toFixed(2);

  const handleLimitChange = (e) => setLimitMB(Number(e.target.value));
  const handleLimitSubmit = () => {
    imageLoaderService.setCacheLimit(limitMB * 1024 * 1024);
  };

  return (
    <div className="cache-manager-dialog">
      <div className="cache-manager-header">

        <h2>Cache Manager</h2>
        <div>Gesamtspeicher: {toMB(totalSize)} MB</div>
        <CacheProgressBar />
        <div>
          <label>
            Cache-Limit (MB):{" "}
            <input
              type="number"
              min={1}
              value={limitMB}
              onChange={handleLimitChange}
            />
          </label>
          <button className='button' onClick={handleLimitSubmit}>Limit setzen</button>
          <button className='button' onClick={onClose}>Schließen</button>
        </div>
      </div>
      <div className="cache-manager-content">
        <table style={{ borderCollapse: "collapse", width: "100%", marginTop: 16 }}>
          <thead>
            <tr>
              <th rowSpan={2} style={{ border: "1px solid #ccc", padding: 4, background: "#f8f8f8" }}></th>
              {allApis.map(api => (
                <th key={api} colSpan={2} style={{ border: "1px solid #ccc", padding: 4, background: "#f8f8f8", textAlign: "center" }}>{api}</th>
              ))}
              <th colSpan={2} style={{ border: "1px solid #ccc", padding: 4, background: "#f8f8f8", textAlign: "center" }}>Alle der Karte</th>
            </tr>
            <tr>
              {allApis.map(api => (
                <React.Fragment key={api + "_sub"}>
                  <th style={{ border: "1px solid #ccc", padding: 4, background: "#f8f8f8" }}>Anzahl</th>
                  <th style={{ border: "1px solid #ccc", padding: 4, background: "#f8f8f8" }}>MB</th>
                </React.Fragment>
              ))}
              <th style={{ border: "1px solid #ccc", padding: 4, background: "#f8f8f8" }}>Anzahl</th>
              <th style={{ border: "1px solid #ccc", padding: 4, background: "#f8f8f8" }}>MB</th>
            </tr>
          </thead>
          <tbody>
            <ApiSumRow allApis={allApis} byApi={byApi} toMB={toMB} />
            {allCards.map(cardName => (
              <CardRow key={cardName} cardName={cardName} allApis={allApis} byCard={byCard} toMB={toMB} />
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}