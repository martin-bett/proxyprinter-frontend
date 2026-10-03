import React, { useEffect, useMemo, useRef, useState } from "react";
import "./PdfProgressDialog.css";

const CATEGORY_ORDER = ["queued", "download", "build", "finishing"];
const CATEGORY_LABELS = {
  queued: "Queued",
  download: "Download",
  build: "Build",
  finishing: "Finishing"
};
const CATEGORY_COLORS = {
  queued: "#f7b801",
  download: "#6a8cff",
  build: "#a084ca",
  finishing: "#43aa8b"
};

const PdfProgressDialog = ({ open, progressDtos, onFinish, onError }) => {
  // Finde für jede Kategorie das letzte DTO
  const progressByCategory = useMemo(() => {
    const map = {};
    // Von hinten nach vorne, damit das erste gefundene das letzte ist
    for (let i = progressDtos.length - 1; i >= 0; i--) {
      const dto = progressDtos[i];
      if (dto && dto.category && !map[dto.category]) {
        map[dto.category] = dto;
      }
    }
    console.log("mapafter update", map);
    return map;
  }, [progressDtos]);

  const [finishTimeoutStarted, setFinishTimeoutStarted] = useState(false);
  const timeoutRef = useRef();

  // Callback für Abschluss/Fehler
  useEffect(() => {
    const finishing = progressByCategory.finishing;

    // Wenn Dialog geschlossen oder kein finishing mehr: Timeout zurücksetzen
    if (!open || !finishing) {
      setFinishTimeoutStarted(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    // Nur Timeout setzen, wenn noch keiner läuft und finishing fertig ist
    if (finishing.fileSize > 0 && !finishTimeoutStarted) {
      setFinishTimeoutStarted(true);
      timeoutRef.current = setTimeout(() => {
        onFinish && onFinish(finishing.progressId);
        setFinishTimeoutStarted(false);
        timeoutRef.current = null;
      }, 2000);
    }

    // Fehlerfall
    if (finishing.fileSize === 0) {
      onError && onError();
    }

    // Cleanup NUR beim Unmount oder wenn open/finishing sich ändert
    // (nicht bei jedem Poll)
    return () => {
      // Nur aufräumen, wenn Dialog geschlossen wird oder finishing verschwindet
      if (!open || !finishing) {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      }
    };
  }, [open, progressByCategory, onFinish, onError, finishTimeoutStarted]);

  if (!open) return null;

  // Die aktuellste Message anzeigen (letztes DTO)
  const lastDto = progressDtos.length > 0 ? progressDtos[progressDtos.length - 1] : null;

  function formatFilesize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }

  const categories = CATEGORY_ORDER.map(cat => {
    const dto = progressByCategory[cat];
    const color = CATEGORY_COLORS[cat];
    let progress = NaN;
    let filesize = 0;

    if (dto) {
      progress = dto.total > 0 ? dto.current / dto.total : 0;
      filesize = dto.fileSize;
    }

    return {
      name: cat,
      label: CATEGORY_LABELS[cat],
      color,
      progress,
      filesize,
      current: dto?.current || 0,
      total: dto?.total || 0,
      done: dto?.fileSize > 0
    };
  });

  return (
    <div className="pdf-progress-dialog">
      <div className="progress-multi-bar full-width">
        {categories.map(cat => (
          <div className="progress-row" key={cat.name}>
            <div className="progress-row-header is-5" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <span className="progress-category-label" style={{ marginRight: '1.5rem' }}>{cat.label}</span>
              {cat.current > 0 && cat.name != 'finishing' && <span className="filesize-label">{cat.current}/{cat.total}</span>}
              {cat.name === 'queued' ? 
              (
                <></>
              ):
              (
              <span className="filesize-label">{cat.filesize ? formatFilesize(cat.filesize) : ''}</span>
              )}
              
            </div>
           {cat.name === 'queued' ? (
              <div className="progress-bar-queue">
                <div
                  className="queue-ball"
                  style={{
                    left: cat.total > 1 ? `${((cat.current - 1) / (cat.total - 1)) * 100}%` : '0%',
                    background: 'linear-gradient(135deg, var(--color-primary-1) 0%, var(--color-primary-2) 100%)'
                  }}
                />
              </div>
            ) : (
              <div className="progress-bar-outer">
                {!Number.isNaN(cat.progress) ? (
                  <div
                    className={`progress-bar-inner category-${cat.name}`}
                    style={{ background: 'linear-gradient(90deg, var(--color-primary-1) 0%, var(--color-primary-2) 100%)', width: `${cat.progress * 100}%` }}
                  >
                    &nbsp;
                  </div>
                ) : (
                  <div
                    className={`progress-bar-inner category-${cat.name} progress-bar-indeterminate`}
                    style={{ width: '100%' }}
                  >
                     &nbsp;
                    {/* Dauer-Progress */}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="progress-message">
        {lastDto?.message}
      </div>
    </div>
  );
};

export default PdfProgressDialog;