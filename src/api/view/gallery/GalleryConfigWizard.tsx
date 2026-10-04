import React, { useState, useEffect } from 'react';
import TuneIcon from '@mui/icons-material/Tune';
import SaveIcon from '@mui/icons-material/Save';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import FingerprintJS from '@fingerprintjs/fingerprintjs';
import PublicIcon from '@mui/icons-material/Public';
import LockIcon from '@mui/icons-material/Lock';
import { Config } from '../../../service/ApiFactory';
import DefaultLanguageSelect from '../DefaultLanguageSelect';

export interface GalleryConfigFormState {
  id?: number;
  name: string;
  category: string;
  officialWebsite: string;
  method: string;
  dataFormat: string;
  baseUrl: string;
  parameters: unknown[];
  parameterMap?: unknown;
  useBackendProxy: boolean;
  paginationField: string;
  dataListField: string;
  nameField: string;
  imageUrlField: string;
  defaultLanguage: string;
  published?: boolean;
  [key: string]: unknown;
}

interface GalleryConfigWizardProps {
  onClose: () => void;
  onSave: (config: GalleryConfigFormState) => void;
  onPublish: (configId: number | undefined) => void;
  onDelete: (configId: number | undefined) => void;
  onCopy: (configId: number | undefined) => void;
  initialConfig?: Config | null;
}

const GalleryConfigWizard: React.FC<GalleryConfigWizardProps> = ({ onSave, onPublish, onDelete, onCopy, initialConfig }) => {
  const [isOwner, setIsOwner] = useState(false);
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [config, setConfig] = useState<GalleryConfigFormState>({
    name: '',
    category: 'misc',
    officialWebsite: '',
    method: 'GET',
    dataFormat: 'json',
    baseUrl: '',
    parameters: [],
    useBackendProxy: false,
    paginationField: '',
    dataListField: '',
    nameField: '',
    imageUrlField: '',
    defaultLanguage: ''
  });

  const [expandedSections, setExpandedSections] = useState({
    baseInfo: true,
    requestBasic: false,
    locatorBasic: false,
  });

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
    if (initialConfig) {
      setConfig((prevConfig) => ({
        ...prevConfig,
        ...Object.fromEntries(
          Object.entries(initialConfig).map(([key, value]) => [
            key,
            value !== undefined && value !== null ? value : ''
          ])
        ),
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(initialConfig)]);

  useEffect(() => {
    if (config.name && fingerprint) {
      fetch(`/api/gallery/${config.id}/check`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Fingerprint': fingerprint, // Falls benötigt
        }
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error('Failed to check ownership');
          }
          return response.json();
        })
        .then((data) => {
          setIsOwner(data); // Erwartet ein Boolean vom Server
        })
        .catch((error) => {
          console.error('Error checking ownership:', error);
          setIsOwner(false);
        });
    }
  }, [fingerprint, config.name, config.id]);

  const handlePublish = () => { onPublish(config.id); }
  const handleDelete = () => { onDelete(config.id); }
  const handleCopyConfig = () => { onCopy(config.id); }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setConfig((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleParameterMapChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    try {
      const parameterMap = JSON.parse(e.target.value);
      setConfig((prev) => ({ ...prev, parameterMap }));
    } catch (error) {
      console.error('Invalid JSON for parameterMap');
    }
  };

  const handleToggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleSubmit = () => {
    onSave(config);
  };

  return (
    <div className="wizard-container">
      <h1 className='title is-4'>Config Settings</h1>
      <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="wizard-form">

        {/* Base Info */}
        <div className='wizard-category'>
          <button className="button setting-category" type="button" onClick={() => handleToggleSection('baseInfo')}>
            <TuneIcon />Base Info {expandedSections.baseInfo ? <VisibilityIcon /> : <VisibilityOffIcon />}
          </button>
          {expandedSections.baseInfo && (
            <div>
              <label>Name:</label>
              <input
                type="text"
                name="name"
                value={config.name}
                onChange={handleInputChange}
                disabled={!isOwner}
                required
              />
              <label>Category:</label>
              <select name="category" disabled={!isOwner} value={config.category} onChange={handleInputChange}>
                <option value="MTG">MTG</option>
                <option value="POKE">Poke</option>
                <option value="YUGIOH">Yugi</option>
                <option value="MISC">Misc</option>
              </select>
              <label>Official Website:</label>
              <input
                type="text"
                name="officialWebsite"
                value={config.officialWebsite}
                onChange={handleInputChange}
                disabled={!isOwner}
              />
            </div>
          )}
        </div>

        {/* Request Basic */}
        <div className='wizard-category'>
          <button className="button setting-category" type="button" onClick={() => handleToggleSection('requestBasic')}>
            <TuneIcon />Request Basic {expandedSections.requestBasic ? <VisibilityIcon /> : <VisibilityOffIcon />}
          </button>
          {expandedSections.requestBasic && (
            <div>
              <label>Method:</label>
              <select disabled={!isOwner} name="method" value={config.method} onChange={handleInputChange}>
                <option value="GET">GET</option>
                <option value="POST">POST</option>
              </select>
              <label>Data Format:</label>
              <select disabled={!isOwner} name="dataFormat" value={config.dataFormat} onChange={handleInputChange}>
                <option value="json">JSON</option>
                <option value="html">HTML</option>
              </select>
              <label>Base URL:</label>
              <input
                type="text"
                name="baseUrl"
                value={config.baseUrl}
                onChange={handleInputChange}
                disabled={!isOwner}
              />
              <label>Parameter Map:</label>
              <textarea
                name="parameterMap"
                value={JSON.stringify(config.parameterMap, null, 2)}
                onChange={handleParameterMapChange}
                disabled={!isOwner}
              />
            </div>
          )}
        </div>

        {/* Locator Basic */}
        <div className='wizard-category'>
          <button className="button setting-category" type="button" onClick={() => handleToggleSection('locatorBasic')}>
            <TuneIcon />Locator Basic {expandedSections.locatorBasic ? <VisibilityIcon /> : <VisibilityOffIcon />}
          </button>
          {expandedSections.locatorBasic && (
            <div>
              <label>Pagination Field:</label>
              <input
                type="text"
                name="paginationField"
                value={config.paginationField}
                onChange={handleInputChange}
                disabled={!isOwner}
              />
              <label>Data List Field:</label>
              <input
                type="text"
                name="dataListField"
                value={config.dataListField}
                onChange={handleInputChange}
                disabled={!isOwner}
              />
              <label>Name Field:</label>
              <input
                type="text"
                name="nameField"
                value={config.nameField}
                onChange={handleInputChange}
                disabled={!isOwner}
              />
              <label>Image URL Field:</label>
              <input
                type="text"
                name="imageUrlField"
                value={config.imageUrlField}
                onChange={handleInputChange}
                disabled={!isOwner}
              />
              <DefaultLanguageSelect value={config.defaultLanguage} onChange={handleInputChange} disabled={!isOwner} />
            </div>
          )}
        </div>


        {isOwner ? (
          <>
            <div className="wizard-category">
              <button className="button is-secondary submit" type="submit" >
                <SaveIcon />Save
              </button>
            </div>
            <div className="wizard-category">
              <button className="button is-secondary publish" type="button" onClick={handlePublish}>
                {config.published ? <LockIcon /> : <PublicIcon />}
                {config.published ? 'Unpublish' : 'Publish'}
              </button>
            </div>
            <div className="wizard-category">
              <button className="button is-secondary remove" type="button" onClick={handleDelete}>
                <DeleteForeverIcon />Delete
              </button>
            </div>
          </>
        ) : null}
        <div className="wizard-category">
          <button className="button is-secondary copy" type="button" onClick={handleCopyConfig}>
            <ContentCopyIcon />Copy Config
          </button>
        </div>
      </form>
    </div>
  );
};

export default GalleryConfigWizard;
