import React, { useState } from "react";
import { imageLoaderService, CacheCardInput } from "../../service/cache/ImageLoaderService";
import { useImageLoaderCache } from "../../service/cache/hooks/useImageLoaderCache";
import CloseIcon from "@mui/icons-material/Close";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import SaveIcon from "@mui/icons-material/Save";
import ActionButton from "../../container/inputs/ActionButton";
import { CacheProgressBar } from "./CacheProgressBar";
import "./CacheManagerDialog.css";

interface CacheEntryLike {
  sizeBytes: number;
  cardInput?: CacheCardInput;
}

interface DeletableCellProps {
  value?: number;
  mbValue?: string;
  showTrash: boolean;
  onDelete: () => void;
  hover: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

// Zelle, die beim Klick ihren Cache löscht. Beim Überfahren färbt sie sich (mit ihrer Partnerzelle) rot;
// kein zusätzliches Icon, damit sich die Spaltenbreiten nicht verschieben.
export function DeletableCell({ value, mbValue, showTrash, onDelete, hover, onMouseEnter, onMouseLeave }: DeletableCellProps) {
  const className = showTrash ? `cache-cell is-deletable${hover ? " is-hover" : ""}` : "cache-cell is-empty";
  return (
    <td
      className={className}
      onClick={showTrash ? onDelete : undefined}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      title={showTrash ? "Klicken zum Löschen" : ""}
    >
      {mbValue !== undefined ? mbValue : value}
    </td>
  );
}

// Zeilen-Komponente für API-Gesamtsummen
function ApiSumRow({ allApis, byApi, toMB }: { allApis: string[]; byApi: Record<string, CacheEntryLike[]>; toMB: (bytes: number) => string }) {
  return (
    <tr className="cache-sum-row">
      <th className="cache-row-label">API gesamt</th>
      {allApis.map(api => (
        <DeletableApiSumCells key={api} api={api} entries={byApi[api] || []} toMB={toMB} />
      ))}
      <DeletableTotalCells entries={allApis.flatMap(api => byApi[api] || [])} toMB={toMB} />
    </tr>
  );
}

// Ganz rechts in der Summenzeile: der komplette Cache
function DeletableTotalCells({ entries, toMB }: { entries: CacheEntryLike[]; toMB: (bytes: number) => string }) {
  const [hover, setHover] = useState(false);
  const size = entries.reduce((sum, e) => sum + (e.sizeBytes || 0), 0);
  return (
    <>
      <DeletableCell
        value={entries.length}
        onDelete={() => imageLoaderService.clearCache()}
        showTrash={entries.length > 0}
        hover={hover}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      />
      <DeletableCell
        mbValue={toMB(size)}
        onDelete={() => imageLoaderService.clearCache()}
        showTrash={entries.length > 0}
        hover={hover}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      />
    </>
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
      <th className="cache-row-label">{cardName}</th>
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
      <h2>Bild-Cache</h2>
      <div className="cache-manager-head">
        <div className="cache-manager-usage">
          <span>{toMB(totalSize)} MB von {Math.round(imageLoaderService.cacheLimit / (1024 * 1024))} MB belegt</span>
          <CacheProgressBar width={240} />
        </div>
        <form
          className="cache-manager-limit"
          onSubmit={e => {
            e.preventDefault();
            handleLimitSubmit();
          }}
        >
          <label>
            Limit (MB)
            <input type="number" min={1} value={limitMB} onChange={handleLimitChange} />
          </label>
          <ActionButton icon={<SaveIcon />} type="submit">Limit setzen</ActionButton>
        </form>
        <ActionButton
          icon={<DeleteSweepIcon />}
          className="is-danger cache-manager-clear"
          onClick={() => imageLoaderService.clearCache()}
          disabled={allCards.length === 0}
        >
          Cache leeren
        </ActionButton>
      </div>
      <p className="cache-manager-hint">Klick auf eine Zelle löscht die Bilder dahinter, die rote Markierung zeigt was gelöscht wird.</p>
      <table className="cache-table">
        <thead>
          <tr>
            <th rowSpan={2}></th>
            {allApis.map(api => (
              <th key={api} colSpan={2}>{api}</th>
            ))}
            <th colSpan={2}>Alle der Karte</th>
          </tr>
          <tr>
            {allApis.map(api => (
              <React.Fragment key={api + "_sub"}>
                <th>Anzahl</th>
                <th>MB</th>
              </React.Fragment>
            ))}
            <th>Anzahl</th>
            <th>MB</th>
          </tr>
        </thead>
        <tbody>
          <ApiSumRow allApis={allApis} byApi={byApi} toMB={toMB} />
          {allCards.length === 0 && (
            <tr>
              <td colSpan={allApis.length * 2 + 3} className="cache-cell is-empty">Der Cache ist leer</td>
            </tr>
          )}
          {allCards.map(cardName => (
            <CardRow key={cardName} cardName={cardName} allApis={allApis} byCard={byCard} toMB={toMB} />
          ))}
        </tbody>
      </table>
      <div className="cache-manager-footer">
        <ActionButton icon={<CloseIcon />} onClick={onClose}>Schließen</ActionButton>
      </div>
    </div>
  );
}
