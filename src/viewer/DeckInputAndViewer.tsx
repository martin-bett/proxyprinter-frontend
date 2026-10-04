import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { imageLoaderService } from '../service/cache/ImageLoaderService';
import SearchCacheService, { SearchApiResult } from '../service/cache/SearchCacheService';
import ImageSelectDialog from './grid/ImageSelectDialog';
import ProgressBar from '../components/progress/ProgressBar';
import PdfProgressDialog, { ProgressDto, isFinished } from './pdf/PdfProgressDialog';
import '../viewer/CardGrid.css';
import { SettingsDialog, defaultSettings, PdfSettings } from './pdf/SettingsDialog';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import LocalPrintshopOutlinedIcon from '@mui/icons-material/LocalPrintshopOutlined';
import SearchIcon from '@mui/icons-material/Search';
import SettingsIcon from '@mui/icons-material/Settings';
import CardImage, { CardImageError } from './grid/CardImage';
import CardTitle from './grid/CardTitle';
import AddCardDialog, { SaveCustomCardFn } from './grid/AddCardDialog';
import GalleryConfigDialog from '../api/view/gallery/GalleryConfigDialog';
import ApiConfigDialog from '../api/view/api/ApiConfigDialog';
import TranslateIcon from '@mui/icons-material/Translate';
import AddIcon from '@mui/icons-material/Add';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import PaletteIcon from '@mui/icons-material/Palette';
import PayPalDonateButton from './info/PayPalDonateButton';
import GitHubButton from './info/GitHubButton';
import TitleDiv from '../svg/TitleDiv';
import VersionInfo from './info/VersionInfo';
import ThemeChooser from '../theme/ThemeChooser';
import { Minus, Plus } from 'lucide-react';
import EyeTriangle from '../svg/EyeTriangle';
import { Dialog } from '@mui/material';
import ClosableDialog from '../container/ClosableDialog';
import ChoiceButton from '../container/inputs/ChoiceButton';
import CollapsibleSection from '../container/inputs/CollapsibleSection';
import LanguageFlag from '../container/LanguageFlag';
import ActionButton from '../container/inputs/ActionButton';
import CategoryToggle from '../container/inputs/CategoryToggle';
import MemoryButtons from './cache/MemoryButtons';
import ApiFactory, { ApiConfig, Config, CropSettings, ImageInfo, SearchResult } from '../service/ApiFactory';
import DisclaimerDialog from './info/DisclaimerDialog';
import RawDataDialog from './log/RawDataDialog';
import SearchLog from './log/SearchLog';
import { CardGroup, CardResult, CardResultsMap, DeckEntry, GroupedResults, LogEntry, SelectedCardsMap } from '../api/types/types';

const NO_LANGUAGE = 'No Language';

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

const DeckInputAndViewer: React.FC = () => {
  const [decklist, setDecklist] = useState('');
  const [cardResults, setCardResults] = useState<CardResultsMap>({});
  const [settings, setSettings] = useState<PdfSettings>(defaultSettings);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [rawDataDialog, setRawDataDialog] = useState<string | null>(null);
  const [categoryStates, setCategoryStates] = useState<Record<string, boolean>>({});
  const [apiConfigs, setApiConfigs] = useState<Record<string, Config>>({}); // New state for API configs
  const [apiFactory, setApiFactory] = useState<ApiFactory | null>(null); // State for API factory
  const [enabledApis, setEnabledApis] = useState<Record<string, boolean>>(() =>
    Object.keys(apiConfigs).reduce((acc, key) => ({ ...acc, [apiConfigs[key].name]: true }), {})
  );
  const [selectedCards, setSelectedCards] = useState<SelectedCardsMap>({});
  const [currentCardName, setCurrentCardName] = useState<string | null>(null);
  const [currentCardIndex, setCurrentCardIndex] = useState<number | null>(null);
  const [visibleLanguages, setVisibleLanguages] = useState<Set<string>>(new Set([NO_LANGUAGE]));
  const [visibleApis, setVisibleApis] = useState<Set<string>>(new Set());
  const [pdfProgressDtos, setPdfProgressDtos] = useState<ProgressDto[]>([]);
  const [pdfProgressError, setPdfProgressError] = useState<string | null>(null);
  const pdfPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [uniquePrints, setUniquePrints] = useState(true);
  const [showImageSettings, setShowImageSettings] = useState(false);

  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [imageSelectDialogOpen, setImageSelectDialogOpen] = useState(false);
  const [pdfProgressDialogOpen, setPdfProgressDialogOpen] = useState(false);
  const [customCardDialogOpen, setCustomCardDialogOpen] = useState(false);
  const [galleryDialogOpen, setGalleryDialogOpen] = useState(false);
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
    const saved = localStorage.getItem('setConfigs');
    console.log('storage content', saved);
    if (saved) {
      handleSaveApiConfigs(JSON.parse(saved));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter options always reflect the current search results only
  const { languages: availableLanguages, apis: availableApis } = useMemo(
    () => collectFilterOptions(cardResults),
    [cardResults]
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

  const handleSettingsChange = (newSettings: PdfSettings) => {
    setSettings(newSettings);
  };

  const handleAddCustomCard = () => {
    setCustomCardDialogOpen(true);
  };

  const handleCloseCustomCardDialog = () => {
    setCustomCardDialogOpen(false);
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

  const handleSaveCustomCard: SaveCustomCardFn = async (cardName, imageUrl, file, gridSettings) => {
    console.log(cardName, imageUrl, file, gridSettings);

    let finalImageUrl: string | undefined;
    if (imageUrl) {
      finalImageUrl = imageUrl;
    }
    if (file) {
      finalImageUrl = '/api/files/download/' + file;
    }
    if (!finalImageUrl) return;

    const rows = gridSettings?.rows || 1;
    const cols = gridSettings?.cols || 1;

    // Bild laden, um die Dimensionen zu ermitteln
    const img = new Image();
    img.src = finalImageUrl;

    img.onload = () => {
      const { width, height } = img;

      const cellWidth = Math.floor(width / cols);
      const cellHeight = Math.floor(height / rows);

      let cropIndex = 0; // Initialisieren des Indexes

      // Berechnung der Crops
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const crop: CropSettings = {
            offSetX: col * cellWidth,
            offSetY: row * cellHeight,
            width: cellWidth,
            height: cellHeight,
            isStretch: true
          };

          // Eintrag in cardResults für jedes Crop
          const cropKey = `${cardName}_crop${cropIndex}`;
          const cropCard: CardResult = {
            name: cardName,
            imageUrl: finalImageUrl!,
            apiName: 'custom',
            languageCode: NO_LANGUAGE,
            cropSettings: crop,
          };

          // cardResults aktualisieren
          setCardResults((prev) => ({
            ...prev,
            [cropKey]: {
              count: 1,
              results: [cropCard],
            },
          }));

          // selectedCards aktualisieren
          setSelectedCards((prev) => ({
            ...prev,
            [cropKey]: [cropCard],
          }));

          cropIndex++; // Index erhöhen für das nächste Crop
        }
      }

    };

    img.onerror = () => {
      console.log('Fehler beim Laden des Bildes. Überprüfen Sie die URL.');
    };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setCardResults({});
    setLog([]);
    setProgress(0);

    const cardEntries: DeckEntry[] = decklist.split('\n')
      .map(line => line.trim())
      .filter(line => line)
      .map((line): DeckEntry | null => {
        const match = line.match(/^(\d+)\s+(.+?)(?:\s+\(([^)]+)\))?\s*$/);
        if (match) {
          return {
            count: parseInt(match[1], 10),
            name: match[2].trim(),
            set: match[3]?.trim() || undefined
          };
        }
        return null;
      })
      .filter((entry): entry is DeckEntry => entry !== null);

    const totalCards = cardEntries.reduce((sum, entry) => sum + entry.count, 0);
    let completedCards = 0;

    const apiResults: Record<string, Record<string, SearchResult[]>> = {};
    const enabledApiKeys = Object.keys(enabledApis).filter(key => enabledApis[key]);

    // Group APIs
    const proxyGroup = enabledApiKeys.filter(key => apiConfigs[key]?.useBackendProxy);
    const nonProxyApis = enabledApiKeys.filter(key => !apiConfigs[key]?.useBackendProxy);

    // Function to process a single API or proxy group
    const processApiGroup = async (apiKeys: string[]) => {
      const groupResults: Record<string, Record<string, SearchResult[]>> = {};
      for (const apiKey of apiKeys) {
        groupResults[apiKey] = {};
        const limit = (apiConfigs[apiKey] as ApiConfig)?.concurrentLimit || Infinity;
        const api = apiFactory!.createApi(apiKey);

        const tasks = cardEntries.map(entry => async () => {
          if (!groupResults[apiKey][entry.name]) {
            const startedAt = performance.now();
            try {
              let result: SearchApiResult | undefined;
              if (await SearchCacheService.hasSearchResult(apiKey, entry.name)) {
                result = await SearchCacheService.getSearchResult(apiKey, entry.name);
                const resultsArr = result?.results || [];
                addToLog({ configName: apiKey, cardName: entry.name, source: 'cache', count: resultsArr.length, durationMs: performance.now() - startedAt, requestCount: 0, rawResponse: result?.rawResponse });
                groupResults[apiKey][entry.name] = resultsArr;
              } else {
                result = await api({ cardname: entry.name, set: entry.set });
                await SearchCacheService.setSearchResult(apiKey, entry.name, result);
                const resultsArr = result?.results || [];
                addToLog({ configName: apiKey, cardName: entry.name, source: 'network', count: resultsArr.length, durationMs: performance.now() - startedAt, requestCount: result.requestCount, rawResponse: result.rawResponse });
                groupResults[apiKey][entry.name] = resultsArr;
              }
            } catch (error) {
              addToLog({ configName: apiKey, cardName: entry.name, source: 'error', count: 0, durationMs: performance.now() - startedAt, error: error instanceof Error ? error.message : String(error) });
              groupResults[apiKey][entry.name] = [];
            }
          }
          completedCards += entry.count;
          setProgress(Math.round((completedCards / (totalCards * enabledApiKeys.length)) * 100));
        });
        await limitConcurrency(tasks, limit);
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

    // Combine results
    const results: CardResultsMap = {};
    cardEntries.forEach(entry => {
      results[entry.name] = {
        count: entry.count,
        results: enabledApiKeys.flatMap(apiKey => {
          const apiResultsForCard = apiResults[apiKey][entry.name] || [];
          return apiResultsForCard.map((result): CardResult => ({
            ...result,
            cropSettings: { ...defaultCropSettings }
          }));
        })
      };
    });

    const options = collectFilterOptions(results);
    setVisibleApis(options.apis);
    setVisibleLanguages(prev => {
      const kept = new Set(Array.from(prev).filter(lang => options.languages.has(lang)));
      return kept.size > 0 ? kept : options.languages;
    });
    setCardResults(results);
    setIsLoading(false);

    // Set initial selected cards based on cache or select first image
    const initialSelectedCards: SelectedCardsMap = {};
    Object.entries(results).forEach(([cardName, cardData]) => {
      initialSelectedCards[cardName] = Array.from({ length: cardData.count }).map((_, index) => {
        if (SearchCacheService.hasSelectedImage(cardName, index + 1)) {
          const cachedImageUrl = SearchCacheService.getSelectedImage(cardName, index + 1);
          return cardData.results.find(card => card.imageUrl === cachedImageUrl) || cardData.results[0] || null;
        }
        return cardData.results[0] || null;
      });
    });
    setSelectedCards(initialSelectedCards);
  };

  const handleCloseImageSelectDialog = (selectedImage: CardResult | null) => {
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
    }
    setImageSelectDialogOpen(false);
    setCurrentCardName(null);
    setCurrentCardIndex(null);
  };

  const handleRemoveCard = (cardName: string, index: number) => {
    setCardResults(prevResults => {
      const newResults = { ...prevResults };
      if (uniquePrints && newResults[cardName].count > 1) {
        newResults[cardName] = {
          ...newResults[cardName],
          count: newResults[cardName].count - 1
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

  useEffect(() => {
    setSelectedCards(prev => {
      const newSelectedCards = { ...prev };
      let hasChanges = false;

      Object.entries(cardResults).forEach(([cardName, cardData]) => {
        const visibleResults = cardData.results.filter(filterCard);

        newSelectedCards[cardName] = Array.from({ length: cardData.count }).map((_, index) => {
          const currentSelection = prev[cardName]?.[index];
          if (visibleResults.length > 0) {
            if (currentSelection && visibleResults.some(card => card.imageUrl === currentSelection.imageUrl)) {
              return currentSelection;
            } else {
              hasChanges = true;
              return visibleResults[0];
            }
          } else {
            return null; // If no visible results, set to null instead of keeping old selection
          }
        });

        if (newSelectedCards[cardName].every(card => card === null)) {
          delete newSelectedCards[cardName]; // Remove the card if all selections are null
          hasChanges = true;
        }
      });
      return hasChanges ? newSelectedCards : prev;
    });
  }, [visibleLanguages, visibleApis, cardResults, filterCard]);

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

  const createPDF = async () => {
    stopPdfPolling();
    setPdfProgressDtos([]);
    setPdfProgressError(null);
    setPdfProgressDialogOpen(true);

    const createPdfDto = {
      images: Object.entries(selectedCards).flatMap(([cardName, cardSelections]) => {
        if (uniquePrints) {
          // Wenn uniquePrints true ist, nehmen wir alle URLs mit cropSettings wie sie sind
          return cardSelections
            .map(selectedCard =>
              selectedCard?.imageUrl
                ? { imageUrl: selectedCard.imageUrl, cropSettings: selectedCard.cropSettings }
                : null
            )
            .filter((item): item is { imageUrl: string; cropSettings: CropSettings } => item !== null); // Entferne ungültige Einträge
        } else {
          // Wenn uniquePrints false ist, nehmen wir die erste gültige URL und duplizieren sie mit cropSettings entsprechend dem count
          const firstValidCard = cardSelections.find(selectedCard => selectedCard?.imageUrl);
          if (!firstValidCard) return [];
          const count = cardResults[cardName]?.count || 1;
          return Array(count).fill({
            imageUrl: firstValidCard.imageUrl,
            cropSettings: firstValidCard.cropSettings
          });
        }
      }),
      settings: settings
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
          }
        } catch (error) {
          console.error('Error fetching PDF progress:', error);
          stopPdfPolling();
          setPdfProgressError('Lost connection to the PDF generation. Please try again.');
        }
      };
      pdfPollingRef.current = setInterval(poll, 1000);
      poll();
    } catch (error) {
      console.error('Error creating PDF:', error);
      setPdfProgressError('Failed to start PDF generation. Please try again.');
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
        link.setAttribute('download', 'deck.pdf');
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
      setPdfProgressError('Failed to download PDF. Please try again.');
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
    labelClass?: string
  ) => (
    <ChoiceButton
      key={id}
      id={id}
      label={label}
      checked={checked}
      onChange={onChange}
      indeterminate={isIndeterminate}
      className={labelClass}
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
        return <img src='/icons/mtg.png' alt="MTG Icon" className="categoryIcon" />;
      case 'poke':
        return <img src='/icons/poke.png' alt="Pokemon Icon" className="categoryIcon" />;
      case 'yugioh':
        return <div className='categoryIcon'><EyeTriangle /></div>;
      case 'misc':
        return <img src='/icons/misc.webp' alt="Misc Icon" className="categoryIcon" />;
      default:
        return null;
    }
  }

  const updateCardCount = (cardName: string, increment: number) => {
    setCardResults(prevResults => ({
      ...prevResults,
      [cardName]: {
        ...prevResults[cardName],
        count: Math.max(0, prevResults[cardName].count + increment)
      }
    }));
  };

  const getLanguageLabel = (lang: string) => (
    <div className="label-container">
      <span>{lang === NO_LANGUAGE ? 'No Language' : lang}</span>
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

  const searchForApis = async (cardName: string) => {
    setIsLoading(true);
    setProgress(0);

    // Erstelle einen einzelnen Card Entry mit count 1
    const cardEntry: DeckEntry = { count: 1, name: cardName };
    let completedCards = 0;

    const apiResults: Record<string, Record<string, SearchResult[]>> = {};
    const enabledApiKeys = Object.keys(enabledApis).filter(key => enabledApis[key]);

    // Group APIs
    const proxyGroup = enabledApiKeys.filter(key => apiConfigs[key]?.useBackendProxy);
    const nonProxyApis = enabledApiKeys.filter(key => !apiConfigs[key]?.useBackendProxy);

    // Function to process a single API or proxy group
    const processApiGroup = async (apiKeys: string[]) => {
      const groupResults: Record<string, Record<string, SearchResult[]>> = {};
      for (const apiKey of apiKeys) {
        groupResults[apiKey] = {};
        const api = apiFactory!.createApi(apiKey);

        const startedAt = performance.now();
        try {
          let result: SearchApiResult | undefined;
          if (await SearchCacheService.hasSearchResult(apiKey, cardEntry.name)) {
            result = await SearchCacheService.getSearchResult(apiKey, cardEntry.name);
            const resultsArr = result?.results || [];
            addToLog({ configName: apiKey, cardName: cardEntry.name, source: 'cache', count: resultsArr.length, durationMs: performance.now() - startedAt, requestCount: 0, rawResponse: result?.rawResponse });
            groupResults[apiKey][cardEntry.name] = resultsArr;
          } else {
            result = await api({ cardname: cardEntry.name });
            await SearchCacheService.setSearchResult(apiKey, cardEntry.name, result);
            const resultsArr = result?.results || [];
            addToLog({ configName: apiKey, cardName: cardEntry.name, source: 'network', count: resultsArr.length, durationMs: performance.now() - startedAt, requestCount: result.requestCount, rawResponse: result.rawResponse });
            groupResults[apiKey][cardEntry.name] = resultsArr;
          }
        } catch (error) {
          addToLog({ configName: apiKey, cardName: cardEntry.name, source: 'error', count: 0, durationMs: performance.now() - startedAt, error: error instanceof Error ? error.message : String(error) });
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
    const results: CardResultsMap = {
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

    // Make filter values that this card brings in for the first time visible
    const newOptions = collectFilterOptions(results);
    const addMissing = (prev: Set<string>, values: Set<string>, known: Set<string>) => {
      const added = Array.from(values).filter(value => !known.has(value));
      return added.length > 0 ? new Set([...Array.from(prev), ...added]) : prev;
    };
    setVisibleApis(prev => addMissing(prev, newOptions.apis, availableApis));
    setVisibleLanguages(prev => addMissing(prev, newOptions.languages, availableLanguages));

    // Set CardResults with transformed CardEntry objects
    setCardResults(prevResults => ({
      ...prevResults,
      ...results
    }));

    setIsLoading(false);
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

  return (
    <div className="deck-input-and-viewer" style={{ position: 'relative' }}>
      <ThemeChooser />
      <MemoryButtons />
      <TitleDiv />


      <div className="input-controls">
        <div className="api-controls">
          <div className="api-toggles checkbox-group">
            <CollapsibleSection
              storageKey="api-selection"
              title="API Selection"
              action={{ icon: <SettingsIcon />, title: 'Manage APIs', onClick: handleOpenApiConfigDialog }}
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
          <CollapsibleSection storageKey="decklist" title="Enter Decklist">
            <form onSubmit={handleSubmit}>
              <textarea
                value={decklist}
                onChange={(e) => setDecklist(e.target.value)}
                placeholder="1 Forest"
                rows={10}
                cols={50}
              />
              <br />
              <ActionButton type="submit" className="is-primary" icon={<SearchIcon />} disabled={isLoading}>Analyze Deck</ActionButton>
            </form>
          </CollapsibleSection>
          <CollapsibleSection storageKey="add-single" title="Add Single">
            <div className="add-single-buttons">
              <ActionButton icon={<AddIcon />} onClick={handleAddCustomCard}>Add</ActionButton>
              <ActionButton icon={<PhotoLibraryIcon />} onClick={handleOpenGalleryDialog}>Gallery Search</ActionButton>
            </div>
          </CollapsibleSection>

        </div>
        {isLoading && (
          <ProgressBar className="search-progress" value={progress / 100} height={20} label={`${progress}%`} />
        )}
        <CollapsibleSection storageKey="search-log" title="Search Log" defaultOpen={false}>
          <SearchLog entries={log} onShowRaw={setRawDataDialog} />
        </CollapsibleSection>
      </div>

      <div className="decklist-viewer">

        <div className="deck-viewer">
          <div className="deck-viewer-content">
            <div className="card-grid">
              <div
                className="card-tiles"
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
                        <div className="card-image-container" onClick={() => selectedCard?.apiName !== 'custom' && handleCardClick(cardName, index)}>
                          {selectedCard ? (
                            <CardImage
                              cardInput={selectedCard}
                              isPermanent={true}
                              showImageSettings={showImageSettings}
                              onLoad={(imageInfo) => handleImageLoad(selectedCard as CardResult, imageInfo)}
                              onError={() => handleImageError(cardName, (selectedCard as CardResult).imageUrl, (selectedCard as CardResult).apiName)}
                            />
                          ) : (
                            <div className="no-image">No image available</div>
                          )}
                          <CardTitle name={cardName} />
                        </div>
                        <div className="card-name card-count">
                          <p>
                            {!uniquePrints ? <span
                              className="remove-card"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveCard(cardName, index);
                              }}
                            >
                              ✕
                            </span> : null}
                            <button
                              onClick={() => updateCardCount(cardName, -1)}
                              className="count-button"
                            >
                              <Minus />
                            </button>
                            {cardData.count}
                            <button
                              onClick={() => updateCardCount(cardName, 1)}
                              className="count-button"
                            >
                              <Plus />
                            </button>
                          </p>
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
          <h2 className='title is-5'>View Selection</h2>
          <div className="language-filter checkbox-group">
            {renderCheckbox('uniquePrints', 'Unique Prints', uniquePrints, (event) => handleUniquePrintsChanged(event))}
            {renderCheckbox('showImageSettings', 'Show Image Info', showImageSettings, (event) => handleShowImageSettingsChanged(event))}
            <div className="grid-size-control">
              <label htmlFor="gridSize" className="block text-sm font-medium text-gray-700">
                Grid Size {gridSize}
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
          <div className="language-filter checkbox-group">
            <h3 className='title is-5'>Language Filter</h3>
            {Array.from(availableLanguages).map(lang => (
              renderCheckbox(lang, getLanguageLabel(lang), visibleLanguages.has(lang), () => toggleLanguage(lang))
            ))}
          </div>
          <div className="api-filter checkbox-group">
            <h3 className='title is-5'>API Filter</h3>
            {Object.values(apiConfigs)
              .filter((c) => availableApis.has(c.name))
              .map((config) =>
                renderCheckbox(
                  config.name,
                  getApiConfigLabelForCheckbox(config),
                  visibleApis.has(config.name),
                  () => toggleApi(config.name),
                  false,
                  'api-config-label'
                )
              )}
          </div>
        </div>
      </div>

      <div className="pdf-controls">
        <h3 className='title is-5'>PDF Generation</h3>

        <ActionButton icon={<PictureAsPdfOutlinedIcon />} onClick={handleOpenSettingsDialog}>Settings</ActionButton>
        <ActionButton className="is-primary" icon={<LocalPrintshopOutlinedIcon />} disabled={Object.keys(cardResults).length === 0} onClick={() => createPDF().catch(console.error)}>Create PDF</ActionButton>

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
        maxWidth='md'
        children={
          <SettingsDialog
            open={settingsDialogOpen}
            onClose={handleCloseSettingsDialog}
            settings={settings}
            onSettingsChange={handleSettingsChange}
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
        groupedResults={
          currentCardName && cardResults[currentCardName]
            ? groupResultsByApi(cardResults[currentCardName].results || [])
            : {}
        }
        onImageLoadError={(card: CardImageError) => handleImageError(card.name, card.imageUrl, card.apiName)}
      />

      <RawDataDialog rawData={rawDataDialog} onClose={handleCloseRawDataDialog} />

      <ClosableDialog
        open={customCardDialogOpen}
        onClose={handleCloseCustomCardDialog}
        maxWidth='sm'
        children={<AddCardDialog
          open={customCardDialogOpen}
          onClose={handleCloseCustomCardDialog}
          onSave={handleSaveCustomCard}
          searchForApis={searchForApis}
        />}
      />
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
