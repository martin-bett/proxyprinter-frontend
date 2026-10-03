import React, { useCallback, useEffect, useState } from 'react';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import SearchIcon from '@mui/icons-material/Search';
import DeleteIcon from '@mui/icons-material/Delete';
import ClosableDialog from '../../container/ClosableDialog';
import { imageLoaderService } from '../../service/cache/ImageLoaderService';
import SearchCacheService from '../../service/cache/SearchCacheService';
import { useImageLoaderNumbers } from '../../service/cache/hooks/useImageLoaderNumbers';
import CacheManagerDialog from './CacheManagerDialog';
import { CacheProgressBar } from './CacheProgressBar';
import QueueManagerDialog from './QueueManagerDialog';
import SearchCacheManagerDialog from './SearchCacheManagerDialog';
import './MemoryButtons.css';

// Icon-Bubbles oben rechts: Download-Queue, Such-Cache und Bild-Cache mit ihren Dialogen
export default function MemoryButtons() {
  const { queued, active, cacheLoading } = useImageLoaderNumbers();
  const [searchCount, setSearchCount] = useState(0);
  const [queueDialogOpen, setQueueDialogOpen] = useState(false);
  const [searchCacheDialogOpen, setSearchCacheDialogOpen] = useState(false);
  const [imageCacheDialogOpen, setImageCacheDialogOpen] = useState(false);

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
        <button className="memory-button" title="Wartende Downloads" onClick={openQueueDialog}>
          <AccessTimeIcon />
          <span className="memory-button-count">{queued}</span>
        </button>
        <button className="memory-button" title="Aktive Downloads" onClick={openQueueDialog}>
          <DownloadIcon />
          <span className="memory-button-count">{active}</span>
        </button>
        <button className="memory-button" title="Cache-Ladevorgänge" onClick={openQueueDialog}>
          <UploadIcon />
          <span className="memory-button-count">{cacheLoading}</span>
        </button>
        <button className="memory-button" title="Search Cache anzeigen" onClick={() => setSearchCacheDialogOpen(true)}>
          <SearchIcon />
          <span className="memory-button-count">{searchCount}</span>
        </button>
        <button className="memory-button" title="Cache anzeigen" onClick={openImageCacheDialog}>
          <CacheProgressBar width={120} />
        </button>
        <button className="memory-button" title="Cache leeren" onClick={() => imageLoaderService.clearCache()}>
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
    </>
  );
}
