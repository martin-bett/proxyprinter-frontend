import React, { useState } from "react";
import { imageLoaderService, CacheCardInput, CacheEntryFilter } from "../../service/cache/ImageLoaderService";
import { useImageLoaderCache } from "../../service/cache/hooks/useImageLoaderCache";
import CloseIcon from "@mui/icons-material/Close";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import SaveIcon from "@mui/icons-material/Save";
import LockIcon from "@mui/icons-material/Lock";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import ActionButton from "../../container/inputs/ActionButton";
import { CacheProgressBar } from "./CacheProgressBar";
import "./CacheManagerDialog.css";

interface CacheEntryLike {
  sizeBytes: number;
  cardInput?: CacheCardInput;
  locked?: boolean;
}

type ProtectHover = "lock" | "unlock";

interface DeletableCellProps {
  value?: number;
  mbValue?: string;
  showTrash: boolean;
  onDelete: () => void;
  hover: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  title?: string;
  /** Overlay, solange das Schloss der Gruppe überfahren wird */
  protectHover?: ProtectHover;
}

// Zelle, die beim Klick ihren Cache löscht. Beim Überfahren färbt sie sich (mit ihrer Partnerzelle) rot;
// kein zusätzliches Icon, damit sich die Spaltenbreiten nicht verschieben.
export function DeletableCell({ value, mbValue, showTrash, onDelete, hover, onMouseEnter, onMouseLeave, title, protectHover }: DeletableCellProps) {
  const classes = ["cache-cell", showTrash ? "is-deletable" : "is-empty"];
  if (showTrash && hover) classes.push("is-hover");
  if (protectHover) classes.push(`is-protect-${protectHover}`);
  return (
    <td
      className={classes.join(" ")}
      onClick={showTrash ? onDelete : undefined}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      title={title ?? (showTrash ? "Click to delete" : "")}
    >
      {mbValue !== undefined ? mbValue : value}
    </td>
  );
}

interface LockCellProps {
  entries: CacheEntryLike[];
  onToggle: (locked: boolean) => void;
  onHover: (hover: ProtectHover | undefined) => void;
  hover?: ProtectHover;
}

// Schloss einer Gruppe: geschlossen = alle Einträge geschützt, halb transparent = nur ein Teil. Löscht nie.
function LockCell({ entries, onToggle, onHover, hover }: LockCellProps) {
  if (entries.length === 0) return <td className="cache-cell cache-lock-cell is-empty" />;
  const lockedCount = entries.filter(e => e.locked).length;
  const allLocked = lockedCount === entries.length;
  const action: ProtectHover = allLocked ? "unlock" : "lock";
  const state = allLocked ? "is-locked" : lockedCount > 0 ? "is-partial" : "is-unlocked";
  const title = allLocked
    ? "Protected. Click to remove protection"
    : lockedCount > 0
      ? `${lockedCount} of ${entries.length} protected. Click to protect all`
      : "Click to protect from deletion";
  return (
    <td
      className={`cache-cell cache-lock-cell ${state}${hover ? ` is-protect-${hover}` : ""}`}
      onClick={() => onToggle(!allLocked)}
      onMouseEnter={() => onHover(action)}
      onMouseLeave={() => onHover(undefined)}
      title={title}
    >
      {allLocked || lockedCount > 0 ? <LockIcon fontSize="inherit" /> : <LockOpenIcon fontSize="inherit" />}
    </td>
  );
}

const sizeOf = (entries: CacheEntryLike[]) => entries.reduce((sum, e) => sum + (e.sizeBytes || 0), 0);

interface CacheGroupCellsProps {
  entries: CacheEntryLike[];
  filter: CacheEntryFilter;
  toMB: (bytes: number) => string;
}

// Anzahl, MB und Schloss einer Gruppe von Einträgen (API, Karte, beides oder alles).
// Löschen trifft nur ungeschützte Einträge; das Schloss schützt oder entsperrt die ganze Gruppe.
function CacheGroupCells({ entries, filter, toMB }: CacheGroupCellsProps) {
  const [hover, setHover] = useState(false);
  const [protectHover, setProtectHover] = useState<ProtectHover | undefined>();
  const lockedCount = entries.filter(e => e.locked).length;
  const deletable = entries.length > lockedCount;
  const title = !deletable
    ? lockedCount > 0 ? "Protected" : ""
    : lockedCount > 0 ? `Click to delete (${lockedCount} protected stay)` : "Click to delete";
  const cellProps = {
    onDelete: () => imageLoaderService.deleteUnlocked(filter),
    showTrash: deletable,
    hover,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    title,
    protectHover,
  };
  return (
    <>
      <DeletableCell value={entries.length} {...cellProps} />
      <DeletableCell mbValue={toMB(sizeOf(entries))} {...cellProps} />
      <LockCell
        entries={entries}
        hover={protectHover}
        onHover={setProtectHover}
        onToggle={locked => imageLoaderService.setLocked(filter, locked)}
      />
    </>
  );
}

// Zeilen-Komponente für API-Gesamtsummen
function ApiSumRow({ allApis, byApi, toMB }: { allApis: string[]; byApi: Record<string, CacheEntryLike[]>; toMB: (bytes: number) => string }) {
  return (
    <tr className="cache-sum-row">
      <th className="cache-row-label">API total</th>
      {allApis.map(api => (
        <CacheGroupCells key={api} entries={byApi[api] || []} filter={{ apiName: api }} toMB={toMB} />
      ))}
      <CacheGroupCells entries={allApis.flatMap(api => byApi[api] || [])} filter={{}} toMB={toMB} />
    </tr>
  );
}

// Zeilen-Komponente für Karten-Zeilen
function CardRow({ cardName, allApis, byCard, toMB }: { cardName: string; allApis: string[]; byCard: Record<string, CacheEntryLike[]>; toMB: (bytes: number) => string }) {
  const entries = byCard[cardName] || [];
  return (
    <tr>
      <th className="cache-row-label">{cardName}</th>
      {allApis.map(api => (
        <CacheGroupCells
          key={api}
          entries={entries.filter(e => e.cardInput?.apiName === api)}
          filter={{ apiName: api, cardName }}
          toMB={toMB}
        />
      ))}
      <CacheGroupCells entries={entries} filter={{ cardName }} toMB={toMB} />
    </tr>
  );
}

const LockHeader = () => (
  <th className="cache-lock-head" title="Protect from deletion"><LockIcon fontSize="inherit" /></th>
);

interface CacheManagerDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function CacheManagerDialog({ open, onClose }: CacheManagerDialogProps) {
  const { byApi, byCard, totalSize, lockedCount } = useImageLoaderCache();
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
      <h2>Image cache</h2>
      <div className="cache-manager-head">
        <div className="cache-manager-usage">
          <span>
            {toMB(totalSize)} MB of {Math.round(imageLoaderService.cacheLimit / (1024 * 1024))} MB used
            {lockedCount > 0 && <> · {lockedCount} protected</>}
          </span>
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
          <ActionButton icon={<SaveIcon />} type="submit">Set limit</ActionButton>
        </form>
        <ActionButton
          icon={<DeleteSweepIcon />}
          className="is-danger cache-manager-clear"
          onClick={() => imageLoaderService.clearCache()}
          disabled={allApis.flatMap(api => byApi[api]).every(e => e.locked)}
        >
          Clear cache
        </ActionButton>
      </div>
      <p className="cache-manager-hint">
        Click a cell to delete the images behind it, the red highlight shows what gets deleted.
        The lock protects images: they stay when you clear the cache and are only removed to make room
        when the protected images alone exceed the limit.
      </p>
      <table className="cache-table">
        <thead>
          <tr>
            <th rowSpan={2}></th>
            {allApis.map(api => (
              <th key={api} colSpan={3}>{api}</th>
            ))}
            <th colSpan={3}>All APIs</th>
          </tr>
          <tr>
            {allApis.map(api => (
              <React.Fragment key={api + "_sub"}>
                <th>Count</th>
                <th>MB</th>
                <LockHeader />
              </React.Fragment>
            ))}
            <th>Count</th>
            <th>MB</th>
            <LockHeader />
          </tr>
        </thead>
        <tbody>
          <ApiSumRow allApis={allApis} byApi={byApi} toMB={toMB} />
          {allCards.length === 0 && (
            <tr>
              <td colSpan={allApis.length * 3 + 4} className="cache-cell is-empty">The cache is empty</td>
            </tr>
          )}
          {allCards.map(cardName => (
            <CardRow key={cardName} cardName={cardName} allApis={allApis} byCard={byCard} toMB={toMB} />
          ))}
        </tbody>
      </table>
      <div className="cache-manager-footer">
        <ActionButton icon={<CloseIcon />} onClick={onClose}>Close</ActionButton>
      </div>
    </div>
  );
}
