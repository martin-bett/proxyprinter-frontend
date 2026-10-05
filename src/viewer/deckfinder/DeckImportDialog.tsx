import React, { useEffect, useMemo, useState } from 'react';
import { Alert, LinearProgress, TextField } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import SearchIcon from '@mui/icons-material/Search';
import SettingsIcon from '@mui/icons-material/Settings';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import ActionButton from '../../container/inputs/ActionButton';
import DeckFinderConfigManager from '../../api/view/deckfinder/DeckFinderConfigManager';
import {
  DeckFinderConfig, DeckSearchHit, LoadedDeck, getFingerprint, loadDeck, matchDeckLink, searchDecks, splitList,
} from '../../service/deckfinder/deckFinder';
import './DeckImport.css';

interface DeckImportDialogProps {
  configs: DeckFinderConfig[];
  /** Link aus dem Decklist-Feld, mit dem der Dialog geöffnet wurde */
  initialInput?: string;
  /** Beim Öffnen gleich laden bzw. suchen (aus der Section "Import Deck") */
  autoRun?: 'load' | 'search';
  /** Mit der Quellen-Verwaltung öffnen */
  startInManage?: boolean;
  onReloadConfigs: () => void;
  onLoaded: (deck: LoadedDeck, source: DeckFinderConfig) => void;
}

/** Deck per Link, ID oder Name von einer Deckbuilder-Seite laden. */
const DeckImportDialog: React.FC<DeckImportDialogProps> = ({ configs, initialInput, autoRun, startInManage, onReloadConfigs, onLoaded }) => {
  const [input, setInput] = useState(initialInput || '');
  const [configId, setConfigId] = useState<number | null>(null);
  const [boards, setBoards] = useState<string[]>([]);
  const [hits, setHits] = useState<DeckSearchHit[]>([]);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manage, setManage] = useState(!!startInManage);

  const linkConfig = useMemo(() => matchDeckLink(configs, input), [configs, input]);
  const config = linkConfig || configs.find(c => c.id === configId) || configs[0] || null;
  const optionalBoards = splitList(config?.optionalBoards);

  useEffect(() => { setBoards([]); setHits([]); setPage(1); }, [config?.id]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const load = (deckInput: string) => config && run(async () => {
    const deck = await loadDeck(config, deckInput, boards, await getFingerprint());
    onLoaded(deck, config);
  });

  const search = (nextPage: number) => config && run(async () => {
    const found = await searchDecks(config, input, nextPage, await getFingerprint());
    if (found.length === 0 && nextPage === 1) setError('Keine Decks gefunden.');
    setHits(prev => nextPage === 1 ? found : [...prev, ...found]);
    setPage(nextPage);
  });

  // Einmal beim Öffnen ausführen, sobald die Quellen da sind
  const [autoRunDone, setAutoRunDone] = useState(false);
  useEffect(() => {
    if (!autoRun || autoRunDone || !config || !input.trim()) return;
    setAutoRunDone(true);
    if (autoRun === 'search' && config.searchUrl && !linkConfig) search(1);
    else load(input);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun, autoRunDone, config?.id]);

  // Ein Link wird immer geladen; sonst sucht Enter, wenn die Quelle eine Suche hat und die Eingabe wie ein Name aussieht
  const looksLikeName = /\s/.test(input.trim()) || !/^[\w-]+$/.test(input.trim());
  const canSearch = !!config?.searchUrl && !linkConfig && input.trim() !== '';
  const submit = () => (canSearch && looksLikeName ? search(1) : load(input));

  if (manage) {
    return (
      <div className="deck-import">
        <div className="deck-import-header">
          <h3 className="title is-5">Deckfinder Sources</h3>
          <ActionButton icon={<DownloadIcon />} onClick={() => setManage(false)}>Back to import</ActionButton>
        </div>
        <DeckFinderConfigManager configs={configs} onChanged={onReloadConfigs} />
      </div>
    );
  }

  return (
    <form className="deck-import" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <div className="deck-import-header">
        <h3 className="title is-5">Import Deck</h3>
        <ActionButton icon={<SettingsIcon />} onClick={() => setManage(true)}>Sources</ActionButton>
      </div>

      <div className="deck-import-source">
        <label htmlFor="deck-import-source">Source</label>
        <select
          id="deck-import-source"
          value={config?.id ?? ''}
          disabled={!!linkConfig}
          onChange={(e) => setConfigId(Number(e.target.value))}
        >
          {configs.map(c => <option key={c.id} value={c.id}>{c.name}{c.published ? '' : ' (private)'}</option>)}
        </select>
        {config?.officialWebsite && (
          <a href={config.officialWebsite} target="_blank" rel="noreferrer" className="deck-import-site">
            {config.officialWebsite.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}<ExitToAppIcon className="inline-icon" />
          </a>
        )}
      </div>

      <TextField
        fullWidth
        autoFocus
        size="small"
        variant="outlined"
        label={config?.searchUrl ? 'Deck link, ID or deck name' : 'Deck link or ID'}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        helperText={linkConfig ? `${linkConfig.name} link recognized` : ' '}
      />

      {optionalBoards.length > 0 && (
        <div className="deck-import-boards">
          <span>Also load:</span>
          {optionalBoards.map(board => (
            <label key={board}>
              <input
                type="checkbox"
                checked={boards.includes(board)}
                onChange={(e) => setBoards(prev => e.target.checked ? [...prev, board] : prev.filter(b => b !== board))}
              />
              {board}
            </label>
          ))}
        </div>
      )}

      <div className="deck-import-actions">
        <ActionButton type="button" className="is-primary" icon={<DownloadIcon />} disabled={busy || !config || !input.trim()} onClick={() => load(input)}>
          Load deck
        </ActionButton>
        {config?.searchUrl && (
          <ActionButton type="button" icon={<SearchIcon />} disabled={busy || !canSearch} onClick={() => search(1)}>
            Search by name
          </ActionButton>
        )}
      </div>

      {busy && <LinearProgress sx={{ my: 1 }} />}
      {error && <Alert severity="warning" sx={{ my: 1 }} onClose={() => setError(null)}>{error}</Alert>}

      {hits.length > 0 && (
        <>
          <ul className="deck-import-hits">
            {hits.map(hit => (
              <li key={hit.id}>
                <button type="button" disabled={busy} onClick={() => load(hit.id)} title={`Load ${hit.name}`}>
                  {hit.image ? <img src={hit.image} alt="" loading="lazy" /> : <span className="deck-import-noimage" />}
                  <span className="deck-import-hit-name">{hit.name}</span>
                  <span className="deck-import-hit-meta">
                    {[hit.owner, hit.info && `${hit.info} cards`].filter(Boolean).join(' · ')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <ActionButton type="button" icon={<SearchIcon />} disabled={busy} onClick={() => search(page + 1)}>More results</ActionButton>
        </>
      )}
    </form>
  );
};

export default DeckImportDialog;
