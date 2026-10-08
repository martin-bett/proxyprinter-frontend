import React, { useEffect, useMemo, useRef } from 'react';
import './PdfProgressDialog.css';
import { useTranslation } from 'react-i18next';
import ProgressBar from '../../components/progress/ProgressBar';

export type ProgressCategory = 'queued' | 'download' | 'build' | 'finishing';

/** Ein Eintrag aus GET /api/progress/{id}. */
export interface ProgressDto {
  progressId: string;
  category: ProgressCategory;
  message: string;
  current: number;
  total: number;
  pageCount: number | null;
  fileSize: number;
  error: boolean;
}

interface PdfProgressDialogProps {
  open: boolean;
  progressDtos: ProgressDto[];
  /** Fehler, der nicht vom Backend als ProgressDto kommt (z. B. Polling fehlgeschlagen). */
  errorMessage?: string | null;
  onFinish: (progressId: string) => void;
  onClose: () => void;
  /** Adresse, an die das Backend zusätzlich den Download-Link schickt. */
  email?: string;
}

const CATEGORY_ORDER: ProgressCategory[] = ['queued', 'download', 'build', 'finishing'];
const CATEGORY_LABEL_KEYS = {
  queued: 'pdf.progress.category.queued',
  download: 'pdf.progress.category.download',
  build: 'pdf.progress.category.build',
  finishing: 'pdf.progress.category.finishing',
} as const;

/** Kurze Pause, damit der fertige Balken sichtbar ist, bevor der Download startet. */
const FINISH_DELAY_MS = 800;

export const formatFileSize = (bytes: number): string => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

export const isFinished = (dto: ProgressDto | undefined): boolean =>
  !!dto && dto.category === 'finishing' && !dto.error && dto.fileSize > 0;

const PdfProgressDialog: React.FC<PdfProgressDialogProps> = ({ open, progressDtos, errorMessage, onFinish, onClose, email }) => {
  const { t } = useTranslation();
  // Letzter Eintrag je Kategorie
  const latestByCategory = useMemo(() => {
    const map: Partial<Record<ProgressCategory, ProgressDto>> = {};
    for (const dto of progressDtos) {
      if (dto?.category) map[dto.category] = dto;
    }
    return map;
  }, [progressDtos]);

  const lastDto = progressDtos.length > 0 ? progressDtos[progressDtos.length - 1] : undefined;
  const backendError = lastDto?.error ? lastDto.message : null;
  const error = errorMessage || backendError;
  const finishedDto = isFinished(latestByCategory.finishing) ? latestByCategory.finishing : undefined;

  // Download genau einmal pro Job auslösen
  const finishedIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!open) {
      finishedIdRef.current = null;
      return;
    }
    if (!finishedDto || finishedIdRef.current === finishedDto.progressId) return;
    finishedIdRef.current = finishedDto.progressId;
    const timeout = setTimeout(() => onFinish(finishedDto.progressId), FINISH_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [open, finishedDto, onFinish]);

  if (!open) return null;

  // Ein bereits gecachtes PDF springt direkt auf "finishing": vorige Phasen gelten dann als erledigt.
  const reachedIndex = lastDto ? CATEGORY_ORDER.indexOf(lastDto.category) : -1;

  return (
    <div className="pdf-progress-dialog">
      <h3>{t('pdf.progress.title')}</h3>
      <div className="pdf-progress-rows">
        {CATEGORY_ORDER.map((category, index) => {
          const dto = latestByCategory[category];
          const passed = index < reachedIndex || !!finishedDto;
          const active = !passed && index === reachedIndex;
          const failed = active && !!error;
          const ratio = passed ? 1 : dto && dto.total > 0 ? dto.current / dto.total : 0;
          const indeterminate = active && !failed && (!dto || dto.total === 0);
          const state = failed ? 'is-error' : passed ? 'is-done' : active ? 'is-active' : 'is-pending';

          return (
            <div className={`pdf-progress-row ${state}`} key={category}>
              <div className="pdf-progress-row-header">
                <span className="pdf-progress-label">{t(CATEGORY_LABEL_KEYS[category])}</span>
                <span className="pdf-progress-meta">
                  {category === 'queued' && active && dto && dto.total > 0 && dto.current > 0 && (
                    <span>{t('pdf.progress.queuePosition', { current: dto.current, total: dto.total })}</span>
                  )}
                  {(category === 'download' || category === 'build') && dto && dto.total > 0 && (
                    <span>{dto.current}/{dto.total}</span>
                  )}
                  {category === 'build' && dto?.pageCount ? (
                    <span>{t('pdf.progress.pageCount', { count: dto.pageCount })}</span>
                  ) : null}
                  {category !== 'queued' && dto?.fileSize ? <span>{formatFileSize(dto.fileSize)}</span> : null}
                </span>
              </div>
              {category === 'queued' ? (
                <div className={`pdf-progress-queue${state === 'is-pending' ? ' app-progress-pending-stripes' : ''}`}>
                  <div
                    className="pdf-progress-queue-ball"
                    style={{
                      left: passed ? '100%'
                        : dto && dto.total > 0 && dto.current > 0 ? `${((dto.total - dto.current) / dto.total) * 100}%` : '0%',
                    }}
                  />
                </div>
              ) : (
                <ProgressBar
                  value={ratio}
                  indeterminate={indeterminate}
                  state={failed ? 'error' : passed ? 'done' : active ? 'active' : 'pending'}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className={`pdf-progress-message${error ? ' is-error' : ''}`}>
        {error || lastDto?.message || t('pdf.progress.starting')}
      </div>
      {email && !error && (
        <div className="pdf-progress-email">{t('pdf.progress.emailNotice', { email })}</div>
      )}
      {error && (
        <div className="pdf-progress-actions">
          <button className="button" onClick={onClose}>{t('common.close')}</button>
        </div>
      )}
    </div>
  );
};

export default PdfProgressDialog;
