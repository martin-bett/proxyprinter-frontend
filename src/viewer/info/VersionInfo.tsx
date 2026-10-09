import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

// Beim Build gesetzt (scripts/react-scripts.js), UTC yyyyMMdd-HHmm
const FRONTEND_BUILD = process.env.REACT_APP_BUILD_NUMBER;

// Reihenfolge der Zeilen unter der Build-Nummer, Schlüssel wie in GET /api/stats und version.stats.* in en.json
export const STAT_KEYS = ['sharedSearches', 'tempImages', 'cachedPdfs', 'decksToday', 'decksTotal'] as const;
type Stats = Partial<Record<typeof STAT_KEYS[number], number>>;

interface VersionInfoProps {
    /** Ändert sich, wenn die Zahlen neu geladen werden sollen (z. B. nach einem PDF-Download). */
    statsRefreshKey?: number;
}

const VersionInfo: React.FC<VersionInfoProps> = ({ statsRefreshKey = 0 }) => {
    const { t, i18n } = useTranslation();
    const [backendBuild, setBackendBuild] = useState<string>();
    const [stats, setStats] = useState<Stats>({});

    useEffect(() => {
        fetch('/api/version')
            .then(r => (r.ok ? r.json() : undefined))
            .then(v => { if (typeof v?.build === 'string') setBackendBuild(v.build); })
            .catch(() => undefined);
    }, []);

    // Nur beim Seitenaufruf und wenn statsRefreshKey sich ändert, kein Polling
    useEffect(() => {
        fetch('/api/stats')
            .then(r => (r.ok ? r.json() : undefined))
            .then(s => {
                if (!s || typeof s !== 'object') return;
                const next: Stats = {};
                STAT_KEYS.forEach(key => { if (typeof s[key] === 'number') next[key] = s[key]; });
                setStats(next);
            })
            .catch(() => undefined);
    }, [statsRefreshKey]);

    const format = new Intl.NumberFormat(i18n.language);

    return (
        <div className="version-info">
            <div>v0.3</div>
            {FRONTEND_BUILD && <div className="version-build">{t('version.build', { number: FRONTEND_BUILD })}</div>}
            {backendBuild && <div className="version-build">{t('version.backendBuild', { number: backendBuild })}</div>}
            {STAT_KEYS.map(key => stats[key] !== undefined && (
                <div key={key} className="version-build">
                    {t(`version.stats.${key}`, { count: stats[key], number: format.format(stats[key]!) })}
                </div>
            ))}
        </div>
    );
}
export default VersionInfo;
