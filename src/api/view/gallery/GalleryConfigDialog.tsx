import React, { useState, useEffect } from 'react';
import FingerprintJS from '@fingerprintjs/fingerprintjs';
import { Alert, LinearProgress } from '@mui/material';
import ConfigContainer from '../ConfigContainer';
import GalleryConfigWizard, { GalleryConfigFormState } from './GalleryConfigWizard';
import GalleryConfigExecutor from './GallerConfigExecutor';
import ApiFactory, { Config, GalleryConfig, SearchResult } from '../../../service/ApiFactory';

interface GalleryConfigDialogProps {
    open?: boolean;
    onClose: () => void;
    handleGalleryResults: (results: SearchResult[]) => void;
}

const GalleryConfigDialog: React.FC<GalleryConfigDialogProps> = ({ onClose, handleGalleryResults }) => {
    const [configs, setConfigs] = useState<Config[]>([]);
    const [selectedConfigs, setSelectedConfigs] = useState<number[]>([]);
    const [clickedConfig, setClickedConfig] = useState<Config | null>(null); //
    const [fingerprint, setFingerprint] = useState<string | null>(null);
    const [galleryStatus, setGalleryStatus] = useState<{ loading: boolean; error?: string }>({ loading: false });

    useEffect(() => {
        const initFingerprint = async () => {
          const fp = await FingerprintJS.load();
          const result = await fp.get();
          setFingerprint(result.visitorId);
        };
        initFingerprint();
      }, []);

    const fetchGalleryResults = async (config: GalleryConfig) => {
      const singleConfigRecord = {
        [config.name]: config,
      };
      const api = new ApiFactory(singleConfigRecord).createApi(config.name);
      setGalleryStatus({ loading: true });
      try {
        const result = await api({});
        console.log(result);
        if (result.results.length === 0) {
          // Dialog offen lassen, sonst sieht man nicht, dass nichts gefunden wurde
          setGalleryStatus({ loading: false, error: 'Keine Bilder gefunden.' });
          return;
        }
        setGalleryStatus({ loading: false });
        handleGalleryResults(result.results);
      } catch (error) {
        console.error(`Error fetching gallery ${config.name}:`, error);
        setGalleryStatus({ loading: false, error: error instanceof Error ? error.message : String(error) });
      }
    }

    const handleConfigOperation = async (method: string, operation: string, body?: unknown) => {
      try {
        const response = await fetch(`/api/gallery/${operation}`, {
          method: method,
          headers: {
            'Content-Type': 'application/json',
            'X-Fingerprint': fingerprint || '', // Falls benötigt
          },
          body: body ? JSON.stringify(body) : null
        });

        if (!response.ok) {
          throw new Error('Failed to create config');
        }

        const responseBody = await response.text();
        fetchGalleries();
      } catch (error) {
        console.error('Error creating config:', error);
      }
    }

    const handleCreateConfig = async () => {
      handleConfigOperation('GET', 'create');
    };

    const handleApiEdit = async (config: GalleryConfigFormState) => {
      handleConfigOperation('POST', 'edit', config);
    };

    const handleApiCopy = async (configId: number | undefined) => {
      const newConfig = {
        id: configId,
      };
      handleConfigOperation('POST', 'copy', newConfig);
    };
    const handleApiPublish = async (configId: number | undefined) => {
      const newConfig = {
        id: configId,
        published: !configs.find(c => c.id == configId)?.published
      };
      handleConfigOperation('POST', 'publish', newConfig);
    };

    const handleApiDelete = async (configId: number | undefined) => {
      const newConfig = {
        id: configId,
      };
      handleConfigOperation('POST', 'delete', newConfig);
    };

      useEffect(() => {
        if (fingerprint) {
          fetchGalleries();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [fingerprint]);


      const handleConfigItemClick = (config: Config, event: React.MouseEvent) => {
        // Prüfe, ob das geklickte Element oder seine Eltern spezielle klickbare Elemente sind
        let target = event.target as HTMLElement;
        console.log(event);
        while (target !== event.currentTarget) {
          if (
            target.tagName.toLowerCase() === 'a' ||
            (target as any).onclick
          ) {
            return;
          }
          target = target.parentElement as HTMLElement;
        }
        setClickedConfig(config);
        setSelectedConfigs([config.id]);
      };


      const fetchGalleries = async () => {
        try {
          const response = await fetch('/api/gallery', {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'X-Fingerprint': fingerprint || '',
            },
          });

          if (!response.ok) {
            throw new Error('Failed to fetch configs');
          }

          const data: Config[] = await response.json();
          setConfigs(data.sort((a,b) => ('' + a.category).localeCompare(b.category) ));
        } catch (error) {
          console.error('Error fetching configs:', error);
        }
      };

    return (<>
        {galleryStatus.loading && <LinearProgress sx={{ mb: 1 }} />}
        {galleryStatus.error && (
          <Alert severity="warning" sx={{ mb: 1 }} onClose={() => setGalleryStatus({ loading: false })}>
            {galleryStatus.error}
          </Alert>
        )}
        <ConfigContainer
            configs={configs}
            clickedConfig={clickedConfig}
            selectedConfigs={selectedConfigs}
            handleItemClick={handleConfigItemClick}
            handleExecute={fetchGalleryResults}
            />
        <GalleryConfigWizard initialConfig={clickedConfig}
              onClose={onClose}
              onPublish={(confId) => handleApiPublish(confId)}
              onDelete={(confId) => handleApiDelete(confId)}
              onCopy={(confId) => handleApiCopy(confId)}
              onSave={(conf) => handleApiEdit(conf)}
           />
    </>);
}

export default GalleryConfigDialog;
