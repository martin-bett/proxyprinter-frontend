import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Star, Plus } from 'lucide-react';
import './ApiConfigDialog.css';
import ApiConfigWizard, { ApiConfigFormState } from './ApiConfigWizard';
import TranslateIcon from '@mui/icons-material/Translate';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import PublicIcon from '@mui/icons-material/Public';
import LockIcon from '@mui/icons-material/Lock';
import PaletteIcon from '@mui/icons-material/Palette';
import ApiRating from '../ApiRating';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import IconBar, { IconBarElement } from '../../../container/IconBar';
import ConfigContainer from '../ConfigContainer';
import { ApiConfig, Config } from '../../../service/ApiFactory';
import { refreshStoredSelection } from './configSelection';
import ApiCreateWizard from './wizard/ApiCreateWizard';
import { useAuth } from '../../../service/auth/auth';

interface ApiConfigDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (configs: Config[]) => void;
}

const ApiConfigDialog: React.FC<ApiConfigDialogProps> = ({ open, onClose, onSave }) => {
  const { t } = useTranslation();
  const [configs, setConfigs] = useState<Config[]>([]);
  const [selectedConfigs, setSelectedConfigs] = useState<number[]>([]);
  const [clickedConfig, setClickedConfig] = useState<Config | null>(null); // Speichert die ausgewählte Konfiguration
  const auth = useAuth();
  const loggedIn = !!auth.email;
  const [showControls, setShowControls] = useState(false);
  const [filterSelection, setFilterSelection] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('selectedConfigs');
    if (saved) {
      setSelectedConfigs(JSON.parse(saved));
    }
  }, []);


  // Nach Login/Logout neu laden: eigene Configs hängen am Konto
  useEffect(() => {
    fetchConfigs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.email]);

  const handleConfigSelect = (configId: number) => {
    const newSelection = selectedConfigs.includes(configId)
      ? selectedConfigs.filter(id => id !== configId)
      : [...selectedConfigs, configId];

    setSelectedConfigs(newSelection);
    onSave(configs.filter(c => newSelection.includes(c.id)));
    localStorage.setItem('selectedConfigs', JSON.stringify(newSelection));
    localStorage.setItem('setConfigs', JSON.stringify(configs.filter(c => newSelection.includes(c.id))));
  };



  // Funktion zum Abrufen bestehender Konfigurationen
  const fetchConfigs = async (clickConfig?: number): Promise<Config[]> => {
    try {
      const response = await fetch('/api/configs', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch configs');
      }

      const data: Config[] = await response.json();
      setConfigs(data.sort((a, b) => ('' + a.category).localeCompare(b.category)));
      setClickedConfig(data.find(c => c.id == clickConfig) || null);
      // Aktive Auswahl auf den neuen Stand bringen (z.B. nach dem Speichern einer Config)
      const updated = refreshStoredSelection(data);
      if (updated) onSave(updated);
      return data;
    } catch (error) {
      console.error('Error fetching configs:', error);
      return [];
    }
  };

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
    handleConfigSelect(config.id);
  };

  const handleConfigOperation = async (method: string, operation: string, body?: unknown) => {
    try {
      const response = await fetch(`/api/configs/${operation}`, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
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

  const handleCreateConfig = () => {
    setCreating(true);
  };

  // Leere Config wie früher, für Quellen, die der Wizard nicht abdeckt
  const handleCreateEmptyConfig = async () => {
    setCreating(false);
    setShowControls(true);
    handleConfigOperation('GET', 'create');
  };

  const handleWizardCreated = async (configId: number) => {
    setCreating(false);
    setShowControls(true);
    const data = await fetchConfigs(configId);
    if (!selectedConfigs.includes(configId) && data.some(c => c.id === configId)) {
      // Neue Config gleich für die Suche aktivieren
      const newSelection = [...selectedConfigs, configId];
      const active = data.filter(c => newSelection.includes(c.id));
      setSelectedConfigs(newSelection);
      onSave(active);
      localStorage.setItem('selectedConfigs', JSON.stringify(newSelection));
      localStorage.setItem('setConfigs', JSON.stringify(active));
    }
  };

  const handleApiEdit = async (config: ApiConfigFormState) => {
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



  const handleControlToggle = () => {
    setShowControls(!showControls);
    if (!showControls && !clickedConfig && configs.length > 0) {
      setClickedConfig(configs.filter(filterConfigs)[0]);
    }
  }

  const filterSelectionChange = (newSelection: string[]) => {
    console.log('hi');
    setFilterSelection(newSelection);
    if (!configs.filter(filterConfigs).includes(clickedConfig as Config)) {
      setClickedConfig(null);
    }
  }

  const filterConfigs = (config: Config): boolean => {
    const mtg = filterSelection.includes('category-mtg');
    const yugi = filterSelection.includes('category-yugi');
    const poke = filterSelection.includes('category-poke');
    const misc = filterSelection.includes('category-misc');
    const language = filterSelection.includes('sub-category-language');
    const customArts = filterSelection.includes('sub-category-customArts');
    const pub = filterSelection.includes('sub-category-public');
    const priv = filterSelection.includes('sub-category-private');
    const rated = filterSelection.includes('sub-category-rated');

    return ((mtg && config.category == 'MTG') ||
      (yugi && config.category == 'YUGI') ||
      (poke && config.category == 'POKE') ||
      (misc && config.category == 'MISC') ||
      (!mtg && !yugi && !poke && !misc)) &&
      ((language && Boolean((config as ApiConfig).languageField || (config as ApiConfig).nestedLanguageLanguageField)) || !language) &&
      ((customArts && config.customArts) || !customArts) &&
      ((pub && config.published) || !pub) &&
      ((priv && !config.published) || !priv) &&
      ((rated && (config.ratingCount || 0) > 10) || !rated);
  };

  const getSearchIconElements = (): IconBarElement[] => {
    return [
      { key: 'category-mtg', content: <img src='/icons/mtg.png' alt={t('configCommon.categories.mtg')} /> },
      { key: 'category-yugi', content: <img src='/icons/yugi.webp' alt={t('configCommon.categories.yugi')} /> },
      { key: 'category-poke', content: <img src='/icons/poke.png' alt={t('configCommon.categories.poke')} /> },
      { key: 'category-misc', content: <img src='/icons/misc.webp' alt={t('configCommon.categories.misc')} /> },
      { key: 'sub-category-language', content: <TranslateIcon /> },
      { key: 'sub-category-customArts', content: <PaletteIcon /> },
      { key: 'sub-category-public', content: <PublicIcon /> },
      { key: 'sub-category-private', content: <LockIcon /> },
      { key: 'sub-category-rated', content: <Star /> },
    ]
  }

  if (!open) return null;
  if (creating) {
    return (
      <ApiCreateWizard
        existingNames={configs.map(c => c.name)}
        onCancel={() => setCreating(false)}
        onCreateEmpty={handleCreateEmptyConfig}
        onCreated={handleWizardCreated}
      />
    );
  }
  return (
      <div className="grid grid-cols-2 config-dialog">
        <div>
        <div className="config-controls">
          <h2 className="title is-4">{t('apiConfig.dialog.title')}</h2>
          <button onClick={handleCreateConfig} disabled={!loggedIn}
            title={loggedIn ? undefined : t('configCommon.loginToEdit')}
            className="button mb-4 flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            <Plus size={20} />
            {t('apiConfig.dialog.createConfig')}
          </button>

          <button onClick={(() => onClose())} className="ml-4 button items-center "
          > {t('common.close')}
          </button>

          <button onClick={handleControlToggle} className="ml-4 button items-center "
          > {showControls ? <VisibilityOffIcon/> : <VisibilityIcon/>} {t('apiConfig.dialog.controls')}
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
