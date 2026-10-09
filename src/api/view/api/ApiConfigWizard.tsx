import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import SaveIcon from '@mui/icons-material/Save';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PublicIcon from '@mui/icons-material/Public';
import LockIcon from '@mui/icons-material/Lock';
import { Config, ConnectedCardLocator } from '../../../service/ApiFactory';
import ConfigFieldTable, { CATEGORY_OPTIONS, ConfigField } from '../ConfigFieldTable';
import { DEFAULT_LANGUAGE_OPTIONS } from '../defaultLanguages';
import ActionButton from '../../../container/inputs/ActionButton';
import { useAuth } from '../../../service/auth/auth';
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
  { group: 'configCommon.groups.baseInfo', name: 'name', label: 'configCommon.fields.name', required: true },
  { group: 'configCommon.groups.baseInfo', name: 'category', label: 'configCommon.fields.category', type: 'select', options: CATEGORY_OPTIONS },
  { group: 'configCommon.groups.baseInfo', name: 'officialWebsite', label: 'configCommon.fields.officialWebsite' },
  { group: 'configCommon.groups.baseInfo', name: 'customArts', label: 'apiConfig.fields.customArts', type: 'checkbox' },
  { group: 'configCommon.groups.request', name: 'method', label: 'configCommon.fields.method', type: 'select', options: [['GET', 'configCommon.options.get'], ['POST', 'configCommon.options.post']] },
  { group: 'configCommon.groups.request', name: 'dataFormat', label: 'configCommon.fields.dataFormat', type: 'select', options: [['json', 'configCommon.options.json'], ['html', 'configCommon.options.html']] },
  { group: 'configCommon.groups.request', name: 'baseUrl', label: 'configCommon.fields.baseUrl' },
  { group: 'configCommon.groups.request', name: 'parameterMap', label: 'configCommon.fields.parameterMap', type: 'json' },
  { group: 'configCommon.groups.request', name: 'concurrentLimit', label: 'apiConfig.fields.concurrentLimit', type: 'number' },
  { group: 'configCommon.groups.request', name: 'requestFormat', label: 'apiConfig.fields.requestFormat', type: 'select', options: [['urlencoded', 'configCommon.options.urlEncoded'], ['multipart', 'configCommon.options.multipart'], ['json', 'configCommon.options.json']] },
  { group: 'configCommon.groups.request', name: 'csrfTokenVariableName', label: 'apiConfig.fields.csrfTokenVariableName' },
  { group: 'configCommon.groups.request', name: 'requiresCsrfToken', label: 'apiConfig.fields.requiresCsrfToken', type: 'checkbox' },
  { group: 'configCommon.groups.request', name: 'useBackendProxy', label: 'apiConfig.fields.useBackendProxy', type: 'checkbox' },
  { group: 'configCommon.groups.request', name: 'proxyImages', label: 'apiConfig.fields.proxyImages', type: 'checkbox', title: 'apiConfig.titles.proxyImages' },
  { group: 'configCommon.groups.locator', name: 'paginationField', label: 'configCommon.fields.paginationField' },
  { group: 'configCommon.groups.locator', name: 'dataListField', label: 'configCommon.fields.dataListField' },
  { group: 'configCommon.groups.locator', name: 'nameField', label: 'configCommon.fields.nameField' },
  { group: 'configCommon.groups.locator', name: 'imageUrlField', label: 'configCommon.fields.imageUrlField' },
  { group: 'configCommon.groups.locator', name: 'languageField', label: 'configCommon.fields.languageField' },
  { group: 'configCommon.groups.locator', name: 'defaultLanguage', label: 'configCommon.fields.defaultLanguage', type: 'select', options: DEFAULT_LANGUAGE_OPTIONS, title: 'configCommon.titles.defaultLanguage' },
  { group: 'configCommon.groups.locator', name: 'setField', label: 'configCommon.fields.setField' },
  { group: 'configCommon.groups.locator', name: 'nameSplitCharacter', label: 'apiConfig.fields.nameSplitCharacter' },
  { group: 'configCommon.groups.locator', name: 'setNumberField', label: 'apiConfig.fields.setNumberField' },
  { group: 'configCommon.groups.followLink', name: 'followLinkField', label: 'apiConfig.fields.followLinkField' },
  { group: 'configCommon.groups.followLink', name: 'followLinkDataListField', label: 'configCommon.fields.dataListField' },
  { group: 'configCommon.groups.followLink', name: 'followLinkImageField', label: 'apiConfig.fields.followLinkImageField' },
  { group: 'configCommon.groups.followLink', name: 'followLinkLanguageField', label: 'configCommon.fields.languageField' },
  { group: 'configCommon.groups.nestedLanguage', name: 'nestedLanguageDataListField', label: 'configCommon.fields.dataListField' },
  { group: 'configCommon.groups.nestedLanguage', name: 'nestedLanguageImageUrlField', label: 'configCommon.fields.imageUrlField' },
  { group: 'configCommon.groups.nestedLanguage', name: 'nestedLanguageLanguageField', label: 'configCommon.fields.languageField' },
  { group: 'configCommon.groups.cardFaces', name: 'cardFacesDataListField', label: 'configCommon.fields.dataListField', title: 'apiConfig.titles.cardFacesDataListField' },
  { group: 'configCommon.groups.cardFaces', name: 'cardFacesImageUrlField', label: 'configCommon.fields.imageUrlField' },
  { group: 'configCommon.groups.cardFaces', name: 'cardFacesNameField', label: 'configCommon.fields.nameField' },
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
  const { t } = useTranslation();
  const auth = useAuth();
  const loggedIn = !!auth.email;
  const [isOwner, setIsOwner] = useState(false);
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

  // Bearbeiten darf nur das Konto, dem die Config gehört
  useEffect(() => {
    if (!loggedIn) {
      setIsOwner(false);
    } else if (config.name && config.id !== undefined) {
      fetch(`/api/configs/${config.id}/check`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
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
  }, [loggedIn, config.name, config.id]);

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
      <h1 className='title is-4'>{t('configCommon.configSettings')}</h1>
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
              <ActionButton type="submit" className="is-primary" icon={<SaveIcon />}>{t('common.save')}</ActionButton>
              <ActionButton icon={config.published ? <LockIcon /> : <PublicIcon />} onClick={handlePublish}>
                {config.published ? t('configCommon.unpublish') : t('configCommon.publish')}
              </ActionButton>
              <ActionButton className="is-danger" icon={<DeleteForeverIcon />} onClick={handleDelete}>{t('common.delete')}</ActionButton>
            </>
          ) : null}
          <ActionButton icon={<ContentCopyIcon />} onClick={handleCopyConfig} disabled={!loggedIn}
            title={loggedIn ? undefined : t('configCommon.loginToEdit')}>{t('configCommon.copyConfig')}</ActionButton>
        </div>
        {!loggedIn && <p className="help">{t('configCommon.loginToEdit')}</p>}
      </form>
    </div>
  );
};

export default ApiConfigWizard;
