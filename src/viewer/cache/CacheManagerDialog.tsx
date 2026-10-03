import React, { useState } from "react";
import { imageLoaderService, CacheCardInput } from "../../service/cache/ImageLoaderService";
import { useImageLoaderCache } from "../../service/cache/hooks/useImageLoaderCache";
import { CacheProgressBar } from "./CacheProgressBar";

interface CacheEntryLike {
  sizeBytes: number;
  cardInput?: CacheCardInput;
}

// Wiederverwendbares Papierkorb-Icon
function TrashIcon({ style = {} }: { style?: React.CSSProperties }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ ...style }}>
      <path d="M3 6h18M9 6v12m6-12v12M5 6v14a2 2 0 002 2h10a2 2 0 002-2V6" style={{ stroke: "var(--text-muted)" }} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// CSS für das Overlay
const cellStyle: React.CSSProperties = {
  border: "1px solid var(--border)",
  padding: 4,
  position: "relative",
  textAlign: "center",
  background: "var(--surface-muted)",
  cursor: "pointer"
};
const trashOverlayStyle: React.CSSProperties = {
  position: "absolute",
  top: 2,
  right: 2,
  opacity: 0.7,
  display: "none",
  pointerEvents: "none"
};
const cellHoverStyle: React.CSSProperties = {
  ...cellStyle,
  background: "var(--danger-soft)"
};

interface DeletableCellProps {
  value?: number;
  mbValue?: string;
  showTrash: boolean;
  onDelete: () => void;
  hover: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export function DeletableCell({ value, mbValue, showTrash, onDelete, hover, onMouseEnter, onMouseLeave }: DeletableCellProps) {
  return (
    <td
      style={showTrash ? (hover ? cellHoverStyle : cellStyle) : { ...cellStyle, cursor: "default", background: "var(--surface)" }}
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
function ApiSumRow({ allApis, byApi, toMB }: { allApis: string[]; byApi: Record<string, CacheEntryLike[]>; toMB: (bytes: number) => string }) {
  return (
    <tr>
      <td style={{ border: "1px solid var(--border)", padding: 4, fontWeight: "bold", background: "var(--surface-muted)" }}>API gesamt</td>
      {allApis.map(api => (
        <DeletableApiSumCells key={api} api={api} entries={byApi[api] || []} toMB={toMB} />
      ))}
      <td style={{ border: "1px solid var(--border)", padding: 4, background: "var(--surface-muted)" }}></td>
      <td style={{ border: "1px solid var(--border)", padding: 4, background: "var(--surface-muted)" }}></td>
    </tr>
  );
}

function DeletableApiSumCells({ api, entries, toMB }: { api: string; entries: CacheEntryLike[]; toMB: (bytes: number) => string }) {
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
function CardRow({ cardName, allApis, byCard, toMB }: { cardName: string; allApis: string[]; byCard: Record<string, CacheEntryLike[]>; toMB: (bytes: number) => string }) {
  const entries = byCard[cardName] || [];
  return (
    <tr>
      <td style={{ border: "1px solid var(--border)", padding: 4, fontWeight: "bold" }}>{cardName}</td>
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

function DeletableCardCells({ api, cardName, entries, toMB }: { api: string; cardName: string; entries: CacheEntryLike[]; toMB: (bytes: number) => string }) {
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

function DeletableSummaryCells({ cardName, entries, toMB }: { cardName: string; entries: CacheEntryLike[]; toMB: (bytes: number) => string }) {
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

interface CacheManagerDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function CacheManagerDialog({ open, onClose }: CacheManagerDialogProps) {
  const { byApi, byCard, totalSize } = useImageLoaderCache();
  const [limitMB, setLimitMB] = useState(imageLoaderService.cacheLimit / (1024 * 1024));

  if (!open) return null;

  const allApis = Object.keys(byApi);
  const allCards = Object.keys(byCard);
  const toMB = (bytes: number) => (bytes / (1024 * 1024)).toFixed(2);

  const handleLimitChange = (e: React.ChangeEvent<HTMLInputElement>) => setLimitMB(Number(e.target.value));
  const handleLimitSubmit = () => {
    imageLoaderService.setCacheLimit(limitMB * 1024 * 1024);
  };

  return (
    <div className="cache-manager-dialog">
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
        <button onClick={handleLimitSubmit}>Limit setzen</button>
      </div>
      <table style={{ borderCollapse: "collapse", width: "100%", marginTop: 16 }}>
        <thead>
          <tr>
            <th rowSpan={2} style={{ border: "1px solid var(--border)", padding: 4, background: "var(--surface-muted)" }}></th>
            {allApis.map(api => (
              <th key={api} colSpan={2} style={{ border: "1px solid var(--border)", padding: 4, background: "var(--surface-muted)", textAlign: "center" }}>{api}</th>
            ))}
            <th colSpan={2} style={{ border: "1px solid var(--border)", padding: 4, background: "var(--surface-muted)", textAlign: "center" }}>Alle der Karte</th>
          </tr>
          <tr>
            {allApis.map(api => (
              <React.Fragment key={api + "_sub"}>
                <th style={{ border: "1px solid var(--border)", padding: 4, background: "var(--surface-muted)" }}>Anzahl</th>
                <th style={{ border: "1px solid var(--border)", padding: 4, background: "var(--surface-muted)" }}>MB</th>
              </React.Fragment>
            ))}
            <th style={{ border: "1px solid var(--border)", padding: 4, background: "var(--surface-muted)" }}>Anzahl</th>
            <th style={{ border: "1px solid var(--border)", padding: 4, background: "var(--surface-muted)" }}>MB</th>
          </tr>
        </thead>
        <tbody>
          <ApiSumRow allApis={allApis} byApi={byApi} toMB={toMB} />
          {allCards.map(cardName => (
            <CardRow key={cardName} cardName={cardName} allApis={allApis} byCard={byCard} toMB={toMB} />
          ))}
        </tbody>
      </table>
      <button style={{ marginTop: 16 }} onClick={onClose}>Schließen</button>
    </div>
  );
}
