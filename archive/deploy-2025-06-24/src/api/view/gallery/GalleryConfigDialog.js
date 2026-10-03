import React, { useState, useEffect } from 'react';
import FingerprintJS from '@fingerprintjs/fingerprintjs';
import ConfigContainer from '../ConfigContainer';
import GalleryConfigWizard from './GalleryConfigWizard';
import ApiFactory from '../../../service/ApiFactory';
import {Box} from '@mui/material';

const GalleryConfigDialog = ({ open, onClose, handleGalleryResults }) => {
  const [configs, setConfigs] = useState([]);
  const [selectedConfigs, setSelectedConfigs] = useState([]);
  const [clickedConfig, setClickedConfig] = useState(null); // 
  const [fingerprint, setFingerprint] = useState(null);

  useEffect(() => {
    const initFingerprint = async () => {
      const fp = await FingerprintJS.load();
      const result = await fp.get();
      setFingerprint(result.visitorId);
    };
    initFingerprint();
  }, []);

  const fetchGalleryResults = async (config) => {
    const singleConfigRecord = {
      [config.name]: config,
    };
    const api = new ApiFactory(singleConfigRecord).createApi(config.name);
    const result = await api({});
    handleGalleryResults(result.results);
    console.log(result);
  }

  const handleConfigOperation = async (method, operation, body) => {
    try {
      const response = await fetch(`/api/gallery/${operation}`, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'X-Fingerprint': fingerprint, // Falls benötigt
        },
        body: body ? JSON.stringify(body) : null
      });

      if (!response.ok) {
        throw new Error('Failed to create config');
      }

      const responseBody = await response.text();
      fetchGalleries(Number(responseBody));
    } catch (error) {
      console.error('Error creating config:', error);
    }
  }

  const handleCreateConfig = async () => {
    handleConfigOperation('GET', 'create');
  };

  const handleApiEdit = async (config) => {
    handleConfigOperation('POST', 'edit', config);
  };

  const handleApiCopy = async (configId) => {
    const newConfig = {
      id: configId,
    };
    handleConfigOperation('POST', 'copy', newConfig);
  };
  const handleApiPublish = async (configId) => {
    const newConfig = {
      id: configId,
      published: !configs.find(c => c.id == configId).published
    };
    handleConfigOperation('POST', 'publish', newConfig);
  };

  const handleApiDelete = async (configId) => {
    const newConfig = {
      id: configId,
    };
    handleConfigOperation('POST', 'delete', newConfig);
  };

  useEffect(() => {
    if (fingerprint) {
      fetchGalleries();
    }
  }, [fingerprint]);


  const handleConfigItemClick = (config, event) => {
    // Prüfe, ob das geklickte Element oder seine Eltern spezielle klickbare Elemente sind
    let target = event.target;
    console.log(event);
    while (target !== event.currentTarget) {
      if (
        target.tagName.toLowerCase() === 'a' ||
        target.onclick
      ) {
        return;
      }
      target = target.parentElement;
    }
    setClickedConfig(config, event);
    setSelectedConfigs([config.id]);
  };


  const fetchGalleries = async (clickedGallery) => {
    try {
      const response = await fetch('/api/gallery', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Fingerprint': fingerprint,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch configs');
      }

      const data = await response.json();
      setConfigs(data.sort((a, b) => ('' + a.category).localeCompare(b.category)));
      //   setClickedConfig(data.find(c => c.id == clickedGallery));
    } catch (error) {
      console.error('Error fetching configs:', error);
    }
  };

  return (<>
    <Box>
      <ConfigContainer
        configs={configs}
        clickedConfig={clickedConfig}
        selectedConfigs={selectedConfigs}
        handleItemClick={handleConfigItemClick}
        handleExecute={fetchGalleryResults}
      />
    </Box>
    <Box>
      <GalleryConfigWizard initialConfig={clickedConfig}
        onClose={onClose}
        onPublish={(confId) => handleApiPublish(confId)}
        onDelete={(confId) => handleApiDelete(confId)}
        onCopy={(confId) => handleApiCopy(confId)}
        onSave={(conf) => handleApiEdit(conf)}
      />
    </Box>
  </>);
}

export default GalleryConfigDialog;