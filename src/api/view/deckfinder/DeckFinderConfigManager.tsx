import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PublicIcon from '@mui/icons-material/Public';
import LockIcon from '@mui/icons-material/Lock';
import { Alert } from '@mui/material';
import ConfigFieldTable, { CATEGORY_OPTIONS, ConfigField } from '../ConfigFieldTable';
import ActionButton from '../../../container/inputs/ActionButton';
import { DeckFinderConfig, deckFinderConfigOperation, isDeckFinderConfigOwner } from '../../../service/deckfinder/deckFinder';
import { useAuth } from '../../../service/auth/auth';

const DECK_FINDER_FIELDS: ConfigField[] = [
  { group: 'configCommon.groups.baseInfo', name: 'name', label: 'configCommon.fields.name', required: true },
  { group: 'configCommon.groups.baseInfo', name: 'category', label: 'configCommon.fields.category', type: 'select', options: CATEGORY_OPTIONS },
  { group: 'configCommon.groups.baseInfo', name: 'officialWebsite', label: 'configCommon.fields.officialWebsite' },
  { group: 'configCommon.groups.request', name: 'linkPattern', label: 'configCommon.fields.linkPattern', title: 'deckFinderConfig.titles.linkPattern' },
  { group: 'configCommon.groups.request', name: 'fetchUrl', label: 'deckFinderConfig.fields.fetchUrl', title: 'deckFinderConfig.titles.fetchUrl' },
  { group: 'configCommon.groups.request', name: 'dataFormat', label: 'configCommon.fields.dataFormat', type: 'select', options: [['json', 'configCommon.options.json'], ['text', 'configCommon.options.text']] },
  { group: 'configCommon.groups.locator', name: 'deckNameField', label: 'deckFinderConfig.fields.deckNameField' },
  { group: 'configCommon.groups.locator', name: 'entryListFields', label: 'deckFinderConfig.fields.entryListFields', title: 'deckFinderConfig.titles.entryListFields' },
  { group: 'configCommon.groups.locator', name: 'quantityField', label: 'deckFinderConfig.fields.quantityField' },
  { group: 'configCommon.groups.locator', name: 'nameField', label: 'configCommon.fields.nameField' },
  { group: 'configCommon.groups.locator', name: 'setField', label: 'configCommon.fields.setField' },
  { group: 'configCommon.groups.locator', name: 'numberField', label: 'deckFinderConfig.fields.numberField', title: 'deckFinderConfig.titles.numberField' },
  { group: 'configCommon.groups.locator', name: 'boardField', label: 'deckFinderConfig.fields.boardField', title: 'deckFinderConfig.titles.boardField' },
  { group: 'configCommon.groups.locator', name: 'optionalBoards', label: 'deckFinderConfig.fields.optionalBoards', title: 'deckFinderConfig.titles.optionalBoards' },
  { group: 'configCommon.groups.search', name: 'searchUrl', label: 'deckFinderConfig.fields.searchUrl', title: 'deckFinderConfig.titles.searchUrl' },
  { group: 'configCommon.groups.search', name: 'searchListField', label: 'deckFinderConfig.fields.searchListField' },
  { group: 'configCommon.groups.search', name: 'searchIdField', label: 'deckFinderConfig.fields.searchIdField' },
  { group: 'configCommon.groups.search', name: 'searchNameField', label: 'deckFinderConfig.fields.searchNameField' },
  { group: 'configCommon.groups.search', name: 'searchOwnerField', label: 'deckFinderConfig.fields.searchOwnerField' },
  { group: 'configCommon.groups.search', name: 'searchImageField', label: 'deckFinderConfig.fields.searchImageField' },
  { group: 'configCommon.groups.search', name: 'searchInfoField', label: 'deckFinderConfig.fields.searchInfoField', title: 'deckFinderConfig.titles.searchInfoField' },
];

interface DeckFinderConfigManagerProps {
  configs: DeckFinderConfig[];
  onChanged: () => void;
}

/** Deckfinder-Configs ansehen, anlegen und bearbeiten (nur angemeldet). Andere sehen eine Config erst nach Publish. */
const DeckFinderConfigManager: React.FC<DeckFinderConfigManagerProps> = ({ configs, onChanged }) => {
  const { t } = useTranslation();
  const auth = useAuth();
  const loggedIn = !!auth.email;
  const [selectedId, setSelectedId] = useState<number | null>(configs[0]?.id ?? null);
  const selected = configs.find(c => c.id === selectedId) || null;
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [isOwner, setIsOwner] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(selected ? { ...selected } : {});
    setIsOwner(false);
    if (selected && loggedIn) isDeckFinderConfigOwner(selected.id).then(setIsOwner);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(selected), loggedIn]);

  const run = async (operation: Parameters<typeof deckFinderConfigOperation>[0], body?: Partial<DeckFinderConfig>) => {
    setError(null);
    try {
      await deckFinderConfigOperation(operation, body);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setDraft(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="deckfinder-manager">
      {error && <Alert severity="warning" sx={{ mb: 1 }} onClose={() => setError(null)}>{error}</Alert>}
      <div className="deckfinder-config-list">
        {configs.map(config => (
          <button
            type="button"
            key={config.id}
            className={`deckfinder-config-item ${config.id === selectedId ? 'is-selected' : ''}`}
            onClick={() => setSelectedId(config.id)}
          >
            {config.published ? <PublicIcon className="subCategoryIcon" /> : <LockIcon className="subCategoryIcon" />}
            {config.name}
          </button>
        ))}
        <button type="button" className="deckfinder-config-item" onClick={() => run('create')} disabled={!loggedIn}
          title={loggedIn ? undefined : t('configCommon.loginToEdit')}>
          <AddIcon className="subCategoryIcon" />{t('deckFinderConfig.new')}
        </button>
      </div>
      {selected && (
        <form onSubmit={(e) => { e.preventDefault(); run('edit', draft as Partial<DeckFinderConfig>); }}>
          <ConfigFieldTable
            fields={DECK_FINDER_FIELDS}
            values={draft}
            savedValues={selected as unknown as Record<string, unknown>}
            editable={isOwner}
            onChange={handleChange}
            onJsonChange={() => undefined}
          />
          <div className="config-actions">
            {isOwner && (
              <>
                <ActionButton type="submit" className="is-primary" icon={<SaveIcon />}>{t('common.save')}</ActionButton>
                <ActionButton
                  icon={selected.published ? <LockIcon /> : <PublicIcon />}
                  onClick={() => run('publish', { id: selected.id, published: !selected.published })}
                >
                  {selected.published ? t('configCommon.unpublish') : t('configCommon.publish')}
                </ActionButton>
                <ActionButton className="is-danger" icon={<DeleteForeverIcon />} onClick={() => run('delete', { id: selected.id })}>{t('common.delete')}</ActionButton>
              </>
            )}
            <ActionButton icon={<ContentCopyIcon />} onClick={() => run('copy', { id: selected.id })} disabled={!loggedIn}
              title={loggedIn ? undefined : t('configCommon.loginToEdit')}>{t('configCommon.copyConfig')}</ActionButton>
          </div>
          {!loggedIn && <p className="help">{t('configCommon.loginToEdit')}</p>}
        </form>
      )}
    </div>
  );
};

export default DeckFinderConfigManager;
