import React, { useEffect, useState } from 'react';
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

const DECK_FINDER_FIELDS: ConfigField[] = [
  { group: 'Base Info', name: 'name', label: 'Name', required: true },
  { group: 'Base Info', name: 'category', label: 'Category', type: 'select', options: CATEGORY_OPTIONS },
  { group: 'Base Info', name: 'officialWebsite', label: 'Official Website' },
  { group: 'Request', name: 'linkPattern', label: 'Link Pattern', title: 'Regex for deck links; the group (?<id>...) provides the deck ID' },
  { group: 'Request', name: 'fetchUrl', label: 'Fetch URL', title: 'Fetch URL with {id}' },
  { group: 'Request', name: 'dataFormat', label: 'Data Format', type: 'select', options: [['json', 'JSON'], ['text', 'Text']] },
  { group: 'Locator', name: 'deckNameField', label: 'Deck Name Field' },
  { group: 'Locator', name: 'entryListFields', label: 'Entry List Fields', title: 'Paths to the card lists, comma-separated. "*" = all values of an object, "Sideboard=path" assigns the list to a board' },
  { group: 'Locator', name: 'quantityField', label: 'Quantity Field' },
  { group: 'Locator', name: 'nameField', label: 'Name Field' },
  { group: 'Locator', name: 'setField', label: 'Set Field' },
  { group: 'Locator', name: 'numberField', label: 'Number Field', title: 'Collector number, only together with set' },
  { group: 'Locator', name: 'boardField', label: 'Board Field', title: 'Category or categories of an entry, text or list' },
  { group: 'Locator', name: 'optionalBoards', label: 'Optional Boards', title: 'Boards that are only loaded on request, comma-separated (for text: section headers)' },
  { group: 'Search', name: 'searchUrl', label: 'Search URL', title: 'Search URL with {query} and optional {page}' },
  { group: 'Search', name: 'searchListField', label: 'Result List Field' },
  { group: 'Search', name: 'searchIdField', label: 'Deck ID Field' },
  { group: 'Search', name: 'searchNameField', label: 'Deck Name Field' },
  { group: 'Search', name: 'searchOwnerField', label: 'Owner Field' },
  { group: 'Search', name: 'searchImageField', label: 'Image Field' },
  { group: 'Search', name: 'searchInfoField', label: 'Info Field', title: 'e.g. card count' },
];

interface DeckFinderConfigManagerProps {
  configs: DeckFinderConfig[];
  onChanged: () => void;
}

/** Deckfinder-Configs ansehen, anlegen und bearbeiten. Andere sehen eine Config erst nach Publish. */
const DeckFinderConfigManager: React.FC<DeckFinderConfigManagerProps> = ({ configs, onChanged }) => {
  const [selectedId, setSelectedId] = useState<number | null>(configs[0]?.id ?? null);
  const selected = configs.find(c => c.id === selectedId) || null;
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [isOwner, setIsOwner] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(selected ? { ...selected } : {});
    setIsOwner(false);
    if (selected) isDeckFinderConfigOwner(selected.id).then(setIsOwner);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(selected)]);

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
        <button type="button" className="deckfinder-config-item" onClick={() => run('create')}>
          <AddIcon className="subCategoryIcon" />New
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
                <ActionButton type="submit" className="is-primary" icon={<SaveIcon />}>Save</ActionButton>
                <ActionButton
                  icon={selected.published ? <LockIcon /> : <PublicIcon />}
                  onClick={() => run('publish', { id: selected.id, published: !selected.published })}
                >
                  {selected.published ? 'Unpublish' : 'Publish'}
                </ActionButton>
                <ActionButton className="is-danger" icon={<DeleteForeverIcon />} onClick={() => run('delete', { id: selected.id })}>Delete</ActionButton>
              </>
            )}
            <ActionButton icon={<ContentCopyIcon />} onClick={() => run('copy', { id: selected.id })}>Copy Config</ActionButton>
          </div>
        </form>
      )}
    </div>
  );
};

export default DeckFinderConfigManager;
