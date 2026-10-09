import { useTranslation } from 'react-i18next';
import React, { useCallback, useEffect, useState } from 'react';
import DownloadIcon from '@mui/icons-material/Download';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import StorageIcon from '@mui/icons-material/Storage';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import { imageLoaderService } from '../../service/cache/ImageLoaderService';
import { formatRate, useDownloadRate } from '../../service/cache/hooks/useDownloadRate';

const CACHE_STATS_INTERVAL_MS = 5000;

const formatMegabytes = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

interface ImageSelectStatsProps {
  open: boolean;
  /** Karte, deren gecachte Bilder angezeigt und gelöscht werden */
  cardName?: string;
  counts: { loading: number; queued: number; done: number };
}

// Zeile oben im Bildauswahl-Dialog: Download-Zähler der Kacheln und Cache der Karte.
// Eigene Komponente, damit die Rate jede Sekunde nur diese Zeile neu rendert, nicht das ganze Grid.
const ImageSelectStats: React.FC<ImageSelectStatsProps> = ({ open, cardName, counts }) => {
  const { t } = useTranslation();
  const rate = useDownloadRate(open && counts.loading > 0);
  const [cache, setCache] = useState({ count: 0, bytes: 0 });

  const refreshCache = useCallback(async () => {
    if (!cardName) return;
    setCache(await imageLoaderService.getCacheStatsForCardName(cardName));
  }, [cardName]);

  // Gecachte Bilder kommen und gehen auch außerhalb des Dialogs, daher regelmäßig nachzählen
  useEffect(() => {
    if (!open) return;
    refreshCache();
    const interval = setInterval(refreshCache, CACHE_STATS_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [open, refreshCache]);

  const clearCache = async () => {
    if (!cardName) return;
    await imageLoaderService.clearCacheForCardName(cardName);
    refreshCache();
  };

  return (
    <div className="image-select-stats">
      <span className="image-select-stat" title={t('imageSelect.stats.downloading')}>
        <DownloadIcon fontSize="small" /> <b>{counts.loading}</b>
        <span className="image-select-stat-value">({formatRate(rate)})</span>
      </span>
      <span className="image-select-stat" title={t('imageSelect.stats.queued')}>
        <AccessTimeIcon fontSize="small" /> <b>{counts.queued}</b>
      </span>
      <span className="image-select-stat" title={t('imageSelect.stats.loaded')}>
        <CheckCircleOutlineIcon fontSize="small" /> <b>{counts.done}</b>
      </span>
      <span className="image-select-stat" title={t('imageSelect.stats.cached')}>
        <StorageIcon fontSize="small" /> <b>{cache.count}</b>
        <span className="image-select-stat-value">({formatMegabytes(cache.bytes)})</span>
      </span>
      <button
        type="button"
        className="image-select-stat-action"
        title={t('imageSelect.stats.removeCached')}
        onClick={clearCache}
        disabled={cache.count === 0}
      >
        <DeleteSweepIcon fontSize="small" />
      </button>
    </div>
  );
};

export default ImageSelectStats;
