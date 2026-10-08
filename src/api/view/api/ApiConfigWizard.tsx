import React, { useState, useEffect } from 'react';
import SaveIcon from '@mui/icons-material/Save';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import FingerprintJS from '@fingerprintjs/fingerprintjs';
import PublicIcon from '@mui/icons-material/Public';
import LockIcon from '@mui/icons-material/Lock';
import { Config, ConnectedCardLocator } from '../../../service/ApiFactory';
import ConfigFieldTable, { CATEGORY_OPTIONS, ConfigField } from '../ConfigFieldTable';
import { DEFAULT_LANGUAGE_OPTIONS } from '../defaultLanguages';
import ActionButton from '../../../container/inputs/ActionButton';
import ConnectedCardsTable from './ConnectedCardsTable';

/** Draft state of the config-editing form. Loosely typed on purpose: it mirrors
 * whatever the (untyped) backend config-object looks like, and every input
 * writes through a single generic change handler. */
export interface ApiConfigFormState {
  id?: number;
  name: string;
  category: string;
  officialWebsite: string;
  customArts: boolean;
  method: string;
  dataFormat: string;
  baseUrl: string;
  parameterMap: unknown;
  concurrentLimit: number | string;
  requestFormat: string;
  csrfTokenVariableName: string;
  requiresCsrfToken: boolean;
  useBackendProxy: boolean;
  proxyImages: boolean;
  paginationField: string;
  dataListField: string;
  nameField: string;
  imageUrlField: string;
  languageField: string;
  defaultLanguage: string;
  setField: string;
  nameSplitCharacter: string;
  setNumberField: string;
  followLinkField: string;
  followLinkDataListField: string;
  followLinkImageField: string;
  followLinkLanguageField: string;
  nestedLanguageDataListField: string;
  nestedLanguageImageUrlField: string;
  nestedLanguageLanguageField: string;
  cardFacesDataListField: string;
  cardFacesImageUrlField: string;
  cardFacesNameField: string;
  connectedCards: ConnectedCardLocator[];
  published?: boolean;
  [key: string]: unknown;
}

const API_CONFIG_FIELDS: ConfigField[] = [
  { group: 'Base Info', name: 'name', label: 'Name', required: true },
  { group: 'Base Info', name: 'category', label: 'Category', type: 'select', options: CATEGORY_OPTIONS },
  { group: 'Base Info', name: 'officialWebsite', label: 'Official Website' },
  { group: 'Base Info', name: 'customArts', label: 'Custom Arts', type: 'checkbox' },
  { group: 'Request', name: 'method', label: 'Method', type: 'select', options: [['GET', 'GET'], ['POST', 'POST']] },
  { group: 'Request', name: 'dataFormat', label: 'Data Format', type: 'select', options: [['json', 'JSON'], ['html', 'HTML']] },
  { group: 'Request', name: 'baseUrl', label: 'Base URL' },
  { group: 'Request', name: 'parameterMap', label: 'Parameter Map', type: 'json' },
  { group: 'Request', name: 'concurrentLimit', label: 'Concurrent Limit', type: 'number' },
  { group: 'Request', name: 'requestFormat', label: 'Request Format', type: 'select', options: [['urlencoded', 'URL Encoded'], ['multipart', 'Multipart'], ['json', 'JSON']] },
  { group: 'Request', name: 'csrfTokenVariableName', label: 'CSRF Token Variable Name' },
  { group: 'Request', name: 'requiresCsrfToken', label: 'Requires CSRF Token', type: 'checkbox' },
  { group: 'Request', name: 'useBackendProxy', label: 'Use Backend Proxy', type: 'checkbox' },
  { group: 'Request', name: 'proxyImages', label: 'Proxy Images', type: 'checkbox', title: 'Load images of this API through the backend (for hosts without CORS headers)' },
  { group: 'Locator', name: 'paginationField', label: 'Pagination Field' },
  { group: 'Locator', name: 'dataListField', label: 'Data List Field' },
  { group: 'Locator', name: 'nameField', label: 'Name Field' },
  { group: 'Locator', name: 'imageUrlField', label: 'Image URL Field' },
  { group: 'Locator', name: 'languageField', label: 'Language Field' },
  { group: 'Locator', name: 'defaultLanguage', label: 'Default Language', type: 'select', options: DEFAULT_LANGUAGE_OPTIONS, title: 'Language for cards where the source provides no language' },
  { group: 'Locator', name: 'setField', label: 'Set Field' },
  { group: 'Locator', name: 'nameSplitCharacter', label: 'Name Split Character' },
  { group: 'Locator', name: 'setNumberField', label: 'Set Number Field' },
  { group: 'Follow Link', name: 'followLinkField', label: 'Follow Link Field' },
  { group: 'Follow Link', name: 'followLinkDataListField', label: 'Data List Field' },
  { group: 'Follow Link', name: 'followLinkImageField', label: 'Image Field' },
  { group: 'Follow Link', name: 'followLinkLanguageField', label: 'Language Field' },
  { group: 'Nested Language', name: 'nestedLanguageDataListField', label: 'Data List Field' },
  { group: 'Nested Language', name: 'nestedLanguageImageUrlField', label: 'Image URL Field' },
  { group: 'Nested Language', name: 'nestedLanguageLanguageField', label: 'Language Field' },
  { group: 'Card Faces', name: 'cardFacesDataListField', label: 'Data List Field', title: 'List of card faces, e.g. card_faces on Scryfall. Each face with an image becomes its own match.' },
  { group: 'Card Faces', name: 'cardFacesImageUrlField', label: 'Image URL Field' },
  { group: 'Card Faces', name: 'cardFacesNameField', label: 'Name Field' },
];

interface ApiConfigWizardProps {
  onClose: () => void;
  onSave: (config: ApiConfigFormState) => void;
  onPublish: (configId: number | undefined) => void;
  onDelete: (configId: number | undefined) => void;
  onCopy: (configId: number | undefined) => void;
  initialConfig?: Config | null;
}

const ApiConfigWizard: React.FC<ApiConfigWizardProps> = ({ onClose, onSave, onPublish, onDelete, onCopy, initialConfig }) => {
  const [isOwner, setIsOwner] = useState(false);
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [config, setConfig] = useState<ApiConfigFormState>({
    name: '',
    category: 'misc',
    officialWebsite: '',
    customArts: false,
    method: 'GET',
    dataFormat: 'json',
    baseUrl: '',
    parameterMap: {},
    concurrentLimit: 1,
    requestFormat: 'urlencoded',
    csrfTokenVariableName: '',
    requiresCsrfToken: false,
    useBackendProxy: false,
    proxyImages: false,
    paginationField: '',
    dataListField: '',
    nameField: '',
    imageUrlField: '',
    languageField: '',
    defaultLanguage: '',
    setField: '',
    nameSplitCharacter: '',
    setNumberField: '',
    followLinkField: '',
    followLinkDataListField: '',
    followLinkImageField: '',
    followLinkLanguageField: '',
    nestedLanguageDataListField: '',
    nestedLanguageImageUrlField: '',
    nestedLanguageLanguageField: '',
    cardFacesDataListField: '',
    cardFacesImageUrlField: '',
    cardFacesNameField: '',
    connectedCards: []
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
        connectedCards: (initialConfig as { connectedCards?: ConnectedCardLocator[] }).connectedCards ?? [],
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(initialConfig)]);

  useEffect(() => {
    if (config.name && fingerprint) {
      fetch(`/api/configs/${config.id}/check`, {
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

  const handleSubmit = () => {
    onSave(config);
  };

  return (
    <div className="wizard-container">
      <h1 className='title is-4'>Config Settings</h1>
      <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
        <ConfigFieldTable
          fields={API_CONFIG_FIELDS}
          values={config}
          savedValues={initialConfig as unknown as Record<string, unknown> | null}
          editable={isOwner}
          onChange={handleInputChange}
          onJsonChange={handleParameterMapChange}
        />
        <ConnectedCardsTable
          value={config.connectedCards}
          editable={isOwner}
          onChange={(connectedCards) => setConfig((prev) => ({ ...prev, connectedCards }))}
        />
        <div className="config-actions">
          {isOwner ? (
            <>
              <ActionButton type="submit" className="is-primary" icon={<SaveIcon />}>Save</ActionButton>
              <ActionButton icon={config.published ? <LockIcon /> : <PublicIcon />} onClick={handlePublish}>
                {config.published ? 'Unpublish' : 'Publish'}
              </ActionButton>
              <ActionButton className="is-danger" icon={<DeleteForeverIcon />} onClick={handleDelete}>Delete</ActionButton>
            </>
          ) : null}
          <ActionButton icon={<ContentCopyIcon />} onClick={handleCopyConfig}>Copy Config</ActionButton>
        </div>
      </form>
    </div>
  );
};

export default ApiConfigWizard;
