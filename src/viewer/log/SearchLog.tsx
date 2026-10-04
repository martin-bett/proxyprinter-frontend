import React from 'react';
import UploadIcon from '@mui/icons-material/Upload';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { LogEntry } from '../../api/types/types';
import './SearchLog.css';

// Pfeil hoch auf Boden = aus dem Cache geladen, Pfeil runter = aus dem Netz geholt
const sourceIcon: Record<LogEntry['source'], { icon: React.ReactNode; title: string }> = {
  cache: { icon: <UploadIcon fontSize="inherit" />, title: 'Aus dem Cache geladen' },
  network: { icon: <ArrowDownwardIcon fontSize="inherit" />, title: 'Aus dem Netz geladen' },
  error: { icon: <ErrorOutlineIcon fontSize="inherit" />, title: 'Fehler' },
};

interface SearchLogProps {
  entries: LogEntry[];
  onShowRaw: (raw: string) => void;
}

export default function SearchLog({ entries, onShowRaw }: SearchLogProps) {
  return (
    <div className="log">
      <table className="search-log-table">
        <colgroup>
          <col className="search-log-api" />
          <col className="search-log-source" />
          <col className="search-log-count" />
          <col />
        </colgroup>
        <tbody>
          {entries.map((entry, index) => {
            const { icon, title } = sourceIcon[entry.source];
            const raw = entry.source === 'error' ? entry.error : entry.rawResponse;
            return (
              <tr key={index} className={`search-log-row search-log-${entry.source}`}>
                <td className="search-log-cell-api" title={entry.configName}>{entry.configName}</td>
                <td>
                  <button
                    type="button"
                    className="search-log-source-button"
                    title={raw ? `${title}: Rohdaten anzeigen` : title}
                    aria-label={title}
                    disabled={!raw}
                    onClick={() => raw && onShowRaw(raw)}
                  >
                    {icon}
                  </button>
                </td>
                <td className="search-log-cell-count">{entry.source === 'error' ? '' : entry.count}</td>
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
