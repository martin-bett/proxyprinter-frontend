import React, { useState, useEffect } from 'react';
import { Star, Plus } from 'lucide-react';
import FingerprintJS from '@fingerprintjs/fingerprintjs';
import './ApiConfigDialog.css';
import ApiConfigWizard from './ApiConfigWizard';
import TranslateIcon from '@mui/icons-material/Translate';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import PublicIcon from '@mui/icons-material/Public';
import LockIcon from '@mui/icons-material/Lock';
import PaletteIcon from '@mui/icons-material/Palette';
import ApiRating from '../ApiRating';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import IconBar from '../../../container/IconBar';
import ConfigContainer from '../ConfigContainer';

const ApiConfigDialog = ({ open, onClose, onSave }) => {
  const [configs, setConfigs] = useState([]);
  const [selectedConfigs, setSelectedConfigs] = useState([]);
  const [clickedConfig, setClickedConfig] = useState(null); // Speichert die ausgewählte Konfiguration
  const [fingerprint, setFingerprint] = useState(null);
  const [showControls, setShowControls] = useState(false);
  const [filterSelection, setFilterSelection] = useState([]);

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

  const handleConfigSelect = (configId, event) => {
    const newSelection = selectedConfigs.includes(configId)
      ? selectedConfigs.filter(id => id !== configId)
      : [...selectedConfigs, configId];

    setSelectedConfigs(newSelection);
    onSave(configs.filter(c => newSelection.includes(c.id)));
    localStorage.setItem('selectedConfigs', JSON.stringify(newSelection));
    localStorage.setItem('setConfigs', JSON.stringify(configs.filter(c => newSelection.includes(c.id))));
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
        target.onclick
      ) {
        return;
      }
      target = target.parentElement;
    }
    setClickedConfig(config, event);
    handleConfigSelect(config.id);
  };

  const handleConfigOperation = async (method, operation, body) => {
    try {
      const response = await fetch(`/api/configs/${operation}`, {
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
      fetchConfigs(Number(responseBody));
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



  const handleControlToggle = () => {
    setShowControls(!showControls);
    if(!showControls && !clickedConfig && configs.length > 0){
      setClickedConfig(configs.filter(filterConfigs)[0]);
    }
  }

  const filterSelectionChange = (newSelection) => {
    // Wenn beide Sub-Category-Filter gleichzeitig gewählt werden
    // if (
    //   newSelection.includes('sub-category-private') && 
    //   newSelection.includes('sub-category-public')
    // ) {
    //   // Entferne den zuletzt hinzugefügten
    //   const filteredSelection = newSelection.filter(
    //     item => item !== (
    //       filterSelection.includes('sub-category-private') 
    //         ? 'sub-category-private' 
    //         : 'sub-category-public'
    //     )
    //   );
      
    //   setFilterSelection(filteredSelection);
    // } else {
    //   // Normale Selektion
    //   setFilterSelection(newSelection);
    // }
    console.log('hi');
    setFilterSelection(newSelection);
    if(!configs.filter(filterConfigs).includes(clickedConfig)){
      setClickedConfig(null);
    }
  }

  const filterConfigs = (config) => {
    const mtg = filterSelection.find(filter => filter =='category-mtg');
    const yugi = filterSelection.find(filter => filter =='category-yugi');
    const poke = filterSelection.find(filter => filter =='category-poke');
    const misc = filterSelection.find(filter => filter =='category-misc');
    const language = filterSelection.find(filter => filter =='sub-category-language');
    const customArts = filterSelection.find(filter => filter =='sub-category-customArts');
    const pub = filterSelection.find(filter => filter =='sub-category-public');
    const priv = filterSelection.find(filter => filter =='sub-category-private');
    const rated = filterSelection.find(filter => filter =='sub-category-rated');

    return  ((mtg && config.category == 'MTG' ) ||
            (yugi && config.category == 'YUGI' ) ||
            (poke && config.category == 'POKE' ) ||
            (misc && config.category == 'MISC' ) ||
            (!mtg && !yugi && !poke && !misc)) &&
            (language && (config.languageField || config.nestedLanguageLanguageField) || !language) &&
            (customArts && config.customArts || !customArts) &&
    (pub && config.published || !pub) &&
    (priv && !config.published|| !priv) &&
    (rated && config.ratingCount > 10 || !rated );
  };

  const getSearchIconElements = () => {
    return [
      {key : 'category-mtg', content: <img src='/icons/mtg.png'/>},
      {key : 'category-yugi', content: <img src='/icons/yugi.webp'/>},
      {key : 'category-poke', content: <img src='/icons/poke.png'/>},
      {key : 'category-misc', content: <img src='/icons/misc.webp'/>},
      {key : 'sub-category-language', content: <TranslateIcon/>},
      {key : 'sub-category-customArts', content: <PaletteIcon/>},
      {key : 'sub-category-public', content: <PublicIcon/>},
      {key : 'sub-category-private', content: <LockIcon/>},
      {key : 'sub-category-rated', content: <Star/>},
    ]
  }

  if (!open) return null;
  return (
      <div className="grid grid-cols-2 config-dialog">
        <div>
        <div className="config-controls">
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

          <IconBar onSelectionChange={filterSelectionChange}
                  initialSelection={filterSelection}
                  elements={getSearchIconElements()}
                  />
        </div>
        
        <ConfigContainer
          configs={configs.filter(filterConfigs)}
          selectedConfigs={selectedConfigs}
          clickedConfig={clickedConfig}
          handleItemClick={handleConfigItemClick}
        />
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
  );
};

export default ApiConfigDialog;
