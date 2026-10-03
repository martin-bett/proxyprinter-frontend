import React from 'react';
import { imageLoaderService } from '../../service/cache/ImageLoaderService';
import { useImageLoaderCache } from '../../service/cache/hooks/useImageLoaderCache';

interface CacheProgressBarProps {
  onClick?: () => void;
}

export function CacheProgressBar({ onClick }: CacheProgressBarProps) {
  const { totalSize } = useImageLoaderCache();
  const cacheLimit = imageLoaderService.cacheLimit;
  const percent = Math.min(100, Math.round((totalSize / cacheLimit) * 100));
  const color =
    percent > 90 ? "var(--danger)" : percent > 70 ? "var(--warning)" : "var(--success)";

  return (
    <div
      className="cache-progressbar-container"
      style={{
        cursor: "pointer",
        width: 180,
        height: 18,
        background: "var(--track)",
        borderRadius: 8,
        overflow: "hidden",
        border: "1px solid var(--border)",
        position: "relative",
        userSelect: "none",
      }}
      title={`Cache: ${Math.round(totalSize / (1024 * 1024))} MB / ${Math.round(cacheLimit / (1024 * 1024))} MB`}
      onClick={onClick}>
      <div
        className="cache-progressbar-fill"
        style={{
          width: `${percent}%`,
          height: "100%",
          background: color,
          transition: "width 0.3s",
        }}
      />
      <span
        style={{
          position: "absolute",
          left: 0,
          width: "100%",
          textAlign: "center",
          fontSize: 12,
          color: "var(--text)",
          fontWeight: 600,
          lineHeight: "18px",
          pointerEvents: "none",
        }}
      >
        {percent}%
      </span>
    </div>
  );
}
