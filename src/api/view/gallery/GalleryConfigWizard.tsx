import React, { useState, useEffect } from 'react';
import SaveIcon from '@mui/icons-material/Save';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import FingerprintJS from '@fingerprintjs/fingerprintjs';
import PublicIcon from '@mui/icons-material/Public';
import LockIcon from '@mui/icons-material/Lock';
import { Config } from '../../../service/ApiFactory';
import ConfigFieldTable, { CATEGORY_OPTIONS, ConfigField } from '../ConfigFieldTable';
import { DEFAULT_LANGUAGE_OPTIONS } from '../defaultLanguages';
import ActionButton from '../../../container/inputs/ActionButton';

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
  published?: boolean;
  [key: string]: unknown;
}

const GALLERY_CONFIG_FIELDS: ConfigField[] = [
  { group: 'Base Info', name: 'name', label: 'Name', required: true },
  { group: 'Base Info', name: 'category', label: 'Category', type: 'select', options: CATEGORY_OPTIONS },
  { group: 'Base Info', name: 'officialWebsite', label: 'Official Website' },
  { group: 'Request', name: 'method', label: 'Method', type: 'select', options: [['GET', 'GET'], ['POST', 'POST']] },
  { group: 'Request', name: 'dataFormat', label: 'Data Format', type: 'select', options: [['json', 'JSON'], ['html', 'HTML']] },
  { group: 'Request', name: 'baseUrl', label: 'Base URL' },
  { group: 'Request', name: 'parameterMap', label: 'Parameter Map', type: 'json', title: 'Jeder Eintrag wird zu einem Eingabefeld. Leer lassen, wenn die Quelle keine Eingabe braucht' },
  { group: 'Request', name: 'linkPattern', label: 'Link Pattern', title: 'Regex mit benannten Gruppen, z. B. (?<id>\\d+). Die Gruppen füllen {id} usw. in der Base URL; mit Link Pattern oder Credential ruft das Backend die Quelle ab' },
  { group: 'Request', name: 'followInputRedirects', label: 'Follow Link Redirects', type: 'checkbox', title: 'Passt der Link nicht zum Pattern, zuerst seinen Weiterleitungen folgen (Kurz- und Teilen-Links)' },
  { group: 'Request', name: 'credential', label: 'Credential', title: 'Name eines Zugangs, den der Server-Betreiber hinterlegt hat (z. B. reddit). Cookie bzw. Token bleiben auf dem Server und gehen nur an den dazugehörigen Host' },
  { group: 'Locator', name: 'paginationField', label: 'Pagination Field' },
  { group: 'Locator', name: 'dataListField', label: 'Data List Field' },
  { group: 'Locator', name: 'nameField', label: 'Name Field' },
  { group: 'Locator', name: 'imageUrlField', label: 'Image URL Field' },
  { group: 'Locator', name: 'imageUrlPattern', label: 'Image URL Pattern', title: 'Regex auf die gelesene Bild-URL. Passt sie nicht, fällt der Eintrag weg (z. B. Videos, Unterordner)' },
  { group: 'Locator', name: 'imageUrlReplacement', label: 'Image URL Replacement', title: 'Ersetzung zum Pattern, Gruppen als $1, z. B. https://i.redd.it/$1' },
  { group: 'Locator', name: 'namePattern', label: 'Name Pattern', title: 'Regex auf den gelesenen Namen, z. B. \\.\\w+$ für die Dateiendung' },
  { group: 'Locator', name: 'nameReplacement', label: 'Name Replacement', title: 'Ersetzung zum Pattern, leer = entfernen' },
  { group: 'Locator', name: 'defaultLanguage', label: 'Default Language', type: 'select', options: DEFAULT_LANGUAGE_OPTIONS, title: 'Sprache für Karten, zu denen die Quelle keine Sprache liefert' },
];

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
    defaultLanguage: '',
    linkPattern: '',
    followInputRedirects: false,
    credential: '',
    imageUrlPattern: '',
    imageUrlReplacement: '',
    namePattern: '',
    nameReplacement: ''
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

  const handleSubmit = () => {
    onSave(config);
  };

  return (
    <div className="wizard-container">
      <h1 className='title is-4'>Config Settings</h1>
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

export default GalleryConfigWizard;
