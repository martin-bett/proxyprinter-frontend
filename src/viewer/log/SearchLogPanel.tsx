import React, { useLayoutEffect, useRef } from 'react';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import { LogEntry } from '../../api/types/types';
import SearchLog from './SearchLog';
import RunningSearches from './RunningSearches';
import { RunningSearch } from './useSearchActivity';
import './SearchLog.css';

interface SearchLogPanelProps {
  open: boolean;
  entries: LogEntry[];
  running: RunningSearch[];
  pendingByApi: Record<string, number>;
  onShowRaw: (raw: string) => void;
  onClose: () => void;
}

// Nicht-modaler Dialog über der Kartenansicht: die Karten darunter bleiben bedienbar
// und man sieht neue Karten dazukommen, während die Suche läuft.
export default function SearchLogPanel({ open, entries, running, pendingByApi, onShowRaw, onClose }: SearchLogPanelProps) {
  const { t } = useTranslation();
  const bodyRef = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);

  // Neue Einträge kommen unten dazu; wer unten steht, bleibt unten
  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (body && atBottom.current) body.scrollTop = body.scrollHeight;
  }, [entries.length, open]);

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
      <RunningSearches running={running} pendingByApi={pendingByApi} />
      <div className="search-log-section-title search-log-history-title">{t('log.history.title')}</div>
      <div
        ref={bodyRef}
        className="search-log-panel-body"
        onScroll={(event) => {
          const body = event.currentTarget;
          atBottom.current = body.scrollHeight - body.scrollTop - body.clientHeight < 8;
        }}
      >
        <SearchLog entries={entries} onShowRaw={onShowRaw} />
      </div>
    </div>
  );
}
