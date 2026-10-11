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

interface ApiGroup {
  configName: string;
  searches: RunningSearch[];
}

// Eine Gruppe je API-Config, solange sie noch offene Suchen hat (auch wartende ohne laufende Suche)
export function toApiGroups(running: RunningSearch[], pendingByApi: Record<string, number>): ApiGroup[] {
  return Object.keys(pendingByApi).map(configName => ({
    configName,
    searches: running.filter(search => search.configName === configName),
  }));
}

export default function RunningSearches({ running, pendingByApi }: RunningSearchesProps) {
  const { t } = useTranslation();
  const groups = toApiGroups(running, pendingByApi);
  const [now, setNow] = useState(() => performance.now());

  // Dauer läuft live mit, solange gesucht wird
  const active = groups.length > 0;
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
          {groups.map(({ configName, searches }) => {
            // Je Suche eine Zeile; der API-Name steht nur einmal und überspannt die Gruppe
            const apiCell = (rowSpan: number) => (
              <td className="search-log-cell-api search-log-group-api" rowSpan={rowSpan} title={configName}>{configName}</td>
            );
            if (searches.length === 0) {
              return (
                <tr key={configName} className="search-log-row search-log-group-start">
                  {apiCell(1)}
                  <td className="search-log-cell-number">–</td>
                  <td className="search-log-cell-number">–</td>
                  <td className="search-log-cell-name">–</td>
                  <td className="search-log-cell-number">–</td>
                </tr>
              );
            }
            return searches.map((search, index) => (
              <tr key={search.id} className={`search-log-row ${index === 0 ? 'search-log-group-start' : ''}`}>
                {index === 0 && apiCell(searches.length)}
                <td className="search-log-cell-number">{search.requestCount}</td>
                <td className="search-log-cell-number">{formatDuration(Math.max(0, now - search.startedAt))}</td>
                <td className="search-log-cell-name" title={search.cardName}>{search.cardName}</td>
                <td className="search-log-cell-number">{search.count}</td>
              </tr>
            ));
          })}
        </tbody>
      </table>
    </div>
  );
}
