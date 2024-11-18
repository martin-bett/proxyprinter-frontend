import React, { useState, useEffect } from 'react';
import { Star, Plus } from 'lucide-react';
import FingerprintJS from '@fingerprintjs/fingerprintjs';
import '../viewer/ApiConfigDialog.css';
import ApiConfigWizard from '../api/ApiConfigWizard';
import TranslateIcon from '@mui/icons-material/Translate';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import PublicIcon from '@mui/icons-material/Public';
import LockIcon from '@mui/icons-material/Lock';
import PaletteIcon from '@mui/icons-material/Palette';
import ApiRating from '../api/ApiRating';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

const ApiConfigDialog = ({ open, onClose, onSave }) => {
  const [configs, setConfigs] = useState([]);
  const [selectedConfigs, setSelectedConfigs] = useState([]);
  const [clickedConfig, setClickedConfig] = useState(null); // Speichert die ausgewählte Konfiguration
  const [fingerprint, setFingerprint] = useState(null);
  const [showControls, setShowControls] = useState(false);
  const [newConfig, setNewConfig] = useState({ name: '' });

  // Fingerprint-Initialisierung
  useEffect(() => {
    const initFingerprint = async () => {
      const fp = await FingerprintJS.load();
      const result = await fp.get();
      setFingerprint(result.visitorId);
    };
    initFingerprint();
  }, []);


  useEffect(() => {
    const saved = localStorage.getItem('selectedConfigs');
    if (saved) {
      setSelectedConfigs(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    if (fingerprint) {
      fetchConfigs();
    }
  }, [fingerprint]);

  const selectConfig = (apiConfig) => {
    setClickedConfig(apiConfig); // Setze die ausgewählte Konfiguration
    handleConfigSelect(apiConfig.id);
  }


  const handleConfigSelect = (configId, event) => {
    const newSelection = selectedConfigs.includes(configId)
      ? selectedConfigs.filter(id => id !== configId)
      : [...selectedConfigs, configId];

    setSelectedConfigs(newSelection);
    onSave(configs.filter(c => newSelection.includes(c.id)));
    localStorage.setItem('selectedConfigs', JSON.stringify(newSelection));
    localStorage.setItem('setConfigs', JSON.stringify(configs.filter(c => newSelection.includes(c.id))));
  };

  const handleCreateConfig = async () => {
    try {
      const response = await fetch('/api/configs/create', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Fingerprint': fingerprint, // Falls benötigt
        },
      });

      if (!response.ok) {
        throw new Error('Failed to create config');
      }

      const responseBody = await response.text();
      fetchConfigs(Number(responseBody));
    } catch (error) {
      console.error('Error creating config:', error);
    }
  };

  // Funktion zum Abrufen bestehender Konfigurationen
  const fetchConfigs = async (clickConfig) => {
    try {
      const response = await fetch('/api/configs', {
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
      setConfigs(data.sort((a,b) => ('' + a.category).localeCompare(b.category) ));
      setClickedConfig(data.find(c => c.id == clickConfig));
    } catch (error) {
      console.error('Error fetching configs:', error);
    }
  };

  const handleConfigItemClick = (config, event) => {
    // Prüfe, ob das geklickte Element oder seine Eltern spezielle klickbare Elemente sind
    let target = event.target;
    console.log(event);
    while (target !== event.currentTarget) {
      if (
        target.tagName.toLowerCase() === 'a' ||
        target.onclick ||
        target.classList.contains('rating-container')
      ) {
        return;
      }
      target = target.parentElement;
    }
    setClickedConfig(config, event);
    handleConfigSelect(config.id);
  };

  const handleApiEdit = async (config) => {
    try {
      const response = await fetch('/api/configs/edit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Fingerprint': fingerprint, 
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error('Failed to copy config');
      }
      const responseBody = await response.text();
      fetchConfigs(Number(responseBody));
    } catch (error) {
      console.error('Error copying config:', error);
    }
  };

  const handleApiCopy = async (configId) => {
    const newConfig = {
      id: configId,
    };

    try {
      const response = await fetch('/api/configs/copy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Fingerprint': fingerprint, 
        },
        body: JSON.stringify(newConfig),
      });

      if (!response.ok) {
        throw new Error('Failed to copy config');
      }
      const responseBody = await response.text();
      fetchConfigs(Number(responseBody));
    } catch (error) {
      console.error('Error copying config:', error);
    }
  };
  const handleApiPublish = async (configId) => {
    const newConfig = {
      id: configId,
      published: !configs.find(c => c.id == configId).published
    };

    try {
      const response = await fetch('/api/configs/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Fingerprint': fingerprint, 
        },
        body: JSON.stringify(newConfig),
      });

      if (!response.ok) {
        throw new Error('Failed to copy config');
      }

      const responseBody = await response.text();
      fetchConfigs(Number(responseBody));
    } catch (error) {
      console.error('Error copying config:', error);
    }
  };

  const handleApiDelete = async (configId) => {
    const newConfig = {
      id: configId,
    };

    try {
      const response = await fetch('/api/configs/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Fingerprint': fingerprint, 
        },
        body: JSON.stringify(newConfig),
      });

      if (!response.ok) {
        throw new Error('Failed to copy config');
      }

      // Konfigurationen neu laden
      fetchConfigs();
    } catch (error) {
      console.error('Error copying config:', error);
    }
  };

  const handleWebsiteClick = (url, event) => {
    event.stopPropagation();
    window.open(url, "_blank");
  };

  const handleControlToggle = () => {
    setShowControls(!showControls);
    if(!showControls && !clickedConfig && configs.length > 0){
      setClickedConfig(configs.filter(c => c != null)[0]);
    }
  }

  if (!open) return null;
  return (
    <div className="dialog-overlay">
      <div className="dialog-content grid grid-cols-3">
        <div className="configs-container col-span-2">
          <h2 className="title is-4">Select Configs</h2>
          <button onClick={handleCreateConfig}
            className="button mb-4 flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            <Plus size={20} />
            Create Config
          </button>

          <button onClick={(() => onClose())} className="ml-4 button items-center "
          > Close
          </button>

          <button onClick={handleControlToggle} className="ml-4 button items-center "
          > {showControls ? <VisibilityOffIcon/> : <VisibilityIcon/>} Controls
          </button>

          <div className="grid gap-4">
            {configs.map(config => (
              <div key={config.id} className={`config-item ${clickedConfig && clickedConfig.id == config.id ? 'selected-config ' : '' } ${selectedConfigs.includes(config.id)? 'active-config ':''}`} onClick={(e) => handleConfigItemClick(config, e)}>
                <div  className="flex justify-between items-start mb-2">
                  <label className="flex items-center gap-2">
                  <p>
                   {config.category && (
                      (() => {
                        switch (config.category.toLowerCase()) {
                          case 'mtg':
                            return <img src='/icons/mtg.png' alt="MTG Icon" className="categoryIcon" />;
                          case 'poke':
                            return <img src='/icons/poke.png' alt="Pokemon Icon" className="categoryIcon" />;  
                          case 'yugioh':
                            return <img src='/icons/yugi.webp' alt="Yugi Icon" className="categoryIcon" />;
                          case 'misc':
                            return <img src='/icons/misc.webp' alt="Misc Icon" className="categoryIcon" />;
                          default:
                            return null;
                        }
                      })()
                    )}
                    {config.languageField || config.nestedLanguageLanguageField?<span><TranslateIcon className="subCategoryIcon"/></span>:<span></span>}
                    {config.customArts?<span><PaletteIcon className="subCategoryIcon"/></span>:<span></span>}
                    {config.published?<span><PublicIcon className="subCategoryIcon"/></span>:<span><LockIcon className="subCategoryIcon"/></span>}
                    </p>

                  </label>
                  <div>
                  <div className="rating">
                    {[1, 2, 3, 4, 5].map(score => (
                      <Star
                        key={score}
                        strokeWidth={` ${score <= config.ratingValue ? '0' : '0.3' }`}
                        fill={` ${score <= config.ratingValue ? '#3273a8' : 'none' }`}
                        // className={`cursor-pointer ${score <= config.ratingValue
                        //     ? 'text-light-blue-400 fill-light-blue-400'
                        //     : 'text-gray-300'
                        //   }`}
                      />
                    ))}
                      <span className="text-sm text-gray-600">
                        {config.averageRating} ({config.ratingCount})
                      </span>
                  </div>
                  <p>
                      {config.officialWebsite?<span onClick={(e) => handleWebsiteClick(config.officialWebsite, e)}>{config.name}<ExitToAppIcon className='inline-icon'/></span>:<span>{config.name}</span>}
                    </p>
                  </div>
                </div>
                
              </div>
            ))}
          </div>

        </div>
        {clickedConfig && showControls ? <div className="right-side col-span-1">
          {clickedConfig && clickedConfig.published? <ApiRating ratingChanged={setConfigs} conf={clickedConfig} /> : null}
          <ApiConfigWizard 
            initialConfig={clickedConfig} 
            onClose={onClose} 
            onPublish={(confId) => handleApiPublish(confId)} 
            onDelete={(confId) => handleApiDelete(confId)} 
            onCopy={(confId) => handleApiCopy(confId)} 
            onSave={(conf) => handleApiEdit(conf)} 
          />
        </div> : null
        }
      </div>
    </div>
  );
};

export default ApiConfigDialog;
