import React from 'react';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import { LogEntry } from '../../api/types/types';
import SearchLog from './SearchLog';
import './SearchLog.css';

interface SearchLogPanelProps {
  open: boolean;
  entries: LogEntry[];
  onShowRaw: (raw: string) => void;
  onClose: () => void;
}

// Nicht-modaler Dialog über der Kartenansicht: die Karten darunter bleiben bedienbar
// und man sieht neue Karten dazukommen, während die Suche läuft.
export default function SearchLogPanel({ open, entries, onShowRaw, onClose }: SearchLogPanelProps) {
  const { t } = useTranslation();
  if (!open) return null;
  const title = t('deckInput.searchLog.title');
  return (
    <div
      className="search-log-panel"
      role="dialog"
      aria-label={title}
      onKeyDown={(event) => { if (event.key === 'Escape') onClose(); }}
    >
      <div className="search-log-panel-header">
        <span className="search-log-panel-title">{title}</span>
        <span className="search-log-panel-count">{t('deckInput.searchLog.entries', { count: entries.length })}</span>
        <IconButton size="small" onClick={onClose} title={t('common.close')} aria-label={t('common.close')}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </div>
      <div className="search-log-panel-body">
        <SearchLog entries={entries} onShowRaw={onShowRaw} />
      </div>
    </div>
  );
}
