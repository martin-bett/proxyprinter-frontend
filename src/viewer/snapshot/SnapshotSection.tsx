import React from 'react';
import SaveIcon from '@mui/icons-material/Save';
import HistoryIcon from '@mui/icons-material/History';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import DownloadIcon from '@mui/icons-material/Download';
import SaveAsIcon from '@mui/icons-material/SaveAs';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
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
  const listed = snapshots.filter(s => s.kind !== 'session');

  const pdfMeta = (snapshot: Snapshot) => {
    if (!snapshot.pdf.generated) return null;
    const info = pdfInfos[snapshot.id];
    if (info === null) return <span className="snapshot-meta is-expired">PDF expired</span>;
    if (info) return <span className="snapshot-meta">PDF {formatSize(info.fileSize)}, available until {formatDay(info.expiresAt)}</span>;
    return null;
  };

  return (
    <div className="snapshot-section">
      {notice && <p className="snapshot-notice" role="status">{notice}</p>}

      {session && (
        <div className="input-tile snapshot-row snapshot-session">
          <button type="button" className="snapshot-open" onClick={() => onLoad(session)} title="Restore last session">
            <span className="input-tile-lead" aria-hidden="true"><HistoryIcon /></span>
            <span className="input-tile-title">
              <span className="snapshot-text">
                <span className="snapshot-label">Restore last session</span>
                <span className="snapshot-meta">{snapshotLabel(session)} · {snapshotCardsText(session)} · {formatDate(session.createdAt)}</span>
              </span>
            </span>
          </button>
        </div>
      )}

      <ActionButton icon={<SaveIcon />} onClick={onSave} disabled={!canSave}>Save Snapshot</ActionButton>

      {listed.map(snapshot => {
        const info = pdfInfos[snapshot.id];
        const label = snapshotLabel(snapshot);
        const active = snapshot.id === activeId;
        return (
          <div key={snapshot.id} className={`input-tile snapshot-row${active ? ' is-active' : ''}`} aria-current={active || undefined}>
            <button
              type="button"
              className="snapshot-open"
              onClick={() => onLoad(snapshot)}
              title={active ? `${label} is active: changes are saved here` : `Load ${label}`}
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
                title="Download PDF"
                aria-label={`Download PDF of ${label}`}
              >
                <DownloadIcon />
              </a>
            )}
            <button
              type="button"
              className="snapshot-tool"
              onClick={() => onOverwrite(snapshot)}
              disabled={!canSave}
              title="Overwrite with current state"
              aria-label={`Overwrite ${label} with current state`}
            >
              <SaveAsIcon />
            </button>
            <button type="button" className="snapshot-tool" onClick={() => onRename(snapshot)} title="Rename" aria-label={`Rename ${label}`}>
              <EditIcon />
            </button>
            <button type="button" className="snapshot-tool" onClick={() => onDelete(snapshot)} title="Delete" aria-label={`Delete ${label}`}>
              <DeleteIcon />
            </button>
          </div>
        );
      })}

      {listed.length > 0 && (
        <div className="snapshot-footer">
          <span>Stored in this browser · {formatSize(totalBytes)}</span>
          <button type="button" onClick={onDeleteAll}>Delete all</button>
        </div>
      )}
    </div>
  );
};

export default SnapshotSection;
