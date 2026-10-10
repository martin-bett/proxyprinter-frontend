import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import SaveIcon from '@mui/icons-material/Save';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PublicIcon from '@mui/icons-material/Public';
import LockIcon from '@mui/icons-material/Lock';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SettingsIcon from '@mui/icons-material/Settings';
import { Config, GalleryConfig, isGalleryConfig } from '../../../service/ApiFactory';
import ConfigFieldTable, { CATEGORY_OPTIONS, ConfigField } from '../ConfigFieldTable';
import { DEFAULT_LANGUAGE_OPTIONS } from '../defaultLanguages';
import ActionButton from '../../../container/inputs/ActionButton';
import TabBar, { tabPanelId } from '../../../container/inputs/TabBar';
import { useAuth } from '../../../service/auth/auth';
import GalleryConfigExecutor, { GalleryExecuteStatus } from './GallerConfigExecutor';

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
  linkPattern: string;
  followInputRedirects: boolean;
  credential: string;
  imageUrlPattern: string;
  imageUrlReplacement: string;
  namePattern: string;
  nameReplacement: string;
  hint: string;
  published?: boolean;
  [key: string]: unknown;
}

const GALLERY_CONFIG_FIELDS: ConfigField[] = [
  { group: 'configCommon.groups.baseInfo', name: 'name', label: 'configCommon.fields.name', required: true },
  { group: 'configCommon.groups.baseInfo', name: 'category', label: 'configCommon.fields.category', type: 'select', options: CATEGORY_OPTIONS },
  { group: 'configCommon.groups.baseInfo', name: 'officialWebsite', label: 'configCommon.fields.officialWebsite' },
  { group: 'configCommon.groups.baseInfo', name: 'hint', label: 'galleryConfig.fields.hint', title: 'galleryConfig.titles.hint' },
  { group: 'configCommon.groups.request', name: 'method', label: 'configCommon.fields.method', type: 'select', options: [['GET', 'configCommon.options.get'], ['POST', 'configCommon.options.post']] },
  { group: 'configCommon.groups.request', name: 'dataFormat', label: 'configCommon.fields.dataFormat', type: 'select', options: [['json', 'configCommon.options.json'], ['html', 'configCommon.options.html']] },
  { group: 'configCommon.groups.request', name: 'baseUrl', label: 'configCommon.fields.baseUrl' },
  { group: 'configCommon.groups.request', name: 'parameterMap', label: 'configCommon.fields.parameterMap', type: 'json', title: 'galleryConfig.titles.parameterMap' },
  { group: 'configCommon.groups.request', name: 'linkPattern', label: 'configCommon.fields.linkPattern', title: 'galleryConfig.titles.linkPattern' },
  { group: 'configCommon.groups.request', name: 'followInputRedirects', label: 'galleryConfig.fields.followInputRedirects', type: 'checkbox', title: 'galleryConfig.titles.followInputRedirects' },
  { group: 'configCommon.groups.request', name: 'credential', label: 'galleryConfig.fields.credential', title: 'galleryConfig.titles.credential' },
  { group: 'configCommon.groups.locator', name: 'paginationField', label: 'configCommon.fields.paginationField' },
  { group: 'configCommon.groups.locator', name: 'dataListField', label: 'configCommon.fields.dataListField' },
  { group: 'configCommon.groups.locator', name: 'nameField', label: 'configCommon.fields.nameField' },
  { group: 'configCommon.groups.locator', name: 'imageUrlField', label: 'configCommon.fields.imageUrlField' },
  { group: 'configCommon.groups.locator', name: 'imageUrlPattern', label: 'galleryConfig.fields.imageUrlPattern', title: 'galleryConfig.titles.imageUrlPattern' },
  { group: 'configCommon.groups.locator', name: 'imageUrlReplacement', label: 'galleryConfig.fields.imageUrlReplacement', title: 'galleryConfig.titles.imageUrlReplacement' },
  { group: 'configCommon.groups.locator', name: 'namePattern', label: 'galleryConfig.fields.namePattern', title: 'galleryConfig.titles.namePattern' },
  { group: 'configCommon.groups.locator', name: 'nameReplacement', label: 'galleryConfig.fields.nameReplacement', title: 'galleryConfig.titles.nameReplacement' },
  { group: 'configCommon.groups.locator', name: 'defaultLanguage', label: 'configCommon.fields.defaultLanguage', type: 'select', options: DEFAULT_LANGUAGE_OPTIONS, title: 'configCommon.titles.defaultLanguage' },
];

interface GalleryConfigWizardProps {
  onClose: () => void;
  onSave: (config: GalleryConfigFormState) => void;
  onPublish: (configId: number | undefined) => void;
  onDelete: (configId: number | undefined) => void;
  onCopy: (configId: number | undefined) => void;
  initialConfig?: Config | null;
  onExecute: (config: GalleryConfig) => void;
  executeStatus: GalleryExecuteStatus;
  onDismissExecuteError: () => void;
}

type GalleryTab = 'run' | 'settings';

const GalleryConfigWizard: React.FC<GalleryConfigWizardProps> = ({ onSave, onPublish, onDelete, onCopy, initialConfig, onExecute, executeStatus, onDismissExecuteError }) => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<GalleryTab>('run');
  const auth = useAuth();
  const loggedIn = !!auth.email;
  const [isOwner, setIsOwner] = useState(false);
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
    defaultLanguage: '',
    linkPattern: '',
    followInputRedirects: false,
    credential: '',
    imageUrlPattern: '',
    imageUrlReplacement: '',
    namePattern: '',
    nameReplacement: '',
    hint: ''
  });

  // Andere Config gewählt: wieder mit "Run" anfangen
  useEffect(() => {
    setTab('run');
  }, [initialConfig?.id]);

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

  // Bearbeiten darf nur das Konto, dem die Config gehört
  useEffect(() => {
    if (!loggedIn) {
      setIsOwner(false);
    } else if (config.name && config.id !== undefined) {
      fetch(`/api/gallery/${config.id}/check`, {
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

  const idPrefix = 'gallery-config';

  return (
    <div className="wizard-container">
      <TabBar<GalleryTab>
        idPrefix={idPrefix}
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'run', label: t('galleryConfig.tabs.run'), icon: <PlayArrowIcon /> },
          { key: 'settings', label: t('galleryConfig.tabs.settings'), icon: <SettingsIcon /> },
        ]}
      />
      <div className="tab-panel" role="tabpanel" id={tabPanelId(idPrefix, tab)} aria-labelledby={`${idPrefix}-tab-${tab}`}>
        {tab === 'run' ? (
          <GalleryConfigExecutor
            config={initialConfig && isGalleryConfig(initialConfig) ? initialConfig : null}
            handleExecute={onExecute}
            status={executeStatus}
            onDismissError={onDismissExecuteError}
          />
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
            <ConfigFieldTable
              fields={GALLERY_CONFIG_FIELDS}
              values={config}
              savedValues={initialConfig as unknown as Record<string, unknown> | null}
              editable={isOwner}
              onChange={handleInputChange}
              onJsonChange={handleParameterMapChange}
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
        )}
      </div>
    </div>
  );
};

export default GalleryConfigWizard;
