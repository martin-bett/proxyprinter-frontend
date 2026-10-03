import { useImageLoaderCacheNumbers } from '../../service/cache/hooks/useImageLoaderCacheNumbers';
import { useRef, useEffect, useState } from 'react';

export function CacheProgressBar({ onClick }) {
  const { imgCount, current, limit } = useImageLoaderCacheNumbers();

  // Lokaler State für die letzten bekannten Werte
  const [display, setDisplay] = useState({ imgCount: 0, current: 0, limit: 1 });
  const timeoutRef = useRef();

  useEffect(() => {
    // Nur aktualisieren, wenn Werte > 0 oder sich wirklich ändern
    if (
      (imgCount !== 0 || current !== 0) &&
      (imgCount !== display.imgCount || current !== display.current || limit !== display.limit)
    ) {
      setDisplay({ imgCount, current, limit });
    }
    // Wenn Hook 0 liefert, nach kurzer Zeit trotzdem auf 0 setzen (z.B. nach clear)
    if (imgCount === 0 && current === 0) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setDisplay({ imgCount, current, limit });
      }, 500); // 0.5s warten, falls gleich neue Werte kommen
    }
    return () => clearTimeout(timeoutRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imgCount, current, limit]);

  const percent = Math.min(100, Math.round((display.current / display.limit) * 100));
  const color =
    percent > 90 ? "#5a3577" : percent > 70 ? "#a084ca" : "#6bb6e9";

  return (
    <div style={{ width: "100%" }}>
      <div
        className="cache-progressbar-container"
        style={{
          cursor: "pointer",
          width: "auto",
          minWidth: 150,
          height: 10,
          background: "#eee",
          borderRadius: 8,
          overflow: "hidden",
          border: "1px solid #bbb",
          position: "relative",
          userSelect: "none",
        }}
        title={`${Math.round(display.current / (1024 * 1024))}/${Math.round(display.limit / (1024 * 1024))} MB`}
        onClick={onClick}>
        <div
          className="cache-progressbar-fill"
          style={{
            width: `${percent}%`,
            height: "100%",
            background: color,
          }}
        />
        <span
          style={{
            position: "absolute",
            left: 0,
            width: "100%",
            textAlign: "center",
            fontSize: 12,
            color: "#222",
            fontWeight: 600,
            lineHeight: "18px",
            pointerEvents: "none",
          }}
        >
          {percent}%
        </span>
      </div>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        fontSize: 12,
        marginTop: 2,
        color: "#5a3577",
        fontWeight: 500,
        padding: "0 2px"
      }}>
        <span>{display.imgCount} imgs</span>
        <span>
          {Math.round(display.current / (1024 * 1024))}/{Math.round(display.limit / (1024 * 1024))} MB
        </span>
      </div>
    </div>
  );
}