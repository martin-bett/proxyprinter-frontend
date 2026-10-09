import React from 'react';
import UploadIcon from '@mui/icons-material/Upload';
import CloudDownloadOutlinedIcon from '@mui/icons-material/CloudDownloadOutlined';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import CircularProgress from '@mui/material/CircularProgress';
import { useTranslation } from 'react-i18next';
import { LogEntry } from '../../api/types/types';
import './SearchLog.css';

// Pfeil hoch auf Boden = aus dem Cache geladen, Pfeil runter = aus dem Netz geholt
const sourceIcon = {
  cache: { icon: <UploadIcon fontSize="inherit" />, title: 'log.source.cache' },
  server: { icon: <CloudDownloadOutlinedIcon fontSize="inherit" />, title: 'log.source.server' },
  network: { icon: <ArrowDownwardIcon fontSize="inherit" />, title: 'log.source.network' },
  error: { icon: <ErrorOutlineIcon fontSize="inherit" />, title: 'log.source.error' },
  running: { icon: <CircularProgress size="0.85em" color="inherit" />, title: 'log.source.running' },
} as const satisfies Record<LogEntry['source'], { icon: React.ReactNode; title: string }>;

// Kurz halten, die Spalte ist schmal: 85ms, 1.2s, 12s
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 10000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 1000)}s`;
}

interface SearchLogProps {
  entries: LogEntry[];
  onShowRaw: (raw: string) => void;
}

export default function SearchLog({ entries, onShowRaw }: SearchLogProps) {
  const { t } = useTranslation();
  return (
    <div className="search-log">
      <table className="search-log-table">
        <colgroup>
          <col className="search-log-api" />
          <col className="search-log-source" />
          <col className="search-log-count" />
          <col className="search-log-duration" />
          <col className="search-log-requests" />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th>API</th>
            <th title={t('log.columns.source')}>Q</th>
            <th className="search-log-cell-number" title={t('log.columns.matches')}>#</th>
            <th className="search-log-cell-number" title={t('log.columns.duration')}><TimerOutlinedIcon fontSize="inherit" /></th>
            <th className="search-log-cell-number" title={t('log.columns.requests')}><SwapVertIcon fontSize="inherit" /></th>
            <th>{t('common.name')}</th>
          </tr>
        </thead>
        <tbody>
          {/* Neueste Einträge oben, damit man beim Suchen nicht nach unten scrollen muss */}
          {entries.map((entry, index) => ({ entry, index })).reverse().map(({ entry, index }) => {
            const { icon, title: titleKey } = sourceIcon[entry.source];
            const title = t(titleKey);
            const raw = entry.source === 'error' ? entry.error : entry.rawResponse;
            // Laufende Suche ohne fertige Seite: noch keine Werte
            const pending = entry.source === 'running' && !entry.requestCount;
            return (
              <tr key={entry.id ?? `done-${index}`} className={`search-log-row search-log-${entry.source}`}>
                <td className="search-log-cell-api" title={entry.configName}>{entry.configName}</td>
                <td>
                  <button
                    type="button"
                    className="search-log-source-button"
                    title={raw ? t('log.showRaw', { title }) : title}
                    aria-label={title}
                    disabled={!raw}
                    onClick={() => raw && onShowRaw(raw)}
                  >
                    {icon}
                  </button>
                </td>
                <td className="search-log-cell-number">{entry.source === 'error' || pending ? '–' : entry.count}</td>
                <td className="search-log-cell-number">{pending ? '–' : formatDuration(entry.durationMs)}</td>
                <td className="search-log-cell-number">{pending ? '–' : entry.requestCount ?? '–'}</td>
                <td className="search-log-cell-name" title={entry.error ? `${entry.cardName}: ${entry.error}` : entry.cardName}>
                  {entry.cardName}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
