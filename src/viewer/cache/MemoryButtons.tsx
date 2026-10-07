import React, { useCallback, useEffect, useState } from 'react';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import DownloadIcon from '@mui/icons-material/Download';
import SearchIcon from '@mui/icons-material/Search';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import ActionButton from '../../container/inputs/ActionButton';
import ClosableDialog from '../../container/ClosableDialog';
import SearchCacheService from '../../service/cache/SearchCacheService';
import { useImageLoaderNumbers } from '../../service/cache/hooks/useImageLoaderNumbers';
import CacheManagerDialog from './CacheManagerDialog';
import { CacheProgressBar } from './CacheProgressBar';
import QueueManagerDialog from './QueueManagerDialog';
import SearchCacheManagerDialog from './SearchCacheManagerDialog';
import './MemoryButtons.css';

interface MemoryButtonsProps {
  onResetDeck: () => Promise<void> | void;
  resetDisabled?: boolean;
}

// Icon-Bubbles oben rechts: Download-Queue, Such-Cache und Bild-Cache mit ihren Dialogen,
// ganz rechts der Papierkorb zum Zurücksetzen des Decks (mit Rückfrage)
export default function MemoryButtons({ onResetDeck, resetDisabled }: MemoryButtonsProps) {
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

  return (
    <>
      <div className="memory-buttons-bar">
        <button className="memory-button" title="Pending Downloads" onClick={openQueueDialog}>
          <AccessTimeIcon />
          <span className="memory-button-count">{queued}</span>
        </button>
        <button className="memory-button" title="Active Downloads" onClick={openQueueDialog}>
          <DownloadIcon />
          <span className="memory-button-count">{active}</span>
        </button>
        <button className="memory-button" title="Show Search Cache" onClick={() => setSearchCacheDialogOpen(true)}>
          <SearchIcon />
          <span className="memory-button-count">{searchCount}</span>
        </button>
        <button className="memory-button" title="Show Cache" onClick={openImageCacheDialog}>
          <CacheProgressBar width={120} />
        </button>
        <button
          className="memory-button"
          title="Reset Deck"
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
          <h2>Reset Deck?</h2>
          <p>Decklist, search results, and image selection will be cleared. The current state is saved as a snapshot first.</p>
          <div className="reset-deck-actions">
            <ActionButton icon={<CloseIcon />} onClick={() => setResetDialogOpen(false)}>
              Cancel
            </ActionButton>
            <ActionButton
              icon={<RestartAltIcon />}
              className="is-danger"
              onClick={async () => {
                setResetDialogOpen(false);
                await onResetDeck();
              }}
            >
              Reset
            </ActionButton>
          </div>
        </div>
      </ClosableDialog>
    </>
  );
}
