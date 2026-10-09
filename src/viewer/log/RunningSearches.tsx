import React, { useEffect, useState } from 'react';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import { useTranslation } from 'react-i18next';
import { formatDuration } from './SearchLog';
import { RunningSearch } from './useSearchActivity';
import './SearchLog.css';

interface RunningSearchesProps {
  running: RunningSearch[];
  pendingByApi: Record<string, number>;
}

interface ApiRow {
  configName: string;
  searches: RunningSearch[];
}

// Eine Zeile je API-Config, solange sie noch offene Suchen hat (auch wartende ohne Ergebnis)
export function toApiRows(running: RunningSearch[], pendingByApi: Record<string, number>): ApiRow[] {
  return Object.keys(pendingByApi).map(configName => ({
    configName,
    searches: running.filter(search => search.configName === configName),
  }));
}

export default function RunningSearches({ running, pendingByApi }: RunningSearchesProps) {
  const { t } = useTranslation();
  const rows = toApiRows(running, pendingByApi);
  const [now, setNow] = useState(() => performance.now());

  // Dauer läuft live mit, solange gesucht wird
  const active = rows.length > 0;
  useEffect(() => {
    if (!active) return;
    setNow(performance.now());
    const timer = setInterval(() => setNow(performance.now()), 500);
    return () => clearInterval(timer);
  }, [active]);

  if (!active) return null;
  return (
    <div className="search-log search-log-running-searches">
      <div className="search-log-section-title">{t('log.running.title')}</div>
      <table className="search-log-table">
        <colgroup>
          <col className="search-log-api" />
          <col className="search-log-requests" />
          <col className="search-log-duration" />
          <col />
          <col className="search-log-count" />
        </colgroup>
        <thead>
          <tr>
            <th>{t('log.headers.api')}</th>
            <th className="search-log-cell-number" title={t('log.columns.requests')}><SwapVertIcon fontSize="inherit" /> {t('log.headers.requests')}</th>
            <th className="search-log-cell-number" title={t('log.columns.duration')}><TimerOutlinedIcon fontSize="inherit" /> {t('log.headers.duration')}</th>
            <th>{t('common.name')}</th>
            <th className="search-log-cell-number" title={t('log.columns.matches')}># {t('log.headers.matches')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ configName, searches }) => {
            const first = searches[0];
            // Mehrere gleichzeitige Suchen einer API: Werte summiert, Dauer der ältesten
            const requests = searches.reduce((sum, search) => sum + search.requestCount, 0);
            const count = searches.reduce((sum, search) => sum + search.count, 0);
            const startedAt = Math.min(...searches.map(search => search.startedAt));
            const names = searches.map(search => search.cardName).join(', ');
            return (
              <tr key={configName} className="search-log-row">
                <td className="search-log-cell-api" title={configName}>{configName}</td>
                <td className="search-log-cell-number">{first ? requests : '–'}</td>
                <td className="search-log-cell-number">{first ? formatDuration(Math.max(0, now - startedAt)) : '–'}</td>
                <td className="search-log-cell-name" title={names}>
                  {first ? first.cardName : '–'}
                  {searches.length > 1 && <span className="search-log-more"> {t('log.running.more', { count: searches.length - 1 })}</span>}
                </td>
                <td className="search-log-cell-number">{first ? count : '–'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
