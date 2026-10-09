import React from 'react';
import { useTranslation } from 'react-i18next';
import { imageLoaderService } from '../../service/cache/ImageLoaderService';
import { useImageLoaderCache } from '../../service/cache/hooks/useImageLoaderCache';
import ProgressBar from '../../components/progress/ProgressBar';

interface CacheProgressBarProps {
  onClick?: () => void;
  width?: number;
}

/** Ab diesem Füllstand wird der Akzentfarbe zunehmend Rot beigemischt, bei 100 % ist der Balken rot. */
const RED_FROM_PERCENT = 50;

export const cacheFillColor = (percent: number): string => {
  const red = Math.round(Math.max(0, Math.min(1, (percent - RED_FROM_PERCENT) / (100 - RED_FROM_PERCENT))) * 100);
  return red === 0 ? 'var(--accent)' : `color-mix(in oklab, var(--danger) ${red}%, var(--accent))`;
};

export function CacheProgressBar({ onClick, width = 180 }: CacheProgressBarProps) {
  const { t } = useTranslation();
  const { totalSize } = useImageLoaderCache();
  const cacheLimit = imageLoaderService.cacheLimit;
  const percent = Math.min(100, Math.round((totalSize / cacheLimit) * 100));

  return (
    <div className="cache-progressbar-container" style={{ width }}>
      <ProgressBar
        value={percent / 100}
        height={18}
        color={cacheFillColor(percent)}
        label={`${percent}%`}
        title={t('cache.progressTitle', { used: Math.round(totalSize / (1024 * 1024)), limit: Math.round(cacheLimit / (1024 * 1024)) })}
        onClick={onClick}
      />
    </div>
  );
}
