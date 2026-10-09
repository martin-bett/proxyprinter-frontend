import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { imageLoaderService, loadImageElement } from '../service/cache/ImageLoaderService';
import SearchCacheService, { SearchApiResult } from '../service/cache/SearchCacheService';
import serverSearchCache, { ServerLookup, fetchServerCacheEnabled, lookupKey } from '../service/cache/ServerSearchCache';
import ImageSelectDialog from './grid/ImageSelectDialog';
import PdfProgressDialog, { ProgressDto, isFinished } from './pdf/PdfProgressDialog';
import '../viewer/CardGrid.css';
import { SettingsDialog, defaultSettings, PdfSettings } from './pdf/SettingsDialog';
import { fetchPdfMailEnabled } from './pdf/pdfEmail';
import { useAuth } from '../service/auth/auth';
import { DEFAULT_MAX_PDF_SIZE_MB, PdfImageEntry, bytesToMb, estimatePdfBytes, fetchPdfSizeLimitMb, formatMb } from './pdf/pdfSizeLimit';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import LocalPrintshopOutlinedIcon from '@mui/icons-material/LocalPrintshopOutlined';
import SearchIcon from '@mui/icons-material/Search';
import SettingsIcon from '@mui/icons-material/Settings';
import CropIcon from '@mui/icons-material/Crop';
import FindReplaceIcon from '@mui/icons-material/FindReplace';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CardImage, { CardImageError } from './grid/CardImage';
import CardTitle from './grid/CardTitle';
import RecropDialog from './grid/crop/RecropDialog';
import AddCardDialog, { SaveCustomCardFn } from './grid/AddCardDialog';
import LinkListDialog, { nameFromLink } from './grid/LinkListDialog';
import GalleryConfigDialog from '../api/view/gallery/GalleryConfigDialog';
import DeckImportDialog from './deckfinder/DeckImportDialog';
import { DeckFinderConfig, LoadedDeck, fetchDeckFinderConfigs, getFingerprint, loadDeck, matchDeckLink } from '../service/deckfinder/deckFinder';
import { parseDecklist } from '../service/deck/deckParser';
import { loadSetCatalog } from '../service/deck/setCatalog';
import DownloadIcon from '@mui/icons-material/Download';
import CloseIcon from '@mui/icons-material/Close';
import TuneIcon from '@mui/icons-material/Tune';
import ApiConfigDialog from '../api/view/api/ApiConfigDialog';
import { fetchVisibleConfigs, markConfigsUsed, refreshStoredSelection } from '../api/view/api/configSelection';
import TranslateIcon from '@mui/icons-material/Translate';
import AddIcon from '@mui/icons-material/Add';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import LinkIcon from '@mui/icons-material/Link';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import PaletteIcon from '@mui/icons-material/Palette';
import PayPalDonateButton from './info/PayPalDonateButton';
import GitHubButton from './info/GitHubButton';
import TitleDiv from '../svg/TitleDiv';
import { setLoadingProgressTitle } from '../service/tabTitle';
import VersionInfo from './info/VersionInfo';
import ThemeChooser from '../theme/ThemeChooser';
import TutorialMenu from '../tutorial/TutorialMenu';
import LanguageChooser from '../i18n/LanguageChooser';
import { Minus, Plus } from 'lucide-react';
import EyeTriangle from '../svg/EyeTriangle';
import { Dialog } from '@mui/material';
import ClosableDialog from '../container/ClosableDialog';
import ChoiceButton from '../container/inputs/ChoiceButton';
import { onlyThisHint } from '../container/inputs/useLongPress';
import { fetchAndSelectAllConfigs, loadSavedConfigs } from '../service/configs/initialConfigs';
import CollapsibleSection from '../container/inputs/CollapsibleSection';
import SortableList, { PriorityRank } from '../container/inputs/SortableList';
import { ManualPicksMap, applyOrder, computeSelection, priorityRank } from './filterPriority';
import useFilterOrder from './useFilterOrder';
import SnapshotSection from './snapshot/SnapshotSection';
import { useSnapshots } from './snapshot/useSnapshots';
import { RestoredState, WorkState } from '../service/snapshot/snapshot';
import { pdfFileName } from '../service/snapshot/snapshotBackend';
import LanguageFlag from '../container/LanguageFlag';
import ActionButton from '../container/inputs/ActionButton';
import CategoryToggle from '../container/inputs/CategoryToggle';
import MemoryButtons from './cache/MemoryButtons';
import ApiFactory, { ApiConfig, Config, CropSettings, ImageInfo, PageProgress, SearchResult, hasConnectedCards } from '../service/ApiFactory';
import DisclaimerDialog from './info/DisclaimerDialog';
import RawDataDialog from './log/RawDataDialog';
import SearchLogPanel from './log/SearchLogPanel';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import { replaceDeckEntry } from './replaceDeckEntry';
import { splitCardFaces } from './cardFaces';
import { collectConnectedCards, dedupeResults } from './connectedCards';
import { CardGroup, CardResult, CardResultsMap, DeckEntry, GroupedResults, LogEntry, SelectedCardsMap } from '../api/types/types';
import { adjustSelectionForCountChange } from './selectionUtils';

const NO_LANGUAGE = 'No Language';
const languageOfCard = (card: CardResult) => card.languageCode || NO_LANGUAGE;

/** Languages and APIs that occur in the given results; custom cards are always shown and therefore ignored. */
const collectFilterOptions = (results: CardResultsMap) => {
  const languages = new Set<string>();
  const apis = new Set<string>();
  Object.values(results).forEach(cardData => {
    cardData.results.forEach(card => {
      if (card.apiName === 'custom') {
        return;
      }
      languages.add(card.languageCode || NO_LANGUAGE);
      if (card.apiName) {
        apis.add(card.apiName);
      }
    });
  });
  return { languages, apis };
};

const defaultCropSettings: CropSettings = {
  offSetX: 0, // Default value for CropSettings
  offSetY: 0, // Default value for CropSettings
  width: 0, // Default value for CropSettings
  height: 0, // Default value for CropSettings
  isStretch: true
};

/** Laufender Netzsuch-Eintrag im Search Log */
interface NetworkLog {
  onPage: (progress: PageProgress) => void;
  finish: (entry: LogEntry) => void;
}

const SEARCH_CONNECTED_KEY = 'searchConnectedCards';
const USE_SERVER_CACHE_KEY = 'useServerSearchCache';

const DeckInputAndViewer: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [decklist, setDecklist] = useState('');
  const [appendMode, setAppendMode] = useState(false);
  const [cardResults, setCardResults] = useState<CardResultsMap>({});
  const [settings, setSettings] = useState<PdfSettings>(defaultSettings);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Fortschritt auch im Tab-Titel zeigen, solange Karten aus den APIs geladen werden
  useEffect(() => {
    setLoadingProgressTitle(isLoading ? progress : null);
  }, [isLoading, progress]);
  const [rawDataDialog, setRawDataDialog] = useState<string | null>(null);
  const [searchLogOpen, setSearchLogOpen] = useState(() => {
    try {
      return localStorage.getItem('search-log-open') === 'true';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('search-log-open', String(searchLogOpen));
    } catch {
      // Ohne localStorage bleibt der Zustand nur bis zum Neuladen erhalten
    }
  }, [searchLogOpen]);
  const [categoryStates, setCategoryStates] = useState<Record<string, boolean>>({});
  const [apiConfigs, setApiConfigs] = useState<Record<string, Config>>({}); // New state for API configs
  const [apiFactory, setApiFactory] = useState<ApiFactory | null>(null); // State for API factory
  const [enabledApis, setEnabledApis] = useState<Record<string, boolean>>({});
  const [selectedCards, setSelectedCards] = useState<SelectedCardsMap>({});
  const [currentCardName, setCurrentCardName] = useState<string | null>(null);
  const [currentCardIndex, setCurrentCardIndex] = useState<number | null>(null);
  const [visibleLanguages, setVisibleLanguages] = useState<Set<string>>(new Set());
  const [visibleApis, setVisibleApis] = useState<Set<string>>(new Set());
  // Manuell im Bildauswahl-Dialog gewählte Bilder: gehen vor der Filter-Priorität, solange sie passen
  const [manualPicks, setManualPicks] = useState<ManualPicksMap>({});
  // Gerade im Dialog gewählt (Kartenname#Platz): bleibt bis zur nächsten Filteränderung, auch wenn der Filter es nicht zeigt
  const [freshPicks, setFreshPicks] = useState<Set<string>>(new Set());
  const [storedLanguageOrder, reorderLanguages] = useFilterOrder('languages');
  const [storedApiOrder, reorderApis] = useFilterOrder('apis');
  const [pdfProgressDtos, setPdfProgressDtos] = useState<ProgressDto[]>([]);
  const [pdfProgressError, setPdfProgressError] = useState<string | null>(null);
  const pdfPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [uniquePrints, setUniquePrints] = useState(true);
  // Verbundene Karten (Tokens usw.) beim Analysieren mitsuchen, gemerkt pro Browser
  const [searchConnected, setSearchConnected] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SEARCH_CONNECTED_KEY) !== 'false';
    } catch {
      return true;
    }
  });
  // Gemeinsamen Such-Cache im Backend nutzen (lesen und füllen), gemerkt pro Browser
  const [useServerCache, setUseServerCache] = useState<boolean>(() => {
    try {
      return localStorage.getItem(USE_SERVER_CACHE_KEY) !== 'false';
    } catch {
      return true;
    }
  });
  // Backend kann den Such-Cache abschalten (searchcache.enabled=false, z. B. in PR-Testumgebungen)
  const [serverCacheAvailable, setServerCacheAvailable] = useState(true);
  const serverCacheActive = useServerCache && serverCacheAvailable;
  useEffect(() => {
    fetchServerCacheEnabled().then(setServerCacheAvailable);
  }, []);
  const [showImageSettings, setShowImageSettings] = useState(false);

  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [imageSelectDialogOpen, setImageSelectDialogOpen] = useState(false);
  // Eigene Karte, deren Zuschnitt gerade nachträglich geändert wird
  const [recropTarget, setRecropTarget] = useState<{ cardKey: string; card: CardResult } | null>(null);
  const [pdfProgressDialogOpen, setPdfProgressDialogOpen] = useState(false);
  const [customCardDialogOpen, setCustomCardDialogOpen] = useState(false);
  const [customCardMaskOpen, setCustomCardMaskOpen] = useState(false);
  // Eintrag ohne Fund, den der Add-Single-Dialog gerade ersetzt (null = normales Hinzufügen)
  const [replaceTarget, setReplaceTarget] = useState<string | null>(null);
  const [galleryDialogOpen, setGalleryDialogOpen] = useState(false);
  const [linkListDialogOpen, setLinkListDialogOpen] = useState(false);
  // Deckfinder: Decks per Link, ID oder Name von Deckbuilder-Seiten laden
  const [deckFinderConfigs, setDeckFinderConfigs] = useState<DeckFinderConfig[]>([]);
  const [deckImport, setDeckImport] = useState<{ open: boolean; input?: string; autoRun?: 'load' | 'search'; manage?: boolean }>({ open: false });
  const [deckImportInput, setDeckImportInput] = useState('');
  const [pendingDeck, setPendingDeck] = useState<LoadedDeck | null>(null);
  const [deckLinkStatus, setDeckLinkStatus] = useState<{ loading: boolean; error?: string }>({ loading: false });
  const [apiConfigDialogOpen, setApiConfigDialogOpen] = useState(false);
  const [disclaimerOpen, setDisclaimerOpen] = useState(true);
  const [gridSize, setGridSize] = useState(10); // Standardwert: 10rem


  useEffect(() => {
    setApiFactory(new ApiFactory(apiConfigs));
    imageLoaderService.setProxyImageApis(
      Object.values(apiConfigs).filter(config => (config as ApiConfig).proxyImages).map(config => config.name)
    );
  }, [apiConfigs]);

  useEffect(() => {
    const saved = loadSavedConfigs();
    if (saved) {
      handleSaveApiConfigs(saved);
      // Gespeicherte Auswahl kann veraltet sein, aktuelle Fassung nachladen
      fetchVisibleConfigs()
        .then(fresh => {
          const updated = refreshStoredSelection(fresh);
          if (updated) handleSaveApiConfigs(updated);
        })
        .catch(error => console.error('Error refreshing configs:', error));
    } else {
      fetchAndSelectAllConfigs()
        .then(handleSaveApiConfigs)
        .catch(error => console.error('Error loading initial API configs:', error));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Neu hinzugekommene APIs sind standardmäßig aktiv, bestehende An/Aus-Zustände bleiben
  useEffect(() => {
    setEnabledApis(prev => {
      const missing = Object.keys(apiConfigs).filter(name => !(name in prev));
      if (missing.length === 0) return prev;
      const updated = { ...prev };
      missing.forEach(name => { updated[name] = true; });
      return updated;
    });
  }, [apiConfigs]);

  // Filter options always reflect the current search results only
  const { languages: availableLanguages, apis: availableApis } = useMemo(
    () => collectFilterOptions(cardResults),
    [cardResults]
  );
  // Priorität = Reihenfolge in den Filtern, oben gewinnt
  const languageOrder = useMemo(
    () => applyOrder(storedLanguageOrder, availableLanguages),
    [storedLanguageOrder, availableLanguages]
  );
  const apiOrder = useMemo(
    () => applyOrder(storedApiOrder, Object.values(apiConfigs).map(config => config.name).filter(name => availableApis.has(name)).concat(Array.from(availableApis))),
    [storedApiOrder, apiConfigs, availableApis]
  );

  useEffect(() => {
    const initialCategoryStates: Record<string, boolean> = {};
    const categories = [...new Set(Object.values(apiConfigs).map(config => config.category))];
    categories.forEach(category => {
      initialCategoryStates[category] = false;
    });
    setCategoryStates(initialCategoryStates);
  }, [apiConfigs]);

  const addToLog = (entry: LogEntry) => {
    setLog((prevLog) => [...prevLog, entry]);
  };

  // Netzsuchen stehen sofort im Log (läuft noch) und werden nach jeder fertigen Seite aktualisiert.
  // Wurde das Log inzwischen geleert, kommt ein später fertiger Eintrag nicht zurück.
  const nextLogId = useRef(0);
  const startNetworkLog = (configName: string, cardName: string, startedAt: number): NetworkLog => {
    const id = ++nextLogId.current;
    setLog((prevLog) => [...prevLog, { id, configName, cardName, source: 'running', count: 0, durationMs: 0, requestCount: 0 }]);
    const replace = (entry: LogEntry) => setLog((prevLog) => prevLog.map(other => (other.id === id ? { ...entry, id } : other)));
    return {
      onPage: ({ count, requestCount }) => replace({ configName, cardName, source: 'running', count, requestCount, durationMs: performance.now() - startedAt }),
      finish: replace,
    };
  };
  const finishLog = (entry: LogEntry, run: NetworkLog | undefined) => (run ? run.finish(entry) : addToLog(entry));

  const handleSettingsChange = (newSettings: PdfSettings) => {
    setSettings(newSettings);
  };

  const handleAddCustomCard = () => {
    setReplaceTarget(null);
    setCustomCardDialogOpen(true);
  };

  /** Eintrag ohne Fund ganz aus dem Deck nehmen (alle Exemplare). */
  const handleDiscardEntry = (cardName: string) => {
    const drop = <T,>(prev: Record<string, T>) => {
      if (!(cardName in prev)) return prev;
      const next = { ...prev };
      delete next[cardName];
      return next;
    };
    setCardResults(drop);
    setSelectedCards(drop);
    setManualPicks(drop);
    setFreshPicks(new Set());
  };

  const handleReplaceCard = (cardName: string) => {
    setReplaceTarget(cardName);
    setCustomCardDialogOpen(true);
  };

  const handleCloseCustomCardDialog = () => {
    setCustomCardDialogOpen(false);
    setReplaceTarget(null);
  };

  const handleOpenGalleryDialog = () => {
    setGalleryDialogOpen(true);
  };

  const handleCloseGalleryDialog = () => {
    setGalleryDialogOpen(false);
  };

  const handleGalleryResults = (results: SearchResult[]) => {
    if (results) {
      results.forEach(r => handleSaveCustomCard(r.name, r.imageUrl, null));
    }
    handleCloseGalleryDialog();
  };

  // Eingefügte Bildlinks wie Galerie-Treffer übernehmen: ganzes Bild, ohne Zuschnitt
  const handleLinkList = (links: string[]) => {
    links.forEach(link => handleSaveCustomCard(nameFromLink(link), link, null));
    setLinkListDialogOpen(false);
  };

  const handleCloseApiConfigDialog = () => {
    setApiConfigDialogOpen(false);
  };

  const handleGridSizeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setGridSize(Number(event.target.value));
  };


  const handleSaveApiConfigs = async (apiconfigList: Config[]) => {
    const configsObject = apiconfigList.reduce((acc: Record<string, Config>, config) => {
      if (config.name) {
        acc[config.name] = config;
      }
      return acc;
    }, {});
    console.log('Saving new API configs:', configsObject);
    setApiConfigs(configsObject); // Update internal API configs state
  };

  /** Neue Einträge ins Deck: ans Ende oder, mit replaceKey, an die Stelle dieses Eintrags (der dann wegfällt). */
  const insertDeckEntries = (entries: CardResultsMap, replaceKey: string | null) => {
    if (replaceKey === null) {
      setCardResults(prev => ({ ...prev, ...entries }));
      return;
    }
    setCardResults(prev => replaceDeckEntry(prev, replaceKey, entries));
    const dropOld = <T,>(prev: Record<string, T>) => {
      if (!(replaceKey in prev)) return prev;
      const next = { ...prev };
      delete next[replaceKey];
      return next;
    };
    setSelectedCards(dropOld);
    setManualPicks(dropOld);
    setFreshPicks(new Set());
  };

  const addCustomCrops = (cardName: string, imageUrl: string, crops: CropSettings[], replaceKey: string | null = null) => {
    // Freie Schlüssel wählen, damit ein zweites Bild mit gleichem Namen keine Karte überschreibt
    const usedKeys = new Set(Object.keys(cardResults).filter(key => key !== replaceKey));
    const cropKeys: string[] = [];
    for (let i = 0; cropKeys.length < crops.length; i++) {
      const key = `${cardName}_crop${i}`;
      if (!usedKeys.has(key)) cropKeys.push(key);
    }
    // Eintrag in cardResults für jeden Zuschnitt
    const entries: CardResultsMap = {};
    crops.forEach((crop, cropIndex) => {
      entries[cropKeys[cropIndex]] = {
        count: 1,
        results: [{
          name: cardName,
          imageUrl,
          apiName: 'custom',
          languageCode: NO_LANGUAGE,
          cropSettings: crop,
        }],
      };
    });
    insertDeckEntries(entries, replaceKey);
    setSelectedCards((prev) => {
      const next = { ...prev };
      Object.entries(entries).forEach(([key, group]) => { next[key] = [group.results[0]]; });
      return next;
    });
  };

  /** Neuer Zuschnitt für eine eigene Karte: der erste ersetzt sie, weitere (Cut gallery) kommen als neue Karten dazu. */
  const handleApplyRecrop = (cardKey: string, oldCard: CardResult, crops: CropSettings[]) => {
    const [first, ...rest] = crops;
    const newCard: CardResult = { ...oldCard, cropSettings: first, imageInfo: undefined };
    setCardResults((prev) => {
      const group = prev[cardKey];
      if (!group) return prev;
      return { ...prev, [cardKey]: { ...group, results: group.results.map((r) => (r === oldCard ? newCard : r)) } };
    });
    setSelectedCards((prev) => {
      const slots = prev[cardKey];
      if (!slots) return prev;
      return { ...prev, [cardKey]: slots.map((c) => (c === oldCard ? newCard : c)) };
    });
    setManualPicks((prev) => {
      const picks = prev[cardKey];
      if (!picks || !picks.includes(oldCard)) return prev;
      return { ...prev, [cardKey]: picks.map((c) => (c === oldCard ? newCard : c)) };
    });
    if (rest.length > 0) addCustomCrops(oldCard.name, oldCard.imageUrl, rest);
  };

  const handleSaveCustomCard: SaveCustomCardFn = async (cardName, imageUrl, file, crops) => {
    let finalImageUrl: string | undefined;
    if (imageUrl) {
      finalImageUrl = imageUrl;
    }
    if (file) {
      finalImageUrl = '/api/files/download/' + file;
    }
    if (!finalImageUrl) return;
    const url = finalImageUrl;
    const replaceKey = replaceTarget;

    if (crops && crops.length > 0) {
      // Zuschnitte kommen fertig aus der Maske
      addCustomCrops(cardName, url, crops, replaceKey);
    } else {
      // Ganzes Bild: Bild laden, um die Dimensionen zu ermitteln (Google Drive u.ä. nur über den Backend-Proxy)
      loadImageElement(url)
        .then(img => {
          addCustomCrops(cardName, url, [{ offSetX: 0, offSetY: 0, width: img.width, height: img.height, isStretch: true }], replaceKey);
        })
        .catch(error => {
          console.error('Error loading the image. Check the URL.', url, error);
        });
    }

    handleCloseCustomCardDialog();
  };


  useEffect(() => {
    if (typeof apiConfigs === 'object' && apiConfigs !== null && apiFactory !== null) {
      const configs = Object.values(apiConfigs);
      apiFactory.updateConfigs(configs);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleWebsiteClick = (url: string, event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault(); // Klick auf den Link soll die API nicht umschalten
    window.open(url, "_blank");
  };

  const filterCard = useMemo(() => (card: CardResult) => {
    return (visibleLanguages.has(card.languageCode || NO_LANGUAGE) &&
      visibleApis.has(card.apiName) || card.apiName === 'custom');
  }, [visibleLanguages, visibleApis]);

  // Lädt das Objekt, auf das eine verbundene Karte zeigt (z.B. das Treasure-Token bei Scryfall). Fehler kosten nur dieses Bild.
  const fetchLinkedConnectedCard = async (apiKey: string | undefined, link: string | undefined, cardName: string): Promise<SearchResult[]> => {
    if (!apiKey || !link || !apiFactory) return [];
    const cacheName = `link:${link}`;
    const startedAt = performance.now();
    let run: NetworkLog | undefined;
    try {
      if (await SearchCacheService.hasSearchResult(apiKey, cacheName)) {
        const cached = await SearchCacheService.getSearchResult(apiKey, cacheName);
        return cached?.results || [];
      }
      const config = apiConfigs[apiKey];
      if (serverCacheActive && config) {
        const fromServer = (await serverSearchCache.lookup([{ apiKey, config, term: cacheName }])).get(lookupKey(apiKey, cacheName));
        if (fromServer) {
          await SearchCacheService.setSearchResult(apiKey, cacheName, fromServer);
          addToLog({ configName: apiKey, cardName, source: 'server', count: fromServer.results.length, durationMs: performance.now() - startedAt, requestCount: 0, rawResponse: fromServer.rawResponse });
          return fromServer.results;
        }
      }
      run = startNetworkLog(apiKey, cardName, startedAt);
      const fetched = await apiFactory.fetchConnectedCard(apiKey, link, cardName);
      const result = { ...fetched, results: fetched.results.map(card => ({ ...card, connectedCards: undefined })) };
      await SearchCacheService.setSearchResult(apiKey, cacheName, result);
      if (serverCacheActive && config) serverSearchCache.put(config, cacheName, result);
      finishLog({ configName: apiKey, cardName, source: 'network', count: result.results.length, durationMs: performance.now() - startedAt, requestCount: result.requestCount, rawResponse: result.rawResponse }, run);
      return result.results;
    } catch (error) {
      finishLog({ configName: apiKey, cardName, source: 'error', count: 0, durationMs: performance.now() - startedAt, error: error instanceof Error ? error.message : String(error) }, run);
      return [];
    }
  };

  // Fragt den Server-Cache gesammelt nach allen Suchen, die der lokale Cache nicht hat
  const lookupServerCache = async (apiKeys: string[], terms: string[]): Promise<Map<string, SearchApiResult>> => {
    if (!serverCacheActive) return new Map();
    const pairs = apiKeys.flatMap(apiKey => terms.map(term => ({ apiKey, term })));
    const locallyCached = await Promise.all(pairs.map(({ apiKey, term }) => SearchCacheService.hasSearchResult(apiKey, term).catch(() => false)));
    const requests: ServerLookup[] = pairs
      .filter((pair, index) => !locallyCached[index] && apiConfigs[pair.apiKey])
      .map(pair => ({ ...pair, config: apiConfigs[pair.apiKey] }));
    return serverSearchCache.lookup(requests);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Neue Suche = neues Deck: der geladene Snapshot wird ab jetzt nicht mehr überschrieben
    snapshots.release();
    setIsLoading(true);
    if (!appendMode) {
      setCardResults({});
    }
    setLog([]);
    setProgress(0);

    // Gleiche Karte aus mehreren Sets wird eine Gruppe; der Set-Wunsch gilt je Platz
    const cardEntries: DeckEntry[] = [];
    const wantedByName: Record<string, CardGroup['wanted']> = {};
    parseDecklist(decklist).forEach(entry => {
      const existing = cardEntries.find(other => other.name === entry.name);
      if (existing) existing.count += entry.count;
      else cardEntries.push({ count: entry.count, name: entry.name });
      const wanted = entry.set ? { set: entry.set, number: entry.number } : null;
      wantedByName[entry.name] = [...(wantedByName[entry.name] || []), ...Array(entry.count).fill(wanted)];
    });
    const hasWanted = Object.values(wantedByName).some(slots => slots?.some(Boolean));
    const mixedPrints = Object.values(wantedByName).some(slots =>
      new Set(slots?.map(slot => slot ? `${slot.set}|${slot.number ?? ''}`.toLowerCase() : '')).size > 1);
    if (mixedPrints) setUniquePrints(true);
    const setCatalogReady = hasWanted ? loadSetCatalog() : Promise.resolve();

    const enabledApiKeys = Object.keys(enabledApis).filter(key => enabledApis[key]);
    markConfigsUsed(enabledApiKeys.map(key => apiConfigs[key]));
    const withConnected = searchConnected && enabledApiKeys.some(key => hasConnectedCards(apiConfigs[key]));

    // Fortschritt über beide Runden; die zweite Runde (verbundene Karten) erhöht totalWork
    let totalWork = cardEntries.reduce((sum, entry) => sum + entry.count, 0) * enabledApiKeys.length;
    let completedWork = 0;
    const updateProgress = (done: number) => {
      completedWork += done;
      setProgress(totalWork > 0 ? Math.min(100, Math.round((completedWork / totalWork) * 100)) : 100);
    };

    // Group APIs
    const proxyGroup = enabledApiKeys.filter(key => apiConfigs[key]?.useBackendProxy);
    const nonProxyApis = enabledApiKeys.filter(key => !apiConfigs[key]?.useBackendProxy);

    // Function to process a single API or proxy group
    // dropConnected: Treffer der zweiten Runde (z.B. Treasure) listen bei Scryfall alle Karten, die sie erzeugen.
    // Die brauchen wir nicht, also nicht mit in den Cache schreiben.
    const processApiGroup = async (apiKeys: string[], entries: DeckEntry[], dropConnected: boolean, serverHits: Map<string, SearchApiResult>) => {
      const groupResults: Record<string, Record<string, SearchResult[]>> = {};
      for (const apiKey of apiKeys) {
        groupResults[apiKey] = {};
        const limit = (apiConfigs[apiKey] as ApiConfig)?.concurrentLimit || Infinity;
        const api = apiFactory!.createApi(apiKey);
        // Cache-Einträge von vor den verbundenen Karten kennen sie noch nicht und werden neu gesucht
        const needsConnected = withConnected && hasConnectedCards(apiConfigs[apiKey]);
        const lacksConnected = (candidate: SearchApiResult) =>
          needsConnected && (candidate.results || []).length > 0 && (candidate.results || []).every(card => card.connectedCards === undefined);

        const tasks = entries.map(entry => async () => {
          if (!groupResults[apiKey][entry.name]) {
            const startedAt = performance.now();
            let run: NetworkLog | undefined;
            try {
              let result: SearchApiResult | undefined;
              if (await SearchCacheService.hasSearchResult(apiKey, entry.name)) {
                result = await SearchCacheService.getSearchResult(apiKey, entry.name);
              }
              const cached = result?.results || [];
              const fromServer = serverHits.get(lookupKey(apiKey, entry.name));
              if (result && !lacksConnected(result)) {
                addToLog({ configName: apiKey, cardName: entry.name, source: 'cache', count: cached.length, durationMs: performance.now() - startedAt, requestCount: 0, rawResponse: result?.rawResponse });
                groupResults[apiKey][entry.name] = cached;
              } else if (fromServer && !lacksConnected(fromServer)) {
                await SearchCacheService.setSearchResult(apiKey, entry.name, fromServer);
                addToLog({ configName: apiKey, cardName: entry.name, source: 'server', count: fromServer.results.length, durationMs: performance.now() - startedAt, requestCount: 0, rawResponse: fromServer.rawResponse });
                groupResults[apiKey][entry.name] = fromServer.results;
              } else {
                run = startNetworkLog(apiKey, entry.name, startedAt);
                result = await api({ cardname: entry.name }, run.onPage);
                if (dropConnected) {
                  result = { ...result, results: result.results.map(card => (card.connectedCards ? { ...card, connectedCards: [] } : card)) };
                }
                await SearchCacheService.setSearchResult(apiKey, entry.name, result);
                if (serverCacheActive) serverSearchCache.put(apiConfigs[apiKey], entry.name, result);
                const resultsArr = result?.results || [];
                finishLog({ configName: apiKey, cardName: entry.name, source: 'network', count: resultsArr.length, durationMs: performance.now() - startedAt, requestCount: result.requestCount, rawResponse: result.rawResponse }, run);
                groupResults[apiKey][entry.name] = resultsArr;
              }
            } catch (error) {
              finishLog({ configName: apiKey, cardName: entry.name, source: 'error', count: 0, durationMs: performance.now() - startedAt, error: error instanceof Error ? error.message : String(error) }, run);
              groupResults[apiKey][entry.name] = [];
            }
          }
          updateProgress(entry.count);
        });
        await limitConcurrency(tasks, limit);
      }
      return groupResults;
    };

    // Process all API groups concurrently
    const searchAllGroups = async (entries: DeckEntry[], dropConnected = false) => {
      const serverHits = await lookupServerCache(enabledApiKeys, entries.map(entry => entry.name));
      const groupResults = await Promise.all([
        processApiGroup(proxyGroup, entries, dropConnected, serverHits),
        ...nonProxyApis.map(apiKey => processApiGroup([apiKey], entries, dropConnected, serverHits))
      ]);
      const merged: Record<string, Record<string, SearchResult[]>> = {};
      groupResults.forEach(groupResult => Object.assign(merged, groupResult));
      return merged;
    };

    const toCardResults = (apiResultsForCard: SearchResult[]): CardResult[] =>
      apiResultsForCard.map((result): CardResult => ({
        ...result,
        cropSettings: { ...defaultCropSettings }
      }));

    const apiResults = await searchAllGroups(cardEntries);

    // Combine results
    const combinedResults: CardResultsMap = {};
    cardEntries.forEach(entry => {
      const wanted = wantedByName[entry.name];
      combinedResults[entry.name] = {
        count: entry.count,
        ...(wanted?.some(Boolean) ? { wanted } : {}),
        results: enabledApiKeys.flatMap(apiKey => toCardResults(apiResults[apiKey][entry.name] || []))
      };
    });
    await setCatalogReady;
    // Andere Seiten mehrseitiger Karten werden eigene Einträge
    const deckResults = splitCardFaces(combinedResults);
    let results: CardResultsMap = deckResults;

    // Verbundene Karten (Tokens, Emblems, ...): je Name ein Eintrag mit Anzahl 1, gesucht über alle aktiven APIs
    if (withConnected) {
      const candidates = collectConnectedCards(apiResults, [...Object.keys(deckResults), ...cardEntries.map(entry => entry.name)]);
      if (candidates.length > 0) {
        const connectedEntries: DeckEntry[] = candidates.map(candidate => ({ count: 1, name: candidate.name }));
        totalWork += connectedEntries.length * (enabledApiKeys.length + 1);
        const [connectedApiResults, linkedResults] = await Promise.all([
          searchAllGroups(connectedEntries, true),
          Promise.all(candidates.map(candidate => fetchLinkedConnectedCard(candidate.links[0]?.apiKey, candidate.links[0]?.link, candidate.name)
            .finally(() => updateProgress(1))))
        ]);
        const connectedResults: CardResultsMap = {};
        candidates.forEach((candidate, index) => {
          connectedResults[candidate.name] = {
            count: 1,
            connectedFrom: candidate.parents,
            // Das exakt verlinkte Objekt zuerst, danach alle Treffer der Namenssuche
            results: dedupeResults([
              ...toCardResults(linkedResults[index]),
              ...enabledApiKeys.flatMap(apiKey => toCardResults(connectedApiResults[apiKey][candidate.name] || []))
            ])
          };
        });
        results = { ...deckResults, ...splitCardFaces(connectedResults, Object.keys(deckResults)) };
      }
    }

    const mergedResults = appendMode ? { ...cardResults, ...results } : results;

    const options = collectFilterOptions(mergedResults);
    const keptLanguages = new Set(Array.from(visibleLanguages).filter(lang => options.languages.has(lang)));
    const newVisibleLanguages = keptLanguages.size > 0 ? keptLanguages : options.languages;
    setVisibleApis(options.apis);
    setVisibleLanguages(newVisibleLanguages);
    setCardResults(mergedResults);
    setIsLoading(false);

    // Früher manuell gewählte Bilder (aus dem Such-Cache) gelten wieder als manuelle Wahl,
    // der Rest kommt aus der Filter-Priorität
    const initialManualPicks: ManualPicksMap = {};
    Object.entries(mergedResults).forEach(([cardName, cardData]) => {
      const picks = Array.from({ length: cardData.count }).map((_, index) => {
        const cachedImageUrl = SearchCacheService.getSelectedImage(cardName, index + 1);
        return cachedImageUrl ? cardData.results.find(card => card.imageUrl === cachedImageUrl) ?? null : null;
      });
      if (picks.some(pick => pick)) initialManualPicks[cardName] = picks;
    });
    setManualPicks(initialManualPicks);
    setFreshPicks(new Set());
    setSelectedCards(computeSelection({}, {
      cardResults: mergedResults,
      manualPicks: initialManualPicks,
      isVisible: card => card.apiName === 'custom' ||
        (newVisibleLanguages.has(card.languageCode || NO_LANGUAGE) && options.apis.has(card.apiName)),
      languageOrder: applyOrder(storedLanguageOrder, options.languages),
      apiOrder: applyOrder(storedApiOrder, Object.values(apiConfigs).map(config => config.name).filter(name => options.apis.has(name)).concat(Array.from(options.apis))),
      languageOf: languageOfCard,
    }));
    setAppendMode(false);
  };

  // Reihenfolge der Kacheln, wie das Raster sie zeigt. Dient dem Blättern im Bildauswahl-Dialog.
  const deckTiles = useMemo(() => Object.entries(cardResults).flatMap(([name, data]) =>
    Array.from({ length: uniquePrints ? data.count : 1 }, (_, index) => ({ name, index }))
  ), [cardResults, uniquePrints]);
  const currentTilePosition = currentCardName !== null && currentCardIndex !== null
    ? deckTiles.findIndex(tile => tile.name === currentCardName && tile.index === currentCardIndex)
    : -1;

  // Speichert die Wahl für die aktuelle Kachel (null = nichts gewählt, nur neu zeichnen)
  const applyImageChoice = (selectedImage: CardResult | null) => {
    if (selectedImage && currentCardName !== null && currentCardIndex !== null) {
      setSelectedCards(prev => {
        const currentCards = prev[currentCardName] || [];

        const newSelectedCards = {
          ...prev,
          [currentCardName]: currentCards.map((card, index) =>
            index === currentCardIndex ? selectedImage : card
          )
        };

        SearchCacheService.setSelectedImage(currentCardName, currentCardIndex + 1, selectedImage.imageUrl);
        return newSelectedCards;
      });
      const count = cardResults[currentCardName]?.count ?? currentCardIndex + 1;
      setManualPicks(prev => {
        const picks = Array.from({ length: count }, (_, index) => prev[currentCardName]?.[index] ?? null);
        picks[currentCardIndex] = selectedImage;
        return { ...prev, [currentCardName]: picks };
      });
      setFreshPicks(prev => new Set(prev).add(`${currentCardName}#${currentCardIndex}`));
    } else {
      // Ohne neue Wahl kann sich trotzdem der Zuschnitt des gewählten Bildes geändert haben
      setSelectedCards(prev => ({ ...prev }));
    }
  };

  const handleCloseImageSelectDialog = (selectedImage: CardResult | null) => {
    applyImageChoice(selectedImage);
    setImageSelectDialogOpen(false);
    setCurrentCardName(null);
    setCurrentCardIndex(null);
  };

  // Zur vorherigen/nächsten Kachel blättern, der Dialog bleibt offen
  const handleStepImageSelect = (delta: -1 | 1, selectedImage: CardResult | null) => {
    if (currentCardName === null || currentCardIndex === null) return;
    const next = deckTiles[currentTilePosition + delta];
    if (!next) return;
    applyImageChoice(selectedImage);
    imageLoaderService.stopByCategory('selectgrid');
    setCurrentCardName(next.name);
    setCurrentCardIndex(next.index);
  };

  const handleRemoveCard = (cardName: string, index: number) => {
    setCardResults(prevResults => {
      const newResults = { ...prevResults };
      if (uniquePrints && newResults[cardName].count > 1) {
        const wanted = newResults[cardName].wanted?.filter((_, i) => i !== index);
        newResults[cardName] = {
          ...newResults[cardName],
          count: newResults[cardName].count - 1,
          ...(wanted ? { wanted } : {})
        };
      } else {
        delete newResults[cardName];
      }
      return newResults;
    });

    setSelectedCards(prevSelected => {
      const newSelected = { ...prevSelected };
      if (newSelected[cardName].length > 1) {
        newSelected[cardName] = newSelected[cardName].filter((_, i) => i !== index);
      } else {
        delete newSelected[cardName];
      }
      return newSelected;
    });
    setFreshPicks(new Set());
    setManualPicks(prev => {
      if (!prev[cardName]) return prev;
      const next = { ...prev, [cardName]: prev[cardName].filter((_, i) => i !== index) };
      if (next[cardName].length === 0) delete next[cardName];
      return next;
    });
  };

  const handleCardClick = (cardName: string, index: number) => {
    setCurrentCardName(cardName);
    setCurrentCardIndex(index);
    setImageSelectDialogOpen(true);
  };

  const handleOpenSettingsDialog = () => setSettingsDialogOpen(true);
  const handleCloseSettingsDialog = () => setSettingsDialogOpen(false);

  const handleOpenApiConfigDialog = () => setApiConfigDialogOpen(true);

  const handleCloseRawDataDialog = () => {
    setRawDataDialog(null);
  };

  const toggleLanguage = (languageCode: string) => {
    setVisibleLanguages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(languageCode)) {
        newSet.delete(languageCode);
      } else {
        newSet.add(languageCode);
      }
      return newSet;
    });
  };

  const toggleApi = (apiName: string) => {
    setVisibleApis(prev => {
      const newSet = new Set(prev);
      if (newSet.has(apiName)) {
        newSet.delete(apiName);
      } else {
        newSet.add(apiName);
      }
      return newSet;
    });
  };

  // Jede Änderung an Filtern oder Priorität beendet die Ausnahme für frisch gewählte Bilder
  const filterSignature = [
    Array.from(visibleLanguages).sort(), Array.from(visibleApis).sort(), languageOrder, apiOrder,
  ].map(values => values.join('\u0001')).join('\u0002');
  useEffect(() => {
    setFreshPicks(prev => (prev.size === 0 ? prev : new Set()));
  }, [filterSignature]);

  // Filter, Priorität oder Ergebnisse geändert: Auswahl neu berechnen, manuelle Wahl geht vor
  useEffect(() => {
    setSelectedCards(prev => computeSelection(prev, {
      cardResults, manualPicks, isVisible: filterCard, languageOrder, apiOrder, languageOf: languageOfCard,
      isFreshPick: (cardName, index) => freshPicks.has(`${cardName}#${index}`),
    }));
  }, [cardResults, manualPicks, freshPicks, filterCard, languageOrder, apiOrder]);

  const handleApiToggle = (apiKey: string) => {
    setEnabledApis(prev => {
      const updated = { ...prev, [apiKey]: !prev[apiKey] };
      return updated;
    });
  };

  const handleCategoryToggle = (category: string) => {
    const categoryApis = Object.values(apiConfigs).filter(config => config.category === category);
    const allChecked = categoryApis.every(config => enabledApis[config.name]);
    const newState = !allChecked;

    setEnabledApis(prev => {
      const updated = { ...prev };
      categoryApis.forEach(config => {
        updated[config.name] = newState;
      });
      return updated;
    });

    setCategoryStates(prev => ({ ...prev, [category]: newState }));
  };



  const getCategoryState = (category: string): 'unchecked' | 'checked' | 'indeterminate' => {
    const categoryApis = Object.values(apiConfigs).filter(config => config.category === category);
    const checkedCount = categoryApis.filter(config => enabledApis[config.name]).length;

    if (checkedCount === 0) return 'unchecked';
    if (checkedCount === categoryApis.length) return 'checked';
    return 'indeterminate';
  };

  const stopPdfPolling = useCallback(() => {
    if (pdfPollingRef.current) {
      clearInterval(pdfPollingRef.current);
      pdfPollingRef.current = null;
    }
  }, []);

  useEffect(() => stopPdfPolling, [stopPdfPolling]);

  // Alle Karten, die ins PDF kommen, mit Bildinfos für die Größenschätzung
  const pdfImageEntries = useMemo<PdfImageEntry[]>(() => {
    // Die Auswahl kann eine Kopie sein, die Bildinfos hängen am Ergebnis in cardResults
    const withInfo = (cardName: string, card: CardResult): PdfImageEntry => ({
      imageUrl: card.imageUrl,
      cropSettings: card.cropSettings,
      imageInfo: card.imageInfo
        ?? cardResults[cardName]?.results.find(r => r.imageUrl === card.imageUrl && r.imageInfo)?.imageInfo,
    });
    return Object.entries(selectedCards).flatMap(([cardName, cardSelections]) => {
      if (uniquePrints) {
        // Wenn uniquePrints true ist, nehmen wir alle URLs mit cropSettings wie sie sind
        return cardSelections
          .filter((selectedCard): selectedCard is CardResult => !!selectedCard?.imageUrl)
          .map(selectedCard => withInfo(cardName, selectedCard));
      }
      // Wenn uniquePrints false ist, nehmen wir die erste gültige URL und duplizieren sie entsprechend dem count
      const firstValidCard = cardSelections.find((selectedCard): selectedCard is CardResult => !!selectedCard?.imageUrl);
      if (!firstValidCard) return [];
      const count = cardResults[cardName]?.count || 1;
      return Array(count).fill(withInfo(cardName, firstValidCard));
    });
  }, [selectedCards, cardResults, uniquePrints]);

  const [pdfSizeLimitMb, setPdfSizeLimitMb] = useState(DEFAULT_MAX_PDF_SIZE_MB);
  const [pdfMailEnabled, setPdfMailEnabled] = useState(false);
  const auth = useAuth();
  const pdfSendMail = pdfMailEnabled && settings.sendMail && !!auth.email;
  useEffect(() => {
    fetchPdfSizeLimitMb().then(setPdfSizeLimitMb);
    fetchPdfMailEnabled().then(setPdfMailEnabled);
  }, []);
  // Seitenvorschau im Einstellungsdialog: nur die ersten Karten, so viele wie auf eine Seite passen
  const settingsPreviewCards = useMemo(
    () => pdfImageEntries.slice(0, 40).map(({ imageUrl, cropSettings }) => ({ imageUrl, cropSettings })),
    [pdfImageEntries]
  );
  const estimatedPdfBytes = useMemo(() => estimatePdfBytes(pdfImageEntries, settings), [pdfImageEntries, settings]);
  const pdfTooLarge = bytesToMb(estimatedPdfBytes) > pdfSizeLimitMb;

  // Snapshots: Arbeitsstand lokal sichern und wiederherstellen (unabhängig von der Suche)
  const workState = useMemo<WorkState>(() => ({
    decklist, cardResults, selectedCards, manualPicks, enabledApis, visibleLanguages, visibleApis, uniquePrints, settings,
  }), [decklist, cardResults, selectedCards, manualPicks, enabledApis, visibleLanguages, visibleApis, uniquePrints, settings]);

  const applySnapshot = useCallback((restored: RestoredState) => {
    // Alles in einem Schritt setzen, sonst setzt der Filter-Effekt die geladene Auswahl zurück
    setDecklist(restored.decklist);
    setVisibleLanguages(restored.visibleLanguages);
    setVisibleApis(restored.visibleApis);
    setUniquePrints(restored.uniquePrints);
    setCardResults(restored.cardResults);
    if (Object.values(restored.cardResults).some(group => group.wanted)) loadSetCatalog();
    setSelectedCards(restored.selectedCards);
    setManualPicks(restored.manualPicks);
    setFreshPicks(new Set());
    setSettings(prev => ({ ...restored.settings, sendMail: prev.sendMail }));
    setEnabledApis(prev => {
      const wanted = new Set(restored.enabledApis);
      const updated: Record<string, boolean> = {};
      Object.keys(prev).forEach(name => { updated[name] = wanted.has(name); });
      wanted.forEach(name => { if (!(name in updated)) updated[name] = true; });
      return updated;
    });
    setLog([]);
  }, []);

  const snapshots = useSnapshots({ state: workState, isBusy: isLoading, apply: applySnapshot });

  // Deck zurücksetzen: vorher ein Snapshot (bzw. der aktive überschrieben), damit man den Stand zurückholen kann.
  // APIs, Filter und PDF-Einstellungen bleiben, die nächste Analyse setzt die Filter neu.
  const saveSnapshot = snapshots.saveAndRelease;
  const resetDeck = useCallback(async () => {
    await saveSnapshot();
    setDecklist('');
    setCardResults({});
    setSelectedCards({});
    setManualPicks({});
    setFreshPicks(new Set());
    setCurrentCardName(null);
    setCurrentCardIndex(null);
    setLog([]);
    setProgress(0);
  }, [saveSnapshot]);
  const pdfDownloadNameRef = useRef('deck');

  const reloadDeckFinderConfigs = useCallback(async () => {
    try {
      setDeckFinderConfigs(await fetchDeckFinderConfigs(await getFingerprint()));
    } catch (e) {
      console.error('Could not load deckfinder configs:', e);
    }
  }, []);
  useEffect(() => { reloadDeckFinderConfigs(); }, [reloadDeckFinderConfigs]);

  // Quelle zum Link im Feld der Section "Import Deck"
  const detectedDeckSource = useMemo(() => matchDeckLink(deckFinderConfigs, deckImportInput), [deckFinderConfigs, deckImportInput]);

  // Geladenes Deck ersetzt die Liste; steht schon eine Liste da, erst fragen und einen Snapshot anlegen
  const applyLoadedDeck = useCallback(async (deck: LoadedDeck, confirmed = false) => {
    const hasList = decklist.trim() !== '';
    if (hasList && !confirmed) {
      setPendingDeck(deck);
      return;
    }
    if (hasList) await saveSnapshot();
    setPendingDeck(null);
    setDeckImport({ open: false });
    setDeckLinkStatus({ loading: false });
    setDeckImportInput('');
    setDecklist(deck.text);
  }, [decklist, saveSnapshot]);

  // Erkannter Link lädt direkt (nur Hauptdeck); ID ohne Link oder Name öffnet den Dialog
  const handleImportDeck = async () => {
    const input = deckImportInput.trim();
    if (!input) return;
    if (!detectedDeckSource) {
      setDeckImport({ open: true, input, autoRun: 'load' });
      return;
    }
    setDeckLinkStatus({ loading: true });
    try {
      const deck = await loadDeck(detectedDeckSource, input, [], await getFingerprint());
      await applyLoadedDeck(deck);
    } catch (e) {
      setDeckLinkStatus({ loading: false, error: e instanceof Error ? e.message : String(e) });
    }
  };

  const createPDF = async () => {
    if (pdfTooLarge) return;
    stopPdfPolling();
    setPdfProgressDtos([]);
    setPdfProgressError(null);
    setPdfProgressDialogOpen(true);

    const { sendMail, ...pdfSettings } = settings;
    const createPdfDto = {
      images: pdfImageEntries.map(({ imageUrl, cropSettings }) => ({ imageUrl, cropSettings })),
      settings: pdfSettings,
      ...(pdfSendMail ? { sendMail: true, language: i18n.language } : {})
    };
    try {
      const response = await fetch('/api/pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createPdfDto),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const progressId = await response.text();
      pdfDownloadNameRef.current = 'deck';
      snapshots.saveGenerate(progressId).then(label => {
        if (label) pdfDownloadNameRef.current = pdfFileName(label);
      });

      // Das Backend liefert die komplette Fortschritts-Historie, wir pollen bis "finishing" fertig oder fehlgeschlagen ist
      const poll = async () => {
        try {
          const progressResponse = await fetch(`/api/progress/${progressId}`);
          if (!progressResponse.ok) {
            throw new Error(`HTTP error! status: ${progressResponse.status}`);
          }
          const dtos: ProgressDto[] = await progressResponse.json();
          setPdfProgressDtos(dtos);
          const last = dtos[dtos.length - 1];
          if (last && (last.error || isFinished(last))) {
            stopPdfPolling();
            snapshots.refreshPdfInfos();
          }
        } catch (error) {
          console.error('Error fetching PDF progress:', error);
          stopPdfPolling();
          setPdfProgressError(t('deckInput.pdfError.lostConnection'));
        }
      };
      pdfPollingRef.current = setInterval(poll, 1000);
      poll();
    } catch (error) {
      console.error('Error creating PDF:', error);
      setPdfProgressError(t('deckInput.pdfError.startFailed'));
    }
  };

  const closePdfProgressDialog = useCallback(() => {
    stopPdfPolling();
    setPdfProgressDialogOpen(false);
    setPdfProgressDtos([]);
    setPdfProgressError(null);
  }, [stopPdfPolling]);

  const downloadPDF = useCallback(async (progressId: string) => {
    try {
      const pdfResponse = await fetch(`/api/pdf/${progressId}`);
      if (pdfResponse.status === 200) {
        const blob = await pdfResponse.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${pdfDownloadNameRef.current}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        closePdfProgressDialog();
      } else {
        throw new Error(`Failed to download PDF, status: ${pdfResponse.status}`);
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      setPdfProgressError(t('deckInput.pdfError.downloadFailed'));
    }
  }, [closePdfProgressDialog]);

  const limitConcurrency = (tasks: (() => Promise<void>)[], limit: number): Promise<void> => {
    let running = 0;
    const queue: (() => Promise<void>)[] = [];

    return new Promise((resolve) => {
      function runNext() {
        if (running >= limit || queue.length === 0) return;

        const task = queue.shift()!;
        running++;

        task().then(() => {
          running--;
          runNext();
        });

        runNext();
      }

      tasks.forEach((task) => {
        queue.push(() => new Promise<void>((resolveTask) => {
          task().then((result) => {
            resolveTask(result);
          });
        }));
      });

      runNext();

      const checkComplete = setInterval(() => {
        if (running === 0 && queue.length === 0) {
          clearInterval(checkComplete);
          resolve();
        }
      }, 100);
    });
  };

  const renderCheckbox = (
    id: string,
    label: React.ReactNode,
    checked: boolean,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => void,
    isIndeterminate = false,
    labelClass?: string,
    onLongPress?: () => void,
    trailing?: React.ReactNode,
    badge?: React.ReactNode
  ) => (
    <ChoiceButton
      key={id}
      id={id}
      label={label}
      checked={checked}
      onChange={onChange}
      indeterminate={isIndeterminate}
      className={labelClass}
      onLongPress={onLongPress}
      longPressHint={onlyThisHint()}
      trailing={trailing}
      badge={badge}
    />
  );

  const handleImageLoad = (card: CardResult, imageInfo: ImageInfo) => {
    setCardResults((prevResults) => {
      // Suche nach der Karte in der Struktur und aktualisiere sie
      const updatedResults = { ...prevResults };
      for (const cardData of Object.values(updatedResults)) {
        const targetCard = cardData.results.find((result) => result === card);
        if (targetCard) {
          targetCard.imageInfo = imageInfo; // Füge `imageInfo` hinzu
        }
      }
      return updatedResults; // Aktualisierter Zustand
    });
  };

  const groupResultsByApi = (results: CardResult[]): GroupedResults => {
    return results.reduce((acc: GroupedResults, result) => {
      if (!acc[result.apiName]) {
        acc[result.apiName] = [];
      }
      acc[result.apiName].push(result);
      return acc;
    }, {});
  };

  const getImageLabelCategory = (category: string) => {
    switch (category.toLowerCase()) {
      case 'mtg':
        return <img src='/icons/mtg.png' alt={t('deckInput.categoryIcon.mtg')} className="categoryIcon" />;
      case 'poke':
        return <img src='/icons/poke.png' alt={t('deckInput.categoryIcon.poke')} className="categoryIcon" />;
      case 'yugioh':
        return <div className='categoryIcon'><EyeTriangle /></div>;
      case 'misc':
        return <img src='/icons/misc.webp' alt={t('deckInput.categoryIcon.misc')} className="categoryIcon" />;
      default:
        return null;
    }
  }

  const updateCardCount = (cardName: string, increment: number) => {
    const prevCount = cardResults[cardName]?.count ?? 0;
    const newCount = Math.max(0, prevCount + increment);

    setCardResults(prevResults => ({
      ...prevResults,
      [cardName]: {
        ...prevResults[cardName],
        count: newCount
      }
    }));

    // Inherit selection from first copy when count changes
    if (increment !== 0) {
      setSelectedCards(prevSelected => ({
        ...prevSelected,
        [cardName]: adjustSelectionForCountChange(prevSelected[cardName], prevCount, newCount)
      }));

      setManualPicks(prevPicks => ({
        ...prevPicks,
        [cardName]: adjustSelectionForCountChange(prevPicks[cardName], prevCount, newCount)
      }));
    }
  };

  const getLanguageLabel = (lang: string) => (
    <div className="label-container">
      <span>{lang === NO_LANGUAGE ? t('deckInput.noLanguage') : lang}</span>
      <LanguageFlag language={lang} />
    </div>
  );

  const getApiConfigLabelForCheckbox = (config: Config) => {
    return (
      <div className="label-container">
        <span>{config.name}</span>
        {(config as ApiConfig).languageField || (config as ApiConfig).nestedLanguageLanguageField ? (
          <span>
            <TranslateIcon className="subCategoryIcon" />
          </span>
        ) : null}
        {config.customArts ? (
          <span>
            <PaletteIcon className="subCategoryIcon" />
          </span>
        ) : null}
        {config.officialWebsite && (
          <span className="external-link" onClick={(e) => handleWebsiteClick(config.officialWebsite!, e)}>
            <ExitToAppIcon />
          </span>
        )}
      </div>
    );
  };

  const handleUniquePrintsChanged = (event: React.ChangeEvent<HTMLInputElement>) => {
    setUniquePrints(event.target.checked);
  }

  const handleShowImageSettingsChanged = (event: React.ChangeEvent<HTMLInputElement>) => {
    setShowImageSettings(event.target.checked);
  }

  /** Sucht eine einzelne Karte über alle aktiven APIs, ohne sie schon ins Deck zu legen. */
  const searchSingleCard = async (cardName: string): Promise<CardResultsMap> => {
    setIsLoading(true);
    setProgress(0);

    // Erstelle einen einzelnen Card Entry mit count 1
    const cardEntry: DeckEntry = { count: 1, name: cardName };
    let completedCards = 0;

    const apiResults: Record<string, Record<string, SearchResult[]>> = {};
    const enabledApiKeys = Object.keys(enabledApis).filter(key => enabledApis[key]);
    markConfigsUsed(enabledApiKeys.map(key => apiConfigs[key]));

    // Group APIs
    const proxyGroup = enabledApiKeys.filter(key => apiConfigs[key]?.useBackendProxy);
    const nonProxyApis = enabledApiKeys.filter(key => !apiConfigs[key]?.useBackendProxy);

    const serverHits = await lookupServerCache(enabledApiKeys, [cardEntry.name]);

    // Function to process a single API or proxy group
    const processApiGroup = async (apiKeys: string[]) => {
      const groupResults: Record<string, Record<string, SearchResult[]>> = {};
      for (const apiKey of apiKeys) {
        groupResults[apiKey] = {};
        const api = apiFactory!.createApi(apiKey);

        const startedAt = performance.now();
        let run: NetworkLog | undefined;
        try {
          let result: SearchApiResult | undefined;
          if (await SearchCacheService.hasSearchResult(apiKey, cardEntry.name)) {
            result = await SearchCacheService.getSearchResult(apiKey, cardEntry.name);
            const resultsArr = result?.results || [];
            addToLog({ configName: apiKey, cardName: cardEntry.name, source: 'cache', count: resultsArr.length, durationMs: performance.now() - startedAt, requestCount: 0, rawResponse: result?.rawResponse });
            groupResults[apiKey][cardEntry.name] = resultsArr;
          } else if (serverHits.has(lookupKey(apiKey, cardEntry.name))) {
            result = serverHits.get(lookupKey(apiKey, cardEntry.name))!;
            await SearchCacheService.setSearchResult(apiKey, cardEntry.name, result);
            addToLog({ configName: apiKey, cardName: cardEntry.name, source: 'server', count: result.results.length, durationMs: performance.now() - startedAt, requestCount: 0, rawResponse: result.rawResponse });
            groupResults[apiKey][cardEntry.name] = result.results;
          } else {
            run = startNetworkLog(apiKey, cardEntry.name, startedAt);
            result = await api({ cardname: cardEntry.name }, run.onPage);
            await SearchCacheService.setSearchResult(apiKey, cardEntry.name, result);
            if (serverCacheActive) serverSearchCache.put(apiConfigs[apiKey], cardEntry.name, result);
            const resultsArr = result?.results || [];
            finishLog({ configName: apiKey, cardName: cardEntry.name, source: 'network', count: resultsArr.length, durationMs: performance.now() - startedAt, requestCount: result.requestCount, rawResponse: result.rawResponse }, run);
            groupResults[apiKey][cardEntry.name] = resultsArr;
          }
        } catch (error) {
          finishLog({ configName: apiKey, cardName: cardEntry.name, source: 'error', count: 0, durationMs: performance.now() - startedAt, error: error instanceof Error ? error.message : String(error) }, run);
          groupResults[apiKey][cardEntry.name] = [];
        }

        completedCards++;
        setProgress(Math.round((completedCards / enabledApiKeys.length) * 100));
      }
      return groupResults;
    };

    // Process all API groups concurrently
    const apiGroupPromises = [
      processApiGroup(proxyGroup),
      ...nonProxyApis.map(apiKey => processApiGroup([apiKey]))
    ];

    const apiGroupResults = await Promise.all(apiGroupPromises);

    // Combine results from all groups
    apiGroupResults.forEach(groupResult => {
      Object.assign(apiResults, groupResult);
    });

    // Combine results for the single card and transform into CardEntry objects
    const combinedResults: CardResultsMap = {
      [cardEntry.name]: {
        count: cardEntry.count,
        results: enabledApiKeys.flatMap(apiKey => {
          const apiResultsForCard = apiResults[apiKey][cardEntry.name] || [];
          return apiResultsForCard.map((result): CardResult => ({
            ...result,
            cropSettings: { ...defaultCropSettings }
          }));
        })
      }
    };
    setIsLoading(false);
    // Andere Seiten mehrseitiger Karten werden eigene Einträge, sofern sie nicht schon in der Liste stehen
    return splitCardFaces(combinedResults, Object.keys(cardResults).filter(name => name !== cardEntry.name && name !== replaceTarget));
  };

  /** Bestätigtes Suchergebnis aus Add Single ins Deck legen (oder den Eintrag ohne Fund ersetzen). */
  const addSearchedCard = (results: CardResultsMap) => {
    // Make filter values that this card brings in for the first time visible
    const newOptions = collectFilterOptions(results);
    const addMissing = (prev: Set<string>, values: Set<string>, known: Set<string>) => {
      const added = Array.from(values).filter(value => !known.has(value));
      return added.length > 0 ? new Set([...Array.from(prev), ...added]) : prev;
    };
    setVisibleApis(prev => addMissing(prev, newOptions.apis, availableApis));
    setVisibleLanguages(prev => addMissing(prev, newOptions.languages, availableLanguages));

    insertDeckEntries(results, replaceTarget);
    if (replaceTarget !== null) handleCloseCustomCardDialog();
  };


  const handleImageError = (cardName: string, failedImageUrl: string, apiName: string) => {
    console.log(`Image failed to load: ${failedImageUrl} for card ${cardName} from API ${apiName}`);

    setCardResults(prevResults => {
      const updatedResults = { ...prevResults };
      if (updatedResults[cardName]) {
        // Filter out the failed image from the results
        updatedResults[cardName] = {
          ...updatedResults[cardName],
          results: updatedResults[cardName].results.filter(
            result => result.imageUrl !== failedImageUrl
          )
        };
      }
      return updatedResults;
    });

    // Update selected cards if the failed image was selected
    setSelectedCards(prevSelected => {
      const updatedSelected = { ...prevSelected };
      if (updatedSelected[cardName]) {
        // Replace any instances of the failed image with the next available image
        updatedSelected[cardName] = updatedSelected[cardName].map(selectedCard => {
          if (selectedCard?.imageUrl === failedImageUrl) {
            const availableResults = cardResults[cardName]?.results.filter(
              result => result.imageUrl !== failedImageUrl
            );
            return availableResults?.[0] || null;
          }
          return selectedCard;
        });
      }
      return updatedSelected;
    });
  };

  // Kurzinfos für zugeklappte Abschnitte
  const ratio = (selected: number, total: number, kind: 'active' | 'shown') =>
    (total > 0 ? (kind === 'active' ? t('deckInput.ratio.active', { selected, total }) : t('deckInput.ratio.shown', { selected, total })) : undefined);
  const allApiNames = Object.keys(apiConfigs);
  const apiSelectionSummary = allApiNames.length > 0 ? (
    <span
      title={[...new Set(Object.values(apiConfigs).map(config => config.category))]
        .map(category => {
          const names = Object.values(apiConfigs).filter(config => config.category === category).map(config => config.name);
          return t('deckInput.apiSelection.categoryRatio', { category, selected: names.filter(name => enabledApis[name]).length, total: names.length });
        })
        .join('\n')}
    >
      {ratio(allApiNames.filter(name => enabledApis[name]).length, allApiNames.length, 'active')}
    </span>
  ) : undefined;
  const decklistCardCount = parseDecklist(decklist).reduce((sum, entry) => sum + entry.count, 0);
  const apiFilterItems = apiOrder.filter(name => apiConfigs[name]);

  return (
    <div className="deck-input-and-viewer" style={{ position: 'relative' }}>
      <div className="top-left-bubbles">
        <ThemeChooser />
        <TutorialMenu />
        <LanguageChooser />
      </div>
      <MemoryButtons onResetDeck={resetDeck} resetDisabled={isLoading} />
      <TitleDiv progress={isLoading ? progress : null} />


      <div className="input-controls">
        <CollapsibleSection
          storageKey="snapshots"
          title={t('deckInput.snapshots.title')}
          summary={snapshots.sectionProps.snapshots.length ? t('deckInput.snapshots.saved', { count: snapshots.sectionProps.snapshots.length }) : t('deckInput.snapshots.noneSaved')}
        >
          <SnapshotSection {...snapshots.sectionProps} />
        </CollapsibleSection>
        <div className="api-controls">
          <div className="api-toggles checkbox-group">
            <CollapsibleSection
              storageKey="api-selection"
              title={t('deckInput.apiSelection.title')}
              summary={apiSelectionSummary}
              defaultOpen={false}
              action={{ icon: <SettingsIcon />, title: t('deckInput.apiSelection.manage'), onClick: handleOpenApiConfigDialog }}
            >
              {Object.entries(categoryStates).map(([category]) => (
                <div key={category} className="mb-4">
                  <CategoryToggle
                    icon={getImageLabelCategory(category.toUpperCase())}
                    title={category}
                    checked={getCategoryState(category) === 'checked'}
                    indeterminate={getCategoryState(category) === 'indeterminate'}
                    onClick={() => handleCategoryToggle(category)}
                  />

                  <div className="ml-2">
                    <ul>
                      {Object.values(apiConfigs)
                        .filter(config => config.category === category)
                        .map(config => (
                          <li key={config.name}>
                            <div>
                              {renderCheckbox(
                                config.name,
                                getApiConfigLabelForCheckbox(config),
                                enabledApis[config.name] || false,
                                () => handleApiToggle(config.name),
                                false,
                                'api-config-label'
                              )}
                            </div>
                          </li>
                        ))}
                    </ul>
                  </div>
                </div>
              ))}
            </CollapsibleSection>
          </div>
        </div>

        <div className="decklist-input">
          <CollapsibleSection
            storageKey="decklist"
            title={t('deckInput.decklist.title')}
            summary={decklistCardCount > 0 ? t('deckInput.decklist.cards', { count: decklistCardCount }) : t('deckInput.decklist.empty')}
          >
            <form onSubmit={handleSubmit}>
              <textarea
                value={decklist}
                onChange={(e) => setDecklist(e.target.value)}
                placeholder="1 Forest"
                rows={10}
                cols={50}
              />
              <br />
              {(() => {
                const connectedApis = Object.keys(enabledApis).filter(key => enabledApis[key] && hasConnectedCards(apiConfigs[key]));
                return (
                  <div
                    className="connected-cards-toggle"
                    data-tour="tokens-extras"
                    title={connectedApis.length > 0 ?
                      t('deckInput.tokens.tooltip', { apis: connectedApis.join(', ') }) :
                      t('deckInput.tokens.none')}
                  >
                    {renderCheckbox('searchConnected', t('deckInput.tokens.label'), searchConnected && connectedApis.length > 0, (event) => {
                      if (connectedApis.length === 0) return;
                      setSearchConnected(event.target.checked);
                      try {
                        localStorage.setItem(SEARCH_CONNECTED_KEY, String(event.target.checked));
                      } catch {
                        // Ohne localStorage gilt die Wahl nur bis zum Neuladen
                      }
                    }, false, connectedApis.length === 0 ? 'is-disabled' : undefined)}
                  </div>
                );
              })()}
              <div
                className="connected-cards-toggle"
                data-tour="server-cache"
                title={serverCacheAvailable ?
                  t('deckInput.serverCache.tooltip') :
                  t('deckInput.serverCache.disabled')}
              >
                {renderCheckbox('useServerCache', t('deckInput.serverCache.label'), serverCacheActive, (event) => {
                  if (!serverCacheAvailable) return;
                  setUseServerCache(event.target.checked);
                  try {
                    localStorage.setItem(USE_SERVER_CACHE_KEY, String(event.target.checked));
                  } catch {
                    // Ohne localStorage gilt die Wahl nur bis zum Neuladen
                  }
                }, false, serverCacheAvailable ? undefined : 'is-disabled')}
              </div>
              <div className="decklist-input-buttons">
                <div className="decklist-append-checkbox" title={t('deckInput.append.tooltip')}>
                  {renderCheckbox('appendMode', t('deckInput.append.label'), appendMode, (event) => setAppendMode(event.target.checked))}
                </div>
                <ActionButton type="submit" className="is-primary" icon={<SearchIcon />} disabled={isLoading} data-tour="analyze-deck">{t('deckInput.decklist.analyze')}</ActionButton>
              </div>
            </form>
          </CollapsibleSection>
          <CollapsibleSection
            storageKey="import-deck"
            title={t('deckInput.import.title')}
            action={{ icon: <SettingsIcon />, title: t('deckInput.import.sources'), onClick: () => setDeckImport({ open: true, manage: true }) }}
          >
            <form
              className="import-deck-section"
              onSubmit={(e) => { e.preventDefault(); handleImportDeck(); }}
            >
              <input
                type="text"
                className="import-deck-input"
                value={deckImportInput}
                onChange={(e) => { setDeckImportInput(e.target.value); setDeckLinkStatus({ loading: false }); }}
                placeholder={t('deckInput.import.placeholder')}
                aria-label={t('deckInput.import.placeholder')}
              />
              {(detectedDeckSource || deckLinkStatus.error) && (
                <span className={`import-deck-hint ${deckLinkStatus.error ? 'is-error' : ''}`}>
                  {deckLinkStatus.error || t('deckInput.import.detected', { name: detectedDeckSource!.name })}
                </span>
              )}
              <div className="add-single-buttons">
                <ActionButton type="submit" icon={<DownloadIcon />} disabled={isLoading || deckLinkStatus.loading || !deckImportInput.trim()}>
                  {deckLinkStatus.loading ? t('common.loading') : t('deckInput.import.load')}
                </ActionButton>
                <ActionButton
                  icon={<SearchIcon />}
                  disabled={isLoading || !deckImportInput.trim() || !!detectedDeckSource}
                  onClick={() => setDeckImport({ open: true, input: deckImportInput.trim(), autoRun: 'search' })}
                >
                  {t('deckInput.import.searchByName')}
                </ActionButton>
                <ActionButton
                  icon={<TuneIcon />}
                  disabled={isLoading}
                  onClick={() => setDeckImport({ open: true, input: deckImportInput.trim() || undefined })}
                >
                  {t('deckInput.import.options')}
                </ActionButton>
              </div>
            </form>
          </CollapsibleSection>
          <CollapsibleSection storageKey="add-single" title={t('deckInput.addSingle.title')}>
            <div className="add-single-buttons">
              <ActionButton icon={<AddIcon />} onClick={handleAddCustomCard}>{t('common.add')}</ActionButton>
              <ActionButton icon={<PhotoLibraryIcon />} onClick={handleOpenGalleryDialog} data-tour="gallery-search">{t('deckInput.addSingle.gallery')}</ActionButton>
              <ActionButton icon={<LinkIcon />} onClick={() => setLinkListDialogOpen(true)}>{t('deckInput.addSingle.links')}</ActionButton>
            </div>
          </CollapsibleSection>

        </div>
        <ActionButton
          className={`search-log-toggle ${searchLogOpen ? 'is-active' : ''}`}
          icon={<ReceiptLongIcon />}
          aria-pressed={searchLogOpen}
          onClick={() => setSearchLogOpen(open => !open)}
        >
          {t('deckInput.searchLog.title')}
          <span className="search-log-toggle-count">{t('deckInput.searchLog.entries', { count: log.length })}</span>
        </ActionButton>
      </div>

      <div className="decklist-viewer">
        <SearchLogPanel
          open={searchLogOpen}
          entries={log}
          onShowRaw={setRawDataDialog}
          onClose={() => setSearchLogOpen(false)}
        />

        <div className="deck-viewer">
          <div className="deck-viewer-content">
            <div className="card-grid">
              <div
                className="card-tiles"
                data-tour="card-grid"
                style={{
                  gridTemplateColumns: `repeat(auto-fill, minmax(${gridSize}rem, ${gridSize}rem))`,
                  // Skalierungsfaktor für Text, Abstände und Buttons in den Tiles (10rem = 1)
                  '--tile-scale': gridSize / 10,
                } as React.CSSProperties}
              >
                {Object.entries(cardResults).map(([cardName, cardData]) => {
                  const visibleResults = cardData.results.filter(filterCard);
                  const noMatchingCard = visibleResults.length === 0;

                  const tilesToRender = uniquePrints ? cardData.count : 1;

                  return Array.from({ length: tilesToRender }).map((_, index) => {
                    let selectedCard = selectedCards[cardName]?.[index];
                    if (visibleResults.length > 0 && visibleResults.indexOf(selectedCard as CardResult) === -1) {
                      selectedCard = visibleResults[0];
                    }
                    return (
                      <div
                        key={`${cardName}-${index}`}
                        className={`card-tile ${noMatchingCard ? 'no-matching-card' : ''} ${selectedCard?.apiName === 'custom' ? 'custom-card' : ''}`}
                      >
                        <div
                          className="card-image-container"
                          title={selectedCard?.apiName === 'custom' ? t('deckInput.card.cropImage') :
                            cardData.connectedFrom?.length ? t('deckInput.card.neededBy', { names: cardData.connectedFrom.join(', ') }) : undefined}
                          onClick={() => {
                            if (selectedCard?.apiName === 'custom') setRecropTarget({ cardKey: cardName, card: selectedCard });
                            else handleCardClick(cardName, index);
                          }}
                        >
                          {selectedCard ? (
                            <CardImage
                              cardInput={selectedCard}
                              isPermanent={true}
                              showImageSettings={showImageSettings}
                              onLoad={(imageInfo) => handleImageLoad(selectedCard as CardResult, imageInfo)}
                              onError={() => handleImageError(cardName, (selectedCard as CardResult).imageUrl, (selectedCard as CardResult).apiName)}
                            />
                          ) : cardData.results.length === 0 ? (
                            // Keine API hat etwas gefunden: Eintrag über Add Single austauschen
                            <div className="no-image no-results">
                              <span>{t('deckInput.card.noArt')}</span>
                              <ActionButton
                                icon={<FindReplaceIcon />}
                                title={t('deckInput.card.replaceTooltip')}
                                onClick={(e) => { e.stopPropagation(); handleReplaceCard(cardName); }}
                              >
                                {t('common.replace')}
                              </ActionButton>
                              <ActionButton
                                icon={<DeleteOutlineIcon />}
                                title={t('deckInput.card.discardTooltip')}
                                onClick={(e) => { e.stopPropagation(); handleDiscardEntry(cardName); }}
                              >
                                {t('deckInput.card.discard')}
                              </ActionButton>
                            </div>
                          ) : (
                            <div className="no-image">{t('deckInput.card.noImage')}</div>
                          )}
                          <CardTitle name={cardName} />
                          {/* Anzahl im gleichen dunklen Verlauf wie der Titel, Klicks öffnen nicht die Bildauswahl.
                              Ohne einen einzigen Fund gibt es stattdessen Replace und Discard. */}
                          {cardData.results.length > 0 && <div className="card-count" onClick={(e) => e.stopPropagation()}>
                            {!uniquePrints ? (
                              <button
                                className="count-button remove-card"
                                title={t('deckInput.card.removeCard')}
                                onClick={() => handleRemoveCard(cardName, index)}
                              >
                                ✕
                              </button>
                            ) : null}
                            <button
                              onClick={() => updateCardCount(cardName, -1)}
                              className="count-button"
                              title={t('deckInput.card.oneLess')}
                            >
                              <Minus />
                            </button>
                            <span className="count-value">{cardData.count}</span>
                            <button
                              onClick={() => updateCardCount(cardName, 1)}
                              className="count-button"
                              title={t('deckInput.card.oneMore')}
                            >
                              <Plus />
                            </button>
                            {selectedCard?.apiName === 'custom' && (
                              <button
                                className="count-button recrop-card"
                                title={t('deckInput.card.cropImage')}
                                onClick={() => setRecropTarget({ cardKey: cardName, card: selectedCard as CardResult })}
                              >
                                <CropIcon fontSize="inherit" />
                              </button>
                            )}
                          </div>}
                        </div>
                      </div>
                    );
                  });
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="right-toolbar">
      <div className="view-selection">
        <div className="filter-controls">
          <CollapsibleSection storageKey="view-selection" title={t('deckInput.view.title')}>
          <div className="checkbox-group">
            {renderCheckbox('uniquePrints', t('deckInput.view.uniquePrints'), uniquePrints, (event) => handleUniquePrintsChanged(event))}
            {renderCheckbox('showImageSettings', t('deckInput.view.showImageInfo'), showImageSettings, (event) => handleShowImageSettingsChanged(event))}
            <div className="grid-size-control" data-tour="grid-size">
              <label htmlFor="gridSize" className="block text-sm font-medium text-gray-700">
                {t('deckInput.view.gridSize', { size: gridSize })}
              </label>
            </div>
            <div>
              <input
                id="gridSize"
                type="range"
                min="4"
                max="20"
                step="1"
                value={gridSize}
                onChange={handleGridSizeChange}
                className="w-full"
              />
            </div>
          </div>
          </CollapsibleSection>
          <CollapsibleSection
            storageKey="language-filter"
            title={t('deckInput.view.languageFilter')}
            summary={ratio(languageOrder.filter(lang => visibleLanguages.has(lang)).length, languageOrder.length, 'shown')}
            defaultOpen={false}
          >
          <SortableList
            className="language-filter checkbox-group"
            items={languageOrder}
            onReorder={reorderLanguages}
            renderItem={(lang, handle) =>
              renderCheckbox(lang, getLanguageLabel(lang), visibleLanguages.has(lang), () => toggleLanguage(lang), false, undefined, () => setVisibleLanguages(new Set([lang])), handle,
                <PriorityRank rank={priorityRank(languageOrder, visibleLanguages, lang)} />)
            }
          />
          </CollapsibleSection>
          <CollapsibleSection
            storageKey="api-filter"
            title={t('deckInput.view.apiFilter')}
            summary={ratio(apiFilterItems.filter(name => visibleApis.has(name)).length, apiFilterItems.length, 'shown')}
            defaultOpen={false}
          >
          <SortableList
            className="api-filter checkbox-group"
            items={apiFilterItems}
            onReorder={reorderApis}
            renderItem={(name, handle) =>
              renderCheckbox(
                name,
                getApiConfigLabelForCheckbox(apiConfigs[name]),
                visibleApis.has(name),
                () => toggleApi(name),
                false,
                'api-config-label',
                () => setVisibleApis(new Set([name])),
                handle,
                <PriorityRank rank={priorityRank(apiOrder, visibleApis, name)} />
              )
            }
          />
          </CollapsibleSection>
        </div>
      </div>

      <div className="pdf-controls">
        <CollapsibleSection storageKey="pdf-generation" title={t('deckInput.pdf.title')}>

        <ActionButton icon={<PictureAsPdfOutlinedIcon />} onClick={handleOpenSettingsDialog} data-tour="pdf-settings">{t('common.settings')}</ActionButton>
        <ActionButton className="is-primary" data-tour="create-pdf" icon={<LocalPrintshopOutlinedIcon />} disabled={Object.keys(cardResults).length === 0 || pdfTooLarge} onClick={() => createPDF().catch(console.error)}>{t('deckInput.pdf.create')}</ActionButton>
        {pdfImageEntries.length > 0 && (
          <p className={`pdf-size-estimate${pdfTooLarge ? ' is-error' : ''}`}>
            {pdfTooLarge
              ? t('deckInput.pdf.tooLarge', { size: formatMb(estimatedPdfBytes), limit: pdfSizeLimitMb })
              : (Number.isFinite(pdfSizeLimitMb)
                ? t('deckInput.pdf.estimateWithLimit', { size: formatMb(estimatedPdfBytes), limit: pdfSizeLimitMb })
                : t('deckInput.pdf.estimate', { size: formatMb(estimatedPdfBytes) }))}
          </p>
        )}
        </CollapsibleSection>
      </div>

      <div className="bottom">
        <div><PayPalDonateButton /></div>
        <div><GitHubButton /></div>
        <div><VersionInfo /></div>
      </div>
      </div>

      <DisclaimerDialog open={disclaimerOpen} onClose={() => setDisclaimerOpen(false)} />


      <ClosableDialog
        open={settingsDialogOpen}
        onClose={handleCloseSettingsDialog}
        maxWidth='lg'
        children={
          <SettingsDialog
            open={settingsDialogOpen}
            onClose={handleCloseSettingsDialog}
            settings={settings}
            onSettingsChange={handleSettingsChange}
            mailEnabled={pdfMailEnabled}
            previewCards={settingsPreviewCards}
          />
        }
      />

      <ImageSelectDialog
        open={imageSelectDialogOpen}
        onClose={handleCloseImageSelectDialog}
        initialSelectedImage={
          currentCardName !== null && currentCardIndex !== null
            ? selectedCards[currentCardName]?.[currentCardIndex] || cardResults[currentCardName]?.results[0]
            : null
        }
        initialVisibleApis={visibleApis}
        initialVisibleLanguages={visibleLanguages}
        languageOrder={languageOrder}
        apiOrder={apiOrder}
        onReorderLanguages={reorderLanguages}
        onReorderApis={reorderApis}
        cardAspect={settings.width / settings.height}
        groupedResults={
          currentCardName && cardResults[currentCardName]
            ? groupResultsByApi(cardResults[currentCardName].results || [])
            : {}
        }
        onImageLoadError={(card: CardImageError) => handleImageError(card.name, card.imageUrl, card.apiName)}
        deckNav={
          currentCardName !== null && currentTilePosition !== -1
            ? {
              key: `${currentCardName}#${currentCardIndex}`,
              cardName: currentCardName,
              position: currentTilePosition + 1,
              total: deckTiles.length,
              onStep: handleStepImageSelect,
            }
            : undefined
        }
      />

      <RecropDialog
        imageUrl={recropTarget?.card.imageUrl ?? null}
        cropSettings={recropTarget?.card.cropSettings}
        cardAspect={settings.width / settings.height}
        onClose={() => setRecropTarget(null)}
        onApply={(crops) => recropTarget && handleApplyRecrop(recropTarget.cardKey, recropTarget.card, crops)}
      />
      <RawDataDialog rawData={rawDataDialog} onClose={handleCloseRawDataDialog} />

      <ClosableDialog
        open={customCardDialogOpen}
        onClose={handleCloseCustomCardDialog}
        maxWidth={customCardMaskOpen ? 'lg' : 'sm'}
        children={<AddCardDialog
          open={customCardDialogOpen}
          onClose={handleCloseCustomCardDialog}
          onSave={handleSaveCustomCard}
          searchCard={searchSingleCard}
          onAddSearched={addSearchedCard}
          replaceName={replaceTarget ?? undefined}
          cardAspect={settings.width / settings.height}
          onMaskOpenChange={setCustomCardMaskOpen}
        />}
      />
      <ClosableDialog
        open={linkListDialogOpen}
        onClose={() => setLinkListDialogOpen(false)}
        maxWidth='sm'
        children={<LinkListDialog onSubmit={handleLinkList} />}
      />
      <ClosableDialog
        open={deckImport.open}
        onClose={() => setDeckImport({ open: false })}
        maxWidth='md'
        children={<DeckImportDialog
          key={`${deckImport.input || ''}|${deckImport.autoRun || ''}|${deckImport.manage ? 'm' : ''}`}
          configs={deckFinderConfigs}
          initialInput={deckImport.input}
          autoRun={deckImport.autoRun}
          startInManage={deckImport.manage}
          onReloadConfigs={reloadDeckFinderConfigs}
          onLoaded={(deck) => applyLoadedDeck(deck)}
        />}
      />
      <ClosableDialog open={pendingDeck !== null} onClose={() => setPendingDeck(null)} maxWidth="xs">
        <div className="replace-deck-dialog">
          <h2>{t('deckInput.replaceDeck.title')}</h2>
          <p>
            {pendingDeck?.deckName
              ? t('deckInput.replaceDeck.messageNamed', { name: pendingDeck.deckName, count: pendingDeck.entries.reduce((sum, e) => sum + e.count, 0) })
              : t('deckInput.replaceDeck.messageUnnamed', { count: pendingDeck?.entries.reduce((sum, e) => sum + e.count, 0) ?? 0 })}
          </p>
          <div className="replace-deck-actions">
            <ActionButton icon={<CloseIcon />} onClick={() => setPendingDeck(null)}>{t('common.cancel')}</ActionButton>
            <ActionButton icon={<DownloadIcon />} className="is-primary" onClick={() => pendingDeck && applyLoadedDeck(pendingDeck, true)}>{t('common.replace')}</ActionButton>
          </div>
        </div>
      </ClosableDialog>
      <ClosableDialog
        open={galleryDialogOpen}
        onClose={handleCloseGalleryDialog}
        maxWidth='md'
        children={<GalleryConfigDialog
          open={galleryDialogOpen}
          onClose={handleCloseGalleryDialog}
          handleGalleryResults={handleGalleryResults}
        />}
      />
      <Dialog
        maxWidth='sm'
        fullWidth
        open={pdfProgressDialogOpen}>
        <PdfProgressDialog
          open={pdfProgressDialogOpen}
          progressDtos={pdfProgressDtos}
          errorMessage={pdfProgressError}
          onFinish={downloadPDF}
          onClose={closePdfProgressDialog}
          email={pdfSendMail ? auth.email ?? '' : ''}
        />
      </Dialog>

      <ClosableDialog
        open={apiConfigDialogOpen}
        onClose={handleCloseApiConfigDialog}
        children={
          <ApiConfigDialog
            open={apiConfigDialogOpen}
            onClose={handleCloseApiConfigDialog}
            onSave={handleSaveApiConfigs}
          />
        }
      ></ClosableDialog>
    </div>
  );
};

export default DeckInputAndViewer;
