import React, { useEffect, useState } from 'react';
import SaveIcon from '@mui/icons-material/Save';
import HistoryIcon from '@mui/icons-material/History';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import DownloadIcon from '@mui/icons-material/Download';
import SaveAsIcon from '@mui/icons-material/SaveAs';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { useTranslation } from 'react-i18next';
import ActionButton from '../../container/inputs/ActionButton';
import { Snapshot, snapshotCardsText, snapshotLabel } from '../../service/snapshot/snapshot';
import { PdfInfo, pdfDownloadUrl, pdfFileName } from '../../service/snapshot/snapshotBackend';
import './SnapshotSection.css';

export interface SnapshotSectionProps {
  snapshots: Snapshot[];
  /** Geladener bzw. gespeicherter Snapshot, der beim Weiterarbeiten überschrieben wird */
  activeId: string | null;
  /** Letzte Sitzung, nur gesetzt, solange sie wiederhergestellt werden kann */
  session: Snapshot | null;
  /** PDF-Status je Snapshot-ID: Info, null = gelöscht, fehlt = unbekannt */
  pdfInfos: Record<string, PdfInfo | null>;
  notice: string | null;
  canSave: boolean;
  totalBytes: number;
  onSave: () => void;
  onLoad: (snapshot: Snapshot) => void;
  /** Inhalt durch den aktuellen Stand ersetzen */
  onOverwrite: (snapshot: Snapshot) => void;
  onRename: (snapshot: Snapshot) => void;
  onDelete: (snapshot: Snapshot) => void;
  onDeleteAll: () => void;
}

/** Höchstens so viele Snapshots sind gleichzeitig sichtbar, der Rest wird geblättert */
export const VISIBLE_SNAPSHOTS = 4;

const formatDate = (ms: number) =>
  new Date(ms).toLocaleString(undefined, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

const formatDay = (ms: number) =>
  new Date(ms).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' });

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

const kindIcon = (snapshot: Snapshot) => {
  switch (snapshot.kind) {
    case 'generate': return <PictureAsPdfIcon />;
    case 'session': return <HistoryIcon />;
    default: return <BookmarkIcon />;
  }
};

const SnapshotSection: React.FC<SnapshotSectionProps> = ({
  snapshots, activeId, session, pdfInfos, notice, canSave, totalBytes, onSave, onLoad, onOverwrite, onRename, onDelete, onDeleteAll,
}) => {
  const { t } = useTranslation();
  const listed = snapshots.filter(s => s.kind !== 'session');
  const [offset, setOffset] = useState(0);
  const maxOffset = Math.max(0, listed.length - VISIBLE_SNAPSHOTS);
  const start = Math.min(offset, maxOffset);
  const activeIndex = listed.findIndex(s => s.id === activeId);

  // Neu aktiver Snapshot (gespeichert, geladen) wird ins Fenster geholt
  useEffect(() => {
    if (activeIndex < 0) return;
    setOffset(current => {
      const from = Math.min(current, maxOffset);
      if (activeIndex < from) return activeIndex;
      if (activeIndex >= from + VISIBLE_SNAPSHOTS) return activeIndex - VISIBLE_SNAPSHOTS + 1;
      return from;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  const pdfMeta = (snapshot: Snapshot) => {
    if (!snapshot.pdf.generated) return null;
    const info = pdfInfos[snapshot.id];
    if (info === null) return <span className="snapshot-meta is-expired">{t('snapshot.pdfExpired')}</span>;
    if (info) return <span className="snapshot-meta">{t('snapshot.pdfAvailable', { size: formatSize(info.fileSize), date: formatDay(info.expiresAt) })}</span>;
    return null;
  };

  return (
    <div className="snapshot-section">
      {notice && <p className="snapshot-notice" role="status">{notice}</p>}

      {session && (
        <div className="input-tile snapshot-row snapshot-session">
          <button type="button" className="snapshot-open" onClick={() => onLoad(session)} title={t('snapshot.restoreLastSession')}>
            <span className="input-tile-lead" aria-hidden="true"><HistoryIcon /></span>
            <span className="input-tile-title">
              <span className="snapshot-text">
                <span className="snapshot-label">{t('snapshot.restoreLastSession')}</span>
                <span className="snapshot-meta">{snapshotLabel(session)} · {snapshotCardsText(session)} · {formatDate(session.createdAt)}</span>
              </span>
            </span>
          </button>
        </div>
      )}

      <ActionButton icon={<SaveIcon />} onClick={onSave} disabled={!canSave} data-tour="save-snapshot">{t('snapshot.save')}</ActionButton>

      {start > 0 && (
        <button
          type="button"
          className="snapshot-page"
          onClick={() => setOffset(start - 1)}
          title={t('snapshot.scrollUp')}
          aria-label={t('snapshot.scrollUp')}
        >
          <KeyboardArrowUpIcon />
        </button>
      )}

      {listed.slice(start, start + VISIBLE_SNAPSHOTS).map(snapshot => {
        const info = pdfInfos[snapshot.id];
        const label = snapshotLabel(snapshot);
        const active = snapshot.id === activeId;
        return (
          <div key={snapshot.id} className={`input-tile snapshot-row${active ? ' is-active' : ''}`} aria-current={active || undefined}>
            <button
              type="button"
              className="snapshot-open"
              onClick={() => onLoad(snapshot)}
              title={active ? t('snapshot.activeTitle', { label }) : t('snapshot.loadTitle', { label })}
            >
              <span className="input-tile-lead" aria-hidden="true">{kindIcon(snapshot)}</span>
              <span className="input-tile-title">
                <span className="snapshot-text">
                  <span className="snapshot-label">{label}</span>
                  <span className="snapshot-meta">{snapshotCardsText(snapshot)} · {formatDate(snapshot.createdAt)}</span>
                  {pdfMeta(snapshot)}
                </span>
              </span>
            </button>
            {snapshot.pdf.generated && info && (
              <a
                className="snapshot-tool"
                href={pdfDownloadUrl(snapshot.pdf.generated.progressId, pdfFileName(label))}
                download={`${pdfFileName(label)}.pdf`}
                title={t('snapshot.downloadPdf')}
                aria-label={t('snapshot.downloadPdfOf', { label })}
              >
                <DownloadIcon />
              </a>
            )}
            <button
              type="button"
              className="snapshot-tool"
              onClick={() => onOverwrite(snapshot)}
              disabled={!canSave}
              title={t('snapshot.overwriteTitle')}
              aria-label={t('snapshot.overwriteAria', { label })}
            >
              <SaveAsIcon />
            </button>
            <button type="button" className="snapshot-tool" onClick={() => onRename(snapshot)} title={t('common.rename')} aria-label={t('snapshot.renameAria', { label })}>
              <EditIcon />
            </button>
            <button type="button" className="snapshot-tool" onClick={() => onDelete(snapshot)} title={t('common.delete')} aria-label={t('snapshot.deleteAria', { label })}>
              <DeleteIcon />
            </button>
          </div>
        );
      })}

      {start < maxOffset && (
        <button
          type="button"
          className="snapshot-page"
          onClick={() => setOffset(start + 1)}
          title={t('snapshot.scrollDown')}
          aria-label={t('snapshot.scrollDown')}
        >
          <KeyboardArrowDownIcon />
        </button>
      )}

      {listed.length > 0 && (
        <div className="snapshot-footer">
          <span>{t('snapshot.storedInBrowser', { size: formatSize(totalBytes) })}</span>
          <button type="button" onClick={onDeleteAll}>{t('snapshot.deleteAll')}</button>
        </div>
      )}
    </div>
  );
};

export default SnapshotSection;
