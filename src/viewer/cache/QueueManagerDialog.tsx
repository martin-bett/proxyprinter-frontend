import React, { CSSProperties, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { imageLoaderService } from "../../service/cache/ImageLoaderService";
import { useImageLoaderQueue } from "../../service/cache/hooks/useImageLoaderQueue";

// Re-usable Trash Icon
function TrashIcon({ style = {} }: { style?: CSSProperties }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ ...style }}>
      <path d="M3 6h18M9 6v12m6-12v12M5 6v14a2 2 0 002 2h10a2 2 0 002-2V6" style={{ stroke: "var(--text-muted)" }} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

const cellStyle: CSSProperties = {
  border: "1px solid var(--border)",
  padding: 4,
  position: "relative",
  textAlign: "center",
  background: "var(--surface-muted)",
  cursor: "pointer"
};

interface QueueManagerDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function QueueManagerDialog({ open, onClose }: QueueManagerDialogProps) {
  const { t } = useTranslation();
  const queue = useImageLoaderQueue();

  // APIs und Sprachen dynamisch aus der Queue extrahieren
  const apis = useMemo(
    () => Array.from(new Set(queue.map(e => e.cardInput?.apiName).filter((v): v is string => Boolean(v)))),
    [queue]
  );
  const languages = useMemo(
    () => Array.from(new Set(queue.map(e => e.cardInput?.languageCode || "No Language"))),
    [queue]
  );

  if (!open) return null;

  return (
    <div className="queue-manager-dialog" style={{ background: "var(--surface)", color: "var(--text)", padding: 24, borderRadius: 8, maxWidth: 900, margin: "40px auto" }}>
      <h2>{t('cache.queue.title')}</h2>
      <div style={{ marginBottom: 12 }}>
        <b>{t('cache.queue.cancelApi')}</b>{" "}
        {apis.map(api => (
          <button key={api} style={{ margin: 2 }} onClick={() => imageLoaderService.stopQueueForApi(api)}>
            {api}
          </button>
        ))}
      </div>
      <div style={{ marginBottom: 12 }}>
        <b>{t('cache.queue.cancelLanguage')}</b>{" "}
        {languages.map(lang => (
          <button key={lang} style={{ margin: 2 }} onClick={() => imageLoaderService.stopQueueForLanguage(lang)}>
            {lang}
          </button>
        ))}
      </div>
      <table style={{ borderCollapse: "collapse", width: "100%", marginTop: 16 }}>
        <thead>
          <tr>
            <th style={cellStyle}>{t('cache.queue.columns.api')}</th>
            <th style={cellStyle}>{t('common.language')}</th>
            <th style={cellStyle}>{t('cache.queue.columns.cardName')}</th>
            <th style={cellStyle}>{t('common.url')}</th>
            <th style={cellStyle}>{t('cache.queue.columns.priority')}</th>
            <th style={cellStyle}>{t('cache.queue.columns.category')}</th>
            <th style={cellStyle}>{t('cache.queue.columns.action')}</th>
          </tr>
        </thead>
        <tbody>
          {queue.length === 0 && (
            <tr>
              <td colSpan={7} style={cellStyle}>{t('cache.queue.empty')}</td>
            </tr>
          )}
          {queue.map(entry => (
            <tr key={entry.cacheKey}>
              <td style={cellStyle}>{entry.cardInput?.apiName}</td>
              <td style={cellStyle}>{entry.cardInput?.languageCode || "No Language"}</td>
              <td style={cellStyle}>{entry.cardInput?.name}</td>
              <td style={{ ...cellStyle, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {entry.url}
              </td>
              <td style={cellStyle}>{entry.priority}</td>
              <td style={cellStyle}>{entry.category}</td>
              <td style={cellStyle}>
                <button
                  title={t('cache.queue.cancelEntry')}
                  onClick={() => imageLoaderService.removeFromQueueByCacheKey(entry.cacheKey)}
                  style={{ background: "none", border: "none", cursor: "pointer" }}
                >
                  <TrashIcon />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button style={{ marginTop: 16 }} onClick={onClose}>{t('common.close')}</button>
    </div>
  );
}
