import React, { useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const classes = ["cache-cell", showTrash ? "is-deletable" : "is-empty"];
  if (showTrash && hover) classes.push("is-hover");
  if (protectHover) classes.push(`is-protect-${protectHover}`);
  return (
    <td
      className={classes.join(" ")}
      onClick={showTrash ? onDelete : undefined}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      title={title ?? (showTrash ? t("cache.manager.clickToDelete") : "")}
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
  const { t } = useTranslation();
  if (entries.length === 0) return <td className="cache-cell cache-lock-cell is-empty" />;
  const lockedCount = entries.filter(e => e.locked).length;
  const allLocked = lockedCount === entries.length;
  const action: ProtectHover = allLocked ? "unlock" : "lock";
  const state = allLocked ? "is-locked" : lockedCount > 0 ? "is-partial" : "is-unlocked";
  const title = allLocked
    ? t("cache.manager.lock.protected")
    : lockedCount > 0
      ? t("cache.manager.lock.partial", { locked: lockedCount, total: entries.length })
      : t("cache.manager.lock.unprotected");
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
  const { t } = useTranslation();
  const [hover, setHover] = useState(false);
  const [protectHover, setProtectHover] = useState<ProtectHover | undefined>();
  const lockedCount = entries.filter(e => e.locked).length;
  const deletable = entries.length > lockedCount;
  const title = !deletable
    ? lockedCount > 0 ? t("cache.manager.groupProtected") : ""
    : lockedCount > 0 ? t("cache.manager.deleteKeepProtected", { count: lockedCount }) : t("cache.manager.clickToDelete");
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
  const { t } = useTranslation();
  return (
    <tr className="cache-sum-row">
      <th className="cache-row-label">{t("cache.manager.apiTotal")}</th>
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

const LockHeader = () => {
  const { t } = useTranslation();
  return <th className="cache-lock-head" title={t("cache.manager.protectFromDeletion")}><LockIcon fontSize="inherit" /></th>;
};

interface CacheManagerDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function CacheManagerDialog({ open, onClose }: CacheManagerDialogProps) {
  const { t } = useTranslation();
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
      <h2>{t("cache.manager.title")}</h2>
      <div className="cache-manager-head">
        <div className="cache-manager-usage">
          <span>
            {t("cache.manager.usage", { used: toMB(totalSize), limit: Math.round(imageLoaderService.cacheLimit / (1024 * 1024)) })}
            {lockedCount > 0 && <> · {t("cache.manager.protectedCount", { count: lockedCount })}</>}
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
            {t("cache.manager.limitLabel")}
            <input type="number" min={1} value={limitMB} onChange={handleLimitChange} />
          </label>
          <ActionButton icon={<SaveIcon />} type="submit">{t("cache.manager.setLimit")}</ActionButton>
        </form>
        <ActionButton
          icon={<DeleteSweepIcon />}
          className="is-danger cache-manager-clear"
          onClick={() => imageLoaderService.clearCache()}
          disabled={allApis.flatMap(api => byApi[api]).every(e => e.locked)}
        >
          {t("cache.manager.clearCache")}
        </ActionButton>
      </div>
      <p className="cache-manager-hint">
        {t("cache.manager.hint")}
      </p>
      <table className="cache-table">
        <thead>
          <tr>
            <th rowSpan={2}></th>
            {allApis.map(api => (
              <th key={api} colSpan={3}>{api}</th>
            ))}
            <th colSpan={3}>{t("cache.manager.allApis")}</th>
          </tr>
          <tr>
            {allApis.map(api => (
              <React.Fragment key={api + "_sub"}>
                <th>{t("cache.manager.count")}</th>
                <th>MB</th>
                <LockHeader />
              </React.Fragment>
            ))}
            <th>{t("cache.manager.count")}</th>
            <th>MB</th>
            <LockHeader />
          </tr>
        </thead>
        <tbody>
          <ApiSumRow allApis={allApis} byApi={byApi} toMB={toMB} />
          {allCards.length === 0 && (
            <tr>
              <td colSpan={allApis.length * 3 + 4} className="cache-cell is-empty">{t("cache.manager.empty")}</td>
            </tr>
          )}
          {allCards.map(cardName => (
            <CardRow key={cardName} cardName={cardName} allApis={allApis} byCard={byCard} toMB={toMB} />
          ))}
        </tbody>
      </table>
      <div className="cache-manager-footer">
        <ActionButton icon={<CloseIcon />} onClick={onClose}>{t("common.close")}</ActionButton>
      </div>
    </div>
  );
}
