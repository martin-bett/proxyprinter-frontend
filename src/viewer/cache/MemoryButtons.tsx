import React, { useCallback, useEffect, useState } from 'react';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import SearchIcon from '@mui/icons-material/Search';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { useTranslation } from 'react-i18next';
import ActionButton from '../../container/inputs/ActionButton';
import ClosableDialog from '../../container/ClosableDialog';
import SearchCacheService from '../../service/cache/SearchCacheService';
import { useImageLoaderNumbers } from '../../service/cache/hooks/useImageLoaderNumbers';
import { formatRate, useDownloadRate } from '../../service/cache/hooks/useDownloadRate';
import { useFadePresence } from '../../container/useFadePresence';
import CacheManagerDialog from './CacheManagerDialog';
import { CacheProgressBar } from './CacheProgressBar';
import QueueManagerDialog from './QueueManagerDialog';
import SearchCacheManagerDialog from './SearchCacheManagerDialog';
import './MemoryButtons.css';

interface MemoryButtonsProps {
  /** Leert Decklist, Suchergebnisse und Auswahl */
  onResetDeck: () => Promise<void> | void;
  resetDisabled?: boolean;
}

const FADE_MS = 500;

// Icon-Bubbles oben rechts: Download-Queue, Such-Cache und Bild-Cache mit ihren Dialogen,
// ganz rechts der Papierkorb zum Zurücksetzen des Decks (mit Rückfrage)
export default function MemoryButtons({ onResetDeck, resetDisabled }: MemoryButtonsProps) {
  const { t } = useTranslation();
  const { queued, active, cacheLoading } = useImageLoaderNumbers();
  const [searchCount, setSearchCount] = useState(0);
  const [queueDialogOpen, setQueueDialogOpen] = useState(false);
  const [searchCacheDialogOpen, setSearchCacheDialogOpen] = useState(false);
  const [imageCacheDialogOpen, setImageCacheDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  const updateSearchCount = useCallback(async () => {
    setSearchCount(await SearchCacheService.getSearchCount());
  }, []);

  // Neue Suchen landen ohne Event im Cache, daher regelmäßig nachzählen
  useEffect(() => {
    updateSearchCount();
    const interval = setInterval(updateSearchCount, 5000);
    return () => clearInterval(interval);
  }, [updateSearchCount]);

  const openQueueDialog = () => setQueueDialogOpen(true);
  const openImageCacheDialog = () => setImageCacheDialogOpen(true);
  // Download-Bubbles nur zeigen, solange etwas geladen oder eingereiht wird, mit weichem Ein- und Ausblenden
  const downloadsIdle = queued === 0 && active === 0;
  const { mounted: downloadsMounted, shown: downloadsShown } = useFadePresence(!downloadsIdle, FADE_MS);
  const fadeClass = `memory-fade${downloadsShown ? ' is-visible' : ''}`;
  const downloadRate = useDownloadRate(active > 0);

  return (
    <>
      <div className="memory-buttons-bar" data-tour="memory-buttons">
        {downloadsMounted && (
          <>
            <button className={`memory-button ${fadeClass}`} data-tour="queue-waiting" title={t('cache.buttons.waitingDownloads')} onClick={openQueueDialog}>
              <AccessTimeIcon />
              <span className="memory-button-count">{queued}</span>
            </button>
            <button
              className={`memory-button ${fadeClass}`}
              title={downloadRate > 0 ? t('cache.buttons.activeDownloadsRate', { rate: formatRate(downloadRate) }) : t('cache.buttons.activeDownloads')}
              onClick={openQueueDialog}
            >
              <DownloadIcon />
              <span className="memory-button-count">{active}</span>
            </button>
          </>
        )}
        <button className="memory-button" title={t('cache.buttons.cacheLoadingQueue')} onClick={openQueueDialog}>
          <UploadIcon />
          <span className="memory-button-count">{cacheLoading}</span>
        </button>
        <button className="memory-button" data-tour="search-cache" title={t('cache.buttons.showSearchCache')} onClick={() => setSearchCacheDialogOpen(true)}>
          <SearchIcon />
          <span className="memory-button-count">{searchCount}</span>
        </button>
        <button className="memory-button" data-tour="image-cache" title={t('cache.buttons.showImageCache')} onClick={openImageCacheDialog}>
          <CacheProgressBar width={120} />
        </button>
        <button
          className="memory-button"
          data-tour="reset-deck"
          title={t('cache.buttons.resetDeck')}
          onClick={() => setResetDialogOpen(true)}
          disabled={resetDisabled}
        >
          <DeleteIcon />
        </button>
      </div>

      <ClosableDialog open={queueDialogOpen} onClose={() => setQueueDialogOpen(false)} maxWidth="md">
        <QueueManagerDialog open={queueDialogOpen} onClose={() => setQueueDialogOpen(false)} />
      </ClosableDialog>

      <ClosableDialog
        open={searchCacheDialogOpen}
        onClose={() => {
          setSearchCacheDialogOpen(false);
          updateSearchCount();
        }}
        maxWidth="md"
      >
        <SearchCacheManagerDialog
          open={searchCacheDialogOpen}
          onClose={() => setSearchCacheDialogOpen(false)}
          onChange={updateSearchCount}
        />
      </ClosableDialog>

      <ClosableDialog open={imageCacheDialogOpen} onClose={() => setImageCacheDialogOpen(false)} maxWidth="md">
        <CacheManagerDialog open={imageCacheDialogOpen} onClose={() => setImageCacheDialogOpen(false)} />
      </ClosableDialog>

      <ClosableDialog open={resetDialogOpen} onClose={() => setResetDialogOpen(false)} maxWidth="xs">
        <div className="reset-deck-dialog">
          <h2>{t('cache.buttons.resetDialog.title')}</h2>
          <p>{t('cache.buttons.resetDialog.text')}</p>
          <div className="reset-deck-actions">
            <ActionButton icon={<CloseIcon />} onClick={() => setResetDialogOpen(false)}>
              {t('common.cancel')}
            </ActionButton>
            <ActionButton
              icon={<RestartAltIcon />}
              className="is-danger"
              onClick={async () => {
                setResetDialogOpen(false);
                await onResetDeck();
              }}
            >
              {t('common.reset')}
            </ActionButton>
          </div>
        </div>
      </ClosableDialog>
    </>
  );
}
