import React, { useState, useEffect, useMemo, useRef } from 'react';
import SearchCacheManagerDialog from './cache/SearchCacheManagerDialog';
import Popper from '@mui/material/Popper';
import Fade from '@mui/material/Fade';
import DisclaimerDialog from './info/DisclaimerDialog';
import { imageLoaderService } from '../service/cache/ImageLoaderService';
import SearchCacheService from '../service/cache/SearchCacheService';
import ImageSelectDialog from './grid/ImageSelectDialog';
import PdfProgressDialog from './pdf/PdfProgressDialog';
import { JsonView } from 'react-json-view-lite';
import '../viewer/CardGrid.css';
import { SettingsDialog, defaultSettings } from './pdf/SettingsDialog';
import LocalPrintshopOutlinedIcon from '@mui/icons-material/LocalPrintshopOutlined';
import SearchIcon from '@mui/icons-material/Search';
import SettingsIcon from '@mui/icons-material/Settings';
import CardImage from './grid/CardImage';
import AddCardDialog from './grid/AddCardDialog';
import ApiConfigDialog from '../api/view/api/ApiConfigDialog';
import TranslateIcon from '@mui/icons-material/Translate';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import AddIcon from '@mui/icons-material/Add';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import PaletteIcon from '@mui/icons-material/Palette';
import DeleteIcon from '@mui/icons-material/Delete';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import UploadIcon from '@mui/icons-material/Upload';
import DownloadIcon from '@mui/icons-material/Download';
import PayPalDonateButton from './info/PayPalDonateButton';
import GitHubButton from './info/GitHubButton';
import TitleDiv from '../svg/TitleDiv';
import AddCardButton from './grid/AddCardButton';
import VersionInfo from './info/VersionInfo';
import { Minus, Plus } from 'lucide-react';
import EyeTriangle from '../svg/EyeTriangle';
import { Dialog, DialogContent } from '@mui/material';
import ClosableDialog from '../container/ClosableDialog';
import ApiFactory from '../service/ApiFactory';
import CacheManagerDialog from './cache/CacheManagerDialog';
import { CacheProgressBar } from './cache/CacheProgressBar';
import QueueManagerDialog from './cache/QueueManagerDialog';
import { useTheme } from './ThemeProvider';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import NightlightIcon from '@mui/icons-material/Nightlight';
import GalleryConfigDialog from '../api/view/gallery/GalleryConfigDialog';


const NO_LANGUAGE = 'No Language';



const DeckInputAndViewer = () => {
  const [decklist, setDecklist] = useState('');
  const [cardResults, setCardResults] = useState({});
  const [settings, setSettings] = useState(defaultSettings);
  const [log, setLog] = useState([]);
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [rawDataDialog, setRawDataDialog] = useState(null);
  const [categoryStates, setCategoryStates] = useState({});
  const [apiConfigs, setApiConfigs] = useState({}); // New state for API configs
  const [apiFactory, setApiFactory] = useState(null); // State for API factory
  const [enabledApis, setEnabledApis] = useState(() =>
    Object.keys(apiConfigs).reduce((acc, key) => ({ ...acc, [apiConfigs[key].name]: true }), {})
  );
  const [selectedCards, setSelectedCards] = useState({});
  const [currentCardName, setCurrentCardName] = useState(null);
  const [currentCardIndex, setCurrentCardIndex] = useState(null);
  const [availableLanguages, setAvailableLanguages] = useState(new Set([NO_LANGUAGE]));

  const [searchCount, setSearchCount] = useState(0);

  const [visibleLanguages, setVisibleLanguages] = useState(new Set([NO_LANGUAGE]));
  const [visibleApis, setVisibleApis] = useState(new Set(Object.keys(apiConfigs)));
  const [pdfProgressDtos, setPdfProgressDtos] = useState([]); // statt pdfProgressDto
  const [uniquePrints, setUniquePrints] = useState(true);
  const [showImageSettings, setShowImageSettings] = useState(false);

  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [imageCacheDialogOpen, setImageCacheDialogOpen] = useState(false);
  const [queueDialogOpen, setQueueDialogOpen] = useState(false);
  const [imageSelectDialogOpen, setImageSelectDialogOpen] = useState(false);
  const [pdfProgressDialogOpen, setPdfProgressDialogOpen] = useState(false);
  const [disclaimerOpen, setDisclaimerOpen] = useState(true);
  const [customCardDialogOpen, setCustomCardDialogOpen] = useState(false);
  const [apiConfigDialogOpen, setApiConfigDialogOpen] = useState(false);
  const [rawDataDialogOpen, setRawDataDialogOpen] = useState(false);
  const [searchCacheDialogOpen, setSearchCacheDialogOpen] = useState(false);
  const [galleryDialogOpen, setGalleryDialogOpen] = useState(false);


  const [gridSize, setGridSize] = useState(10); // Standardwert: 10rem

  const [showApiPopper, setShowApiPopper] = useState(false);
  const [showDecklistPopper, setShowDecklistPopper] = useState(false);
  const [hasShownDecklistPopper, setHasShownDecklistPopper] = useState(false); // <--- NEU

  const manageApisButtonRef = useRef(null);
  const decklistTextareaRef = useRef(null);

  const renderedApiCount = Object.values(apiConfigs).length;
  const prevRenderedApiCount = useRef(renderedApiCount);

  const pollingRef = useRef(null);
  const { setLightTheme, setDarkTheme } = useTheme();
  const [paletteDialogOpen, setPaletteDialogOpen] = useState(false);

  const [queueSnapshot, setQueueSnapshot] = useState(imageLoaderService.getSnapshotNumbers());

  useEffect(() => {
    const interval = setInterval(() => {
      const next = imageLoaderService.getSnapshotNumbers();
      setQueueSnapshot(prev => {
        if (JSON.stringify(next) !== JSON.stringify(prev)) {
          return next;
        }
        return prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // --- VARIABLEN FÜR QUEUE/ACTIVE/ETC ---
  const queuedCount = queueSnapshot?.queued || 0;
  const downloadCount = queueSnapshot?.active || 0;
  const cacheLoadCount = queueSnapshot?.cacheLoading || 0;

  useEffect(() => {
    setApiFactory(new ApiFactory(apiConfigs));
  }, [apiConfigs]);

  useEffect(() => {
    const saved = localStorage.getItem('setConfigs');
    console.log('storage content', saved);
    if (saved) {
      handleSaveApiConfigs(JSON.parse(saved));
    }
    return () => {
      stopPolling();
    };
  }, []);

  const resetGrid = () => {
    setCardResults({});
    setSelectedCards({});
    setLog([]);
    setProgress(0);
  };

  useEffect(() => {
    // Ermittle alle verfügbaren Sprachen und APIs aus den aktuellen cardResults
    const languages = new Set([NO_LANGUAGE]);
    const apis = new Set();
    Object.values(cardResults).forEach(cardData => {
      cardData.results.forEach(card => {
        if (card.languageCode) {
          languages.add(card.languageCode);
        }
        if (card.apiName) {
          apis.add(card.apiName);
        }
      });
    });

    // Setze nur availableLanguages (für die Checkboxen)
    setAvailableLanguages(languages);

    // Setze visibleApis/visibleLanguages nur, wenn sie leer sind (z.B. beim ersten Laden)
    setVisibleApis(prev => (prev.size === 0 ? apis : prev));
    setVisibleLanguages(prev => (prev.size === 0 ? languages : prev));
  }, [cardResults]);

  useEffect(() => {
    const initialCategoryStates = {};
    const categories = [...new Set(Object.values(apiConfigs).map(config => config.category))];
    categories.forEach(category => {
      initialCategoryStates[category] = false;
    });
    setCategoryStates(initialCategoryStates);
  }, [apiConfigs]);

  useEffect(() => {
    async function fetchCount() {
      const count = await SearchCacheService.getSearchCount();
      setSearchCount(count);
    }
    fetchCount();
  }, [searchCacheDialogOpen]);

  const updateSearchCount = async () => {
    const count = await SearchCacheService.getSearchCount();
    setSearchCount(count);
  };

  useEffect(() => {
    updateSearchCount();
  }, []);
  const addToLog = (message, configName, rawResponse) => {
    setLog((prevLog) => [...prevLog, { message, configName, rawResponse }]);
  };

  const handleSettingsChange = (newSettings) => {
    setSettings(newSettings);
  };

  const handleAddCustomCard = () => {
    setCustomCardDialogOpen(true);
  };

  const handleCloseCustomCardDialog = () => {
    setCustomCardDialogOpen(false);
  };

  const handleCloseApiConfigDialog = () => {
    setApiConfigDialogOpen(false);
  };

  const handleGridSizeChange = (event) => {
    setGridSize(event.target.value);
  };


  const handleSaveApiConfigs = async (apiconfigList) => {
    const configsObject = apiconfigList.reduce((acc, config) => {
      if (config.name) {
        acc[config.name] = config;
      }
      return acc;
    }, {});
    console.log('Saving new API configs:', configsObject);
    setApiConfigs(configsObject); // Update internal API configs state
  };

  const handleSaveCustomCard = async (cardName, imageUrl, file, gridSettings) => {
    console.log(cardName, imageUrl, file, gridSettings);

    let finalImageUrl;
    if (imageUrl) {
      finalImageUrl = imageUrl;
    }
    if (file) {
      finalImageUrl = '/api/files/download/' + file;
    }

    if (!gridSettings) {
      gridSettings = {}; // Falls gridSettings nicht definiert ist, initialisiere es als leeres Objekt
    }

    if (!gridSettings.rows) {
      gridSettings.rows = 1; // Setze 1 für rows, wenn es leer oder undefined ist
    }

    if (!gridSettings.cols) {
      gridSettings.cols = 1; // Setze 1 für cols, wenn es leer oder undefined ist
    }

    // Bild laden, um die Dimensionen zu ermitteln
    const img = new Image();
    img.src = finalImageUrl;

    img.onload = () => {
      const { width, height } = img;

      const cellWidth = Math.floor(width / gridSettings.cols);
      const cellHeight = Math.floor(height / gridSettings.rows);

      let cropIndex = 0; // Initialisieren des Indexes

      // Berechnung der Crops
      for (let row = 0; row < gridSettings.rows; row++) {
        for (let col = 0; col < gridSettings.cols; col++) {
          const crop = {
            offSetX: col * cellWidth,
            offSetY: row * cellHeight,
            width: cellWidth,
            height: cellHeight,
            isStretch: true
          };

          // Eintrag in cardResults für jedes Crop
          const cropKey = `${cardName}_crop${cropIndex}`;

          // Card-Objekt mit imageInfo (Originalbild)
          const cardObj = {
            imageUrl: finalImageUrl,
            apiName: 'custom',
            languageCode: NO_LANGUAGE,
            cropSettings: crop,
            imageInfo: { width, height } // <-- Originalbild-Dimensionen!
          };

          // cardResults aktualisieren
          setCardResults((prev) => ({
            ...prev,
            [cropKey]: {
              count: 1,
              results: [cardObj],
              cropSettings: crop,
            },
          }));

          // selectedCards aktualisieren
          setSelectedCards((prev) => ({
            ...prev,
            [cropKey]: [cardObj],
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
  }, []);

  const handleWebsiteClick = (url, event) => {
    event.stopPropagation();
    window.open(url, "_blank");
  };

  const filterCard = useMemo(() => (card) => {
    return visibleLanguages.has(card.languageCode || NO_LANGUAGE) &&
      (visibleApis.has(card.apiName) || card.apiName == 'custom');
  }, [visibleLanguages, visibleApis]);

  useEffect(() => {
    if (renderedApiCount === 0) {
      setShowApiPopper(true);
      setShowDecklistPopper(false);
    } else {
      setShowApiPopper(false);
    }
  }, [renderedApiCount]);

  useEffect(() => {
    // Zeige Decklist-Popper nur, wenn von 0 auf >0 gewechselt wurde und noch nie gezeigt
    if (
      !apiConfigDialogOpen &&
      renderedApiCount > 0 &&
      prevRenderedApiCount.current === 0 &&
      !showApiPopper &&
      !hasShownDecklistPopper
    ) {
      setShowDecklistPopper(true);
      setHasShownDecklistPopper(true);
    }
    prevRenderedApiCount.current = renderedApiCount;
    // Schließe Popper, wenn APIs wieder auf 0 gehen
    if (renderedApiCount === 0) {
      setShowDecklistPopper(false);
    }
  }, [apiConfigDialogOpen, renderedApiCount, showApiPopper, hasShownDecklistPopper]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setCardResults({});
    setLog([]);
    setProgress(0);

    const cardEntries = decklist.split('\n')
      .map(line => line.trim())
      .filter(line => line)
      .map(line => {
        const match = line.match(/^(\d+)\s+(.+?)(?:\s+\(([^)]+)\))?\s*$/);
        if (match) {
          return {
            count: parseInt(match[1], 10),
            name: match[2].trim(),
            set: match[3]?.trim() || null
          };
        }
        return null;
      })
      .filter(entry => entry !== null);

    const totalCards = cardEntries.reduce((sum, entry) => sum + entry.count, 0);
    let completedCards = 0;

    const apiResults = {};
    const enabledApiKeys = Object.keys(enabledApis).filter(key => enabledApis[key]);

    // Group APIs
    const proxyGroup = enabledApiKeys.filter(key => apiConfigs[key]?.useBackendProxy);
    const nonProxyApis = enabledApiKeys.filter(key => !apiConfigs[key]?.useBackendProxy);

    // Function to process a single API or proxy group
    const processApiGroup = async (apiKeys) => {
      const groupResults = {};
      for (const apiKey of apiKeys) {
        groupResults[apiKey] = {};
        const limit = apiConfigs[apiKey]?.concurrentLimit || Infinity;
        const api = apiFactory.createApi(apiKey);

        const tasks = cardEntries.map(entry => async () => {
          if (!groupResults[apiKey][entry.name]) {
            try {
              let result;
              if (await SearchCacheService.hasSearchResult(apiKey, entry.name)) {
                result = await SearchCacheService.getSearchResult(apiKey, entry.name);
                const resultsArr = result?.results || [];
                addToLog(`Cached ${resultsArr.length} ${entry.name}`, apiKey);
                groupResults[apiKey][entry.name] = resultsArr;
              } else {
                result = await api({ cardname: entry.name, set: entry.set });
                await SearchCacheService.setSearchResult(apiKey, entry.name, result);
                const resultsArr = result?.results || [];
                addToLog(`Found ${resultsArr.length} ${entry.name}`, apiKey, result.rawResponse);
                groupResults[apiKey][entry.name] = resultsArr;
              }
            } catch (error) {
              addToLog(`Error ${entry.name}: ${error.message}`, apiKey);
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
    const results = {};
    cardEntries.forEach(entry => {
      results[entry.name] = {
        count: entry.count,
        results: enabledApiKeys.flatMap(apiKey => {
          const apiResultsForCard = apiResults[apiKey][entry.name] || [];
          return apiResultsForCard.map(result => ({
            ...result,
            cropSettings: { ...defaultCropSettings }
          }));
        })
      };
    });

    setCardResults(results);
    setIsLoading(false);

    // Set initial selected cards based on cache or select first image
    const initialSelectedCards = {};
    Object.entries(results).forEach(([cardName, cardData]) => {
      initialSelectedCards[cardName] = Array(cardData.count).fill().map((_, index) => {
        if (SearchCacheService.hasSelectedImage(cardName, index + 1)) {
          const cachedImageUrl = SearchCacheService.getSelectedImage(cardName, index + 1);
          return cardData.results.find(card => card.imageUrl === cachedImageUrl) || cardData.results[0] || null;
        }
        return cardData.results[0] || null;
      });
    });
    setSelectedCards(initialSelectedCards);
  };

  const defaultCropSettings = {
    offSetX: 0, // Default value for CropSettings
    offSetY: 0, // Default value for CropSettings
    width: 0, // Default value for CropSettings
    height: 0, // Default value for CropSettings
    isStretch: true
  };

  const handleCloseImageSelectDialog = (selectedImage) => {
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

  const handleRemoveCard = (cardName, index) => {
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

  const handleCardClick = (cardName, index) => {
    setCurrentCardName(cardName);
    setCurrentCardIndex(index);
    setImageSelectDialogOpen(true);
  };

  const handleOpenSettingsDialog = () => setSettingsDialogOpen(true);
  const handleCloseSettingsDialog = () => setSettingsDialogOpen(false);
  const handleOpenImageCacheDialog = () => setImageCacheDialogOpen(true);
  const handleCloseImageCacheDialog = () => setImageCacheDialogOpen(false);
  const handleOpenQueueDialog = () => setQueueDialogOpen(true);
  const handleCloseQueueDialog = () => setQueueDialogOpen(false);

  const handleOpenApiConfigDialog = () => setApiConfigDialogOpen(true);

  const handleCloseRawDataDialog = () => {
    setRawDataDialog(null);
    setRawDataDialogOpen(false);
  };

  const toggleLanguage = (languageCode) => {
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

  const toggleApi = (apiName) => {
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
    imageLoaderService.stopForFilters(visibleLanguages, visibleApis);
  }, [visibleLanguages, visibleApis]);

  useEffect(() => {
    setSelectedCards(prev => {
      const newSelectedCards = { ...prev };
      let hasChanges = false;

      Object.entries(cardResults).forEach(([cardName, cardData]) => {
        const visibleResults = cardData.results.filter(filterCard);

        newSelectedCards[cardName] = Array(cardData.count).fill().map((_, index) => {
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
  }, [visibleLanguages, visibleApis, cardResults]);

  const handleApiToggle = (apiKey) => {
    setEnabledApis(prev => {
      const updated = { ...prev, [apiKey]: !prev[apiKey] };
      return updated;
    });
  };

  const handleCategoryToggle = (category) => {
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



  const getCategoryState = (category) => {
    const categoryApis = Object.values(apiConfigs).filter(config => config.category === category);
    const checkedCount = categoryApis.filter(config => enabledApis[config.name]).length;

    if (checkedCount === 0) return 'unchecked';
    if (checkedCount === categoryApis.length) return 'checked';
    return 'indeterminate';
  };

  const createPDF = async (printSettings) => {
    setPdfProgressDialogOpen(true);
    setPdfProgressDtos([]);

    const createPdfDto = {
      images: Object.entries(selectedCards).flatMap(([cardName, cardSelections]) => {
        if (uniquePrints) {
          return cardSelections
            .map(selectedCard =>
              selectedCard?.imageUrl
                ? { imageUrl: selectedCard.imageUrl, cropSettings: selectedCard.cropSettings }
                : null
            )
            .filter(item => item);
        } else {
          const firstValidCard = cardSelections.find(selectedCard => selectedCard?.imageUrl);
          if (!firstValidCard) return [];
          const count = cardResults[cardName]?.count || 1;
          return Array(count).fill({
            imageUrl: firstValidCard.imageUrl,
            cropSettings: firstValidCard.cropSettings
          });
        }
      }),
      settings: printSettings
    };

    try {
      // PDF-Erstellung starten
      const response = await fetch('/api/pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(createPdfDto),
      });

      if (!response.ok) {
        setPdfProgressDtos([]);
        return;
      }
      const progressId = await response.text();

      // Polling für Fortschritt starten
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = setInterval(async () => {
        try {
          const progressResponse = await fetch(`/api/progress/${progressId}`, {
            headers: {
              'Content-Type': 'application/json'
            }
          });
          if (progressResponse.ok) {
            const dto = await progressResponse.json();
            setPdfProgressDtos(dto);
          } else {
            stopPolling();
          }
        } catch (error) {
          console.error('Error fetching PDF progress:', error);
          stopPolling();
        }
      }, 1000); // alle 1 Sekunde

    } catch (error) {
      setPdfProgressDtos([]);
      stopPolling();
    }
  };

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const handleProgressError = () => {
    stopPolling();
    setPdfProgressDtos([]);
    setPdfProgressDialogOpen(false);
  };

  const downloadPDF = async (progressId) => {
    try {
      stopPolling();
      const pdfResponse = await fetch(`/api/pdf/${progressId}`);
      if (pdfResponse.ok) {
        const blob = await pdfResponse.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'deck.pdf');
        document.body.appendChild(link);
        link.click();
        link.remove();
      } else {
        throw new Error('Failed to download PDF');
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Failed to download PDF. Please try again.');
    } finally {
      setPdfProgressDialogOpen(false);
    }
  };

  const limitConcurrency = (tasks, limit) => {
    let running = 0;
    const queue = [];

    return new Promise((resolve) => {
      function runNext() {
        if (running >= limit || queue.length === 0) return;

        const task = queue.shift();
        running++;

        task().then(() => {
          running--;
          runNext();
        });

        runNext();
      }

      tasks.forEach((task) => {
        queue.push(() => new Promise((resolveTask) => {
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

  const renderCheckbox = (id, label, checked, onChange, isIndeterminate = false, labelClass) => (
    <div className="flex items-center">
      <div className="relative flex items-center">
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={onChange}
          className="sr-only"
        />
        <div className={`w-5 h-5 border rounded ${checked ? 'bg-blue-500' : 'bg-white'} ${isIndeterminate ? 'bg-blue-500' : ''}`}>
          {checked && !isIndeterminate && (
            <div className="w-3 h-3 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 before:content-[''] before:block before:w-2 before:h-1 before:border-r-2 before:border-b-2 before:border-white before:transform before:rotate-45"></div>
          )}
          {isIndeterminate && <div className="w-3 h-3 bg-white m-1"></div>}
        </div>
      </div>
      <label
        htmlFor={id}
        className={`ml-2 text-sm font-medium ${labelClass ? labelClass : ''} ${checked ? 'checkbox-label-checked' : ''}`}
      >
        {label}
      </label>
    </div>
  );


  const handleImageLoad = (card, imageInfo) => {
    setCardResults((prevResults) => {
      // Suche nach der Karte in der Struktur und aktualisiere sie
      const updatedResults = { ...prevResults };
      for (const [cardName, cardData] of Object.entries(updatedResults)) {
        const targetCard = cardData.results.find((result) => result === card);
        if (targetCard) {
          targetCard.imageInfo = imageInfo; // Füge `imageInfo` hinzu
        }
      }
      return updatedResults; // Aktualisierter Zustand
    });
  };

  const groupResultsByApi = (results) => {
    return results.reduce((acc, result) => {
      if (!acc[result.apiName]) {
        acc[result.apiName] = [];
      }
      acc[result.apiName].push(result);
      return acc;
    }, {});
  };

  const getImageLabelCategory = (category) => {
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

  const updateCardCount = (cardName, increment) => {
    setCardResults(prevResults => ({
      ...prevResults,
      [cardName]: {
        ...prevResults[cardName],
        count: Math.max(0, prevResults[cardName].count + increment)
      }
    }));
  };

  const getApiConfigLabelForCheckbox = (config) => {
    return (
      <div className="label-container">
        <span>{config.name}</span>
        {config.languageField || config.nestedLanguageLanguageField ? (
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
          <span className="external-link" onClick={(e) => handleWebsiteClick(config.officialWebsite, e)}>
            <TravelExploreIcon style={{ color: "#1976d2", cursor: "pointer" }} className="subCategoryIcon" />
          </span>
        )}

      </div>
    );
  };

  const handleUniquePrintsChanged = (event) => {
    setUniquePrints(event.target.checked);
  }

  const handleShowImageSettingsChanged = (event) => {
    setShowImageSettings(event.target.checked);
  }

  const searchForApis = async (cardName) => {
    setIsLoading(true);
    setProgress(0);

    // Erstelle einen einzelnen Card Entry mit count 1
    const cardEntry = { count: 1, name: cardName };
    let completedCards = 0;

    const apiResults = {};
    const enabledApiKeys = Object.keys(enabledApis).filter(key => enabledApis[key]);

    // Group APIs
    const proxyGroup = enabledApiKeys.filter(key => apiConfigs[key]?.useBackendProxy);
    const nonProxyApis = enabledApiKeys.filter(key => !apiConfigs[key]?.useBackendProxy);

    // Function to process a single API or proxy group
    const processApiGroup = async (apiKeys) => {
      const groupResults = {};
      for (const apiKey of apiKeys) {
        groupResults[apiKey] = {};
        const limit = apiConfigs[apiKey]?.concurrentLimit || Infinity;
        const api = apiFactory.createApi(apiKey);

        try {
          let result;
          if (await SearchCacheService.hasSearchResult(apiKey, cardEntry.name)) {
            result = await SearchCacheService.getSearchResult(apiKey, cardEntry.name);
            const resultsArr = result?.results || [];
            addToLog(`Cached ${resultsArr.length} ${cardEntry.name}`, apiKey);
            groupResults[apiKey][cardEntry.name] = resultsArr;
          } else {
            result = await api({ cardname: cardEntry.name });
            await SearchCacheService.setSearchResult(apiKey, cardEntry.name, result);
            const resultsArr = result?.results || [];
            addToLog(`Found ${resultsArr.length} ${cardEntry.name}`, apiKey, result.rawResponse);
            groupResults[apiKey][cardEntry.name] = resultsArr;
          }
        } catch (error) {
          addToLog(`Error ${cardEntry.name}: ${error.message}`, apiKey);
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
    const results = {
      [cardEntry.name]: {
        count: cardEntry.count,
        results: enabledApiKeys.flatMap(apiKey => {
          const apiResultsForCard = apiResults[apiKey][cardEntry.name] || [];
          return apiResultsForCard.map(result => ({
            ...result,
            cropSettings: { ...defaultCropSettings }
          }));
        })
      }
    };

    // Set CardResults with transformed CardEntry objects
    setCardResults(prevResults => ({
      ...prevResults,
      ...results
    }));

    setIsLoading(false);
  };

  const handlePrintPdf = (newSettings) => {
    setSettings(newSettings);
    createPDF(newSettings);
  };


  const handleImageError = (cardName, failedImageUrl, apiName) => {
    console.log(`Image failed to load: ${failedImageUrl} for card ${cardName} from API ${apiName}`);

    setCardResults(prevResults => {
      const updatedResults = { ...prevResults };
      if (updatedResults[cardName]) {
        // Filter out the failed image from the results
        updatedResults[cardName].results = updatedResults[cardName].results.filter(
          result => result.imageUrl !== failedImageUrl
        );

        // If no results remain for this card from any API, keep the structure but with empty results
        if (updatedResults[cardName].results.length === 0) {
          updatedResults[cardName].results = [];
        }
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

  function renderCategoryCheckbox(category, label, checked, onClick, indeterminate, className) {
    return (
      <div className={`category-checkbox-row ${className || ""}`}>
        <div
          className={`category-icon-container${checked ? " selected" : ""}`}
          onClick={onClick}
          title={typeof label === "string" ? label : undefined}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 44,
            height: 44,
            border: checked ? "3px solid #a084ca" : "3px solid transparent",
            borderRadius: "50%",
            boxSizing: "border-box",
            cursor: "pointer",
            transition: "border 0.2s"
          }}
        >
          {label}
        </div>
        {typeof label === "string" && <span style={{ marginLeft: 12 }}>{label}</span>}
      </div>
    );
  }


  // Merke dir die zuletzt gesendeten URLs
  const lastPreloadedUrlsRef = useRef(new Set());

  useEffect(() => {
    // Extrahiere alle aktuell selektierten Image-URLs
    const allSelectedUrls = new Set();
    Object.values(selectedCards).forEach(cardArr => {
      cardArr.forEach(card => {
        if (card?.imageUrl) {
          allSelectedUrls.add(card.imageUrl);
        }
      });
    });

    // Finde neue URLs, die noch nicht preloaded wurden
    const lastPreloaded = lastPreloadedUrlsRef.current;
    const newUrls = Array.from(allSelectedUrls).filter(url => !lastPreloaded.has(url));

    if (newUrls.length > 0) {
      // Sende nur neue URLs an das Backend
      fetch('/api/proxy/image/preload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUrls)
      }).catch(console.error);

      // Aktualisiere die Referenz
      lastPreloadedUrlsRef.current = new Set(allSelectedUrls);
    } else if (lastPreloaded.size > allSelectedUrls.size) {
      // Wenn URLs entfernt wurden (z.B. durch Filter), setze die Referenz zurück
      lastPreloadedUrlsRef.current = new Set(allSelectedUrls);
    }
  }, [selectedCards]);

  // Buttons für Theme-Wechsel
  const ThemeButtons = () => (
    <div style={{ position: 'absolute', top: 16, left: 16, display: 'flex', gap: 12, zIndex: 10 }}>
      <button
        className="button memory-button"
        title="Light Theme"
        onClick={setLightTheme}
      >
        <WbSunnyIcon />
      </button>
      <button
        className="button memory-button"
        title="Dark Theme"
        onClick={setDarkTheme}
      >
        <NightlightIcon />
      </button>
      <button
        className="button memory-button"
        title="Custom Theme"
        onClick={() => setPaletteDialogOpen(true)}
      >
        <PaletteIcon />
      </button>
    </div>
  );

  const MemoryButtons = () => (
    <div className="memory-buttons-bar">
      <button
        className="button memory-button"
        title="Queued Downloads"
        onClick={handleOpenQueueDialog}
      >
        <AccessTimeIcon />
        <span className="memory-button-count">{queuedCount}</span>
      </button>
      <button
        className="button memory-button"
        title="Aktive Downloads"
        onClick={handleOpenQueueDialog}
      >
        <DownloadIcon />
        <span className="memory-button-count">{downloadCount}</span>
      </button>
      <button
        className="button memory-button"
        title="Cache-Ladevorgänge"
        onClick={handleOpenQueueDialog}
      >
        <UploadIcon />
        <span className="memory-button-count">{cacheLoadCount}</span>
      </button>

      <button className="button memory-button"
        onClick={() => setSearchCacheDialogOpen(true)}
        title="Search Cache anzeigen"
      >
        <SearchIcon />
        <span>
          {searchCount}
        </span>
      </button>

      <button
        className="button memory-button"
        title="Cache anzeigen"
        onClick={handleOpenImageCacheDialog}
      >

        <CacheProgressBar onClick={handleOpenImageCacheDialog} />
      </button>
      <button
        className="button memory-button"
        title="Cache leeren"
        onClick={() => imageLoaderService.clearCache()}
      >
        <DeleteIcon />
      </button>
    </div>
  );

  return (
    <div className="deck-input-and-viewer" style={{ position: 'relative' }}>
      <ThemeButtons />
      <MemoryButtons />
      <TitleDiv />


      <div className="input-controls">
        <div className="api-controls">
          <h3 className="text-lg font-semibold mb-4 title is-4">API Selection</h3>
          <div className="">
            <button ref={manageApisButtonRef} className="button" onClick={handleOpenApiConfigDialog}><SettingsIcon />Manage Apis</button>
            <Popper
              open={showApiPopper}
              anchorEl={manageApisButtonRef.current}
              placement="right"
              transition
              style={{ zIndex: 2000 }}
            >
              {({ TransitionProps }) => (
                <Fade {...TransitionProps} timeout={350}>
                  <div style={{
                    background: "#fff",
                    border: "1px solid #a084ca",
                    color: "#5a3577",
                    padding: "12px 18px",
                    borderRadius: 8,
                    boxShadow: "0 2px 8px rgba(80,60,120,0.15)",
                    fontWeight: 600,
                    fontSize: "1rem",
                    maxWidth: 260
                  }}>
                    Start by selecting a search database.<br />
                    Click "Manage Apis" to begin.
                  </div>
                </Fade>
              )}
            </Popper>
          </div>
          <div className="api-toggles checkbox-group">

            {Object.entries(categoryStates).map(([category, _]) => (
              <div key={category} className="mb-4">
                {renderCategoryCheckbox(
                  category,
                  getImageLabelCategory(category.toUpperCase()),
                  getCategoryState(category) === 'checked',
                  () => handleCategoryToggle(category),
                  getCategoryState(category) === 'indeterminate',
                  'category-label'
                )}

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
          </div>
        </div>

        <div className="decklist-input">
          <h2 className='title is-4'>Enter Decklist</h2>
          <form onSubmit={handleSubmit}>
            <textarea
              ref={decklistTextareaRef}
              value={decklist}
              onChange={(e) => setDecklist(e.target.value)}
              placeholder={`1 Charizard ex
1 Charizard VMAX
1 Forest`}
              rows={10}
              cols={50}
            />
            <Popper
              open={showDecklistPopper}
              anchorEl={decklistTextareaRef.current}
              placement="bottom-start"
              transition
              style={{ zIndex: 2000 }}
            >
              {({ TransitionProps }) => (
                <Fade {...TransitionProps} timeout={350}>
                  <div style={{
                    background: "#fff",
                    border: "1px solid #a084ca",
                    color: "#5a3577",
                    padding: "12px 18px",
                    borderRadius: 8,
                    boxShadow: "0 2px 8px rgba(80,60,120,0.15)",
                    fontWeight: 600,
                    fontSize: "1rem",
                    maxWidth: 260
                  }}>
                    Now enter your decklist and analyze!
                  </div>
                </Fade>
              )}
            </Popper>
            <br />
              {isLoading && (
          <div className="progress-bar">
            <div className="progress" style={{ width: `${progress}%` }}></div>
            <span>{progress}%</span>
          </div>
        )}
            <button className="button mt-2 mb-2" type="submit" disabled={isLoading}><SearchIcon />Import Deck</button>
            <button
              className="button mt-2 mb-2"
              type="button"
              style={{ marginLeft: 8 }}
              onClick={resetGrid}
              disabled={isLoading || Object.keys(cardResults).length === 0}
            >
              <RestartAltIcon />  Reset
            </button>
</form>
 <h2 className='title is-4'>Add Single</h2>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button
                className="button mt-2 mb-2"
                type="button"
                onClick={() => setCustomCardDialogOpen(true)}
              >
                <AddIcon /> Add
              </button>
              <button
                className="button mt-2 mb-2"
                type="button"
                onClick={() => setGalleryDialogOpen(true)}
              >
                <PhotoLibraryIcon /> Gallery
              </button>
            </div>
          

        </div>
      
        {/* <div className="log">
          <h2 className='title is-4'>Search Log</h2>
          <div className="log-content">
            {log.map((entry, index) => (
              <div key={index} className="log-entry">
                <span className="config-name">[{entry.configName}]</span>
                <span>{entry.message}</span>
                {entry.rawResponse && (
                  <span className="raw-data-icon" onClick={() => setRawDataDialog(entry.rawResponse)}>🔍</span>
                )}
              </div>
            ))}
          </div>
        </div> */}
      </div>

      <div className="decklist-viewer">

        <div className="deck-viewer">
          <div className="deck-viewer-content">
            <div className="card-grid">
              <div
                className="card-tiles"
                style={{
                  gridTemplateColumns: `repeat(auto-fill, minmax(${gridSize}rem, ${gridSize}rem))`,
                  gap: '10px',
                }}
              >
                {Object.entries(cardResults).map(([cardName, cardData]) => {
                  const visibleResults = cardData.results.filter(filterCard);
                  const noMatchingCard = visibleResults.length === 0;

                  const tilesToRender = uniquePrints ? cardData.count : 1;

                  return Array(tilesToRender).fill().map((_, index) => {
                    let selectedCard = selectedCards[cardName]?.[index];
                    if (visibleResults.length > 0 && visibleResults.indexOf(selectedCard) === -1) {
                      selectedCard = visibleResults[0];
                    }
                    return (
                      <div
                        key={`${cardName}-${index}`}
                        className={`card-tile ${noMatchingCard ? 'no-matching-card' : ''} ${selectedCard?.apiName === 'custom' ? 'custom-card' : ''}`}
                      >
                        <div onClick={() => handleCardClick(cardName, index)}>
                          {selectedCard ? (
                            <CardImage
                              cardInput={selectedCard}
                              isPermanent={true}
                              showImageSettings={showImageSettings}
                              onLoad={(imageInfo) => handleImageLoad(selectedCard, imageInfo)}
                              onError={() => handleImageError(cardName, selectedCard.imageUrl, selectedCard.apiName)}
                            />
                          ) : (
                            <div className="no-image">No image available</div>
                          )}
                        </div>
                        <div className="card-name">
                          <p>{cardName}</p>
                        </div>
                        <div className="card-name">

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
                              className="px-2 py-1 mx-1 bg-gray-200 rounded"
                            >
                              <Minus size={12} />
                            </button>
                            {cardData.count}
                            <button
                              onClick={() => updateCardCount(cardName, 1)}
                              className="px-2 py-1 mx-1 bg-gray-200 rounded"
                            >
                              <Plus size={12} />
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

      <div className="view-selection">

        <div className="filter-controls">
          <h2 className='title is-5'>View Selection</h2>
          <div className="language-filter checkbox-group">
            {renderCheckbox('uniquePrints', 'Unique Prints', uniquePrints, (event) => handleUniquePrintsChanged(event))}
            {renderCheckbox('showImageSettings', 'Show Image Info', showImageSettings, (event) => handleShowImageSettingsChanged(event))}
            <div className="grid-size-control">
              <label htmlFor="gridSize" className="checkbox-label-checked">
                Grid Size
              </label>
            </div>
            <div>
              <input
                id="gridSize"
                type="range"
                min="7"
                max="25"
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
              renderCheckbox(lang, lang === NO_LANGUAGE ? 'No Language' : lang, visibleLanguages.has(lang), () => toggleLanguage(lang))
            ))}
          </div>
          <div className="api-filter checkbox-group">
            <h3 className='title is-5'>API Filter</h3>
            {Object.values(apiConfigs)
              .filter((c) => enabledApis.hasOwnProperty(c.name))
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

        <div><button
          className="button"
          disabled={Object.keys(cardResults).length === 0}
          onClick={() => setSettingsDialogOpen(true)}
        >
          <LocalPrintshopOutlinedIcon />Print PDF
        </button></div>
      </div>

      <div className="bottom">
        <h3 className='title is-5'>Support</h3>
        <div><PayPalDonateButton /></div>
        <div><GitHubButton /></div>
        <div><VersionInfo /></div>
      </div>


      <ClosableDialog
        open={settingsDialogOpen}
        onClose={handleCloseSettingsDialog}
        maxWidth='md'
        children={
          <SettingsDialog
            open={settingsDialogOpen}
            onClose={handleCloseSettingsDialog}
            settings={settings}
            onPrint={handlePrintPdf}
          />
        }
      />

      <ClosableDialog
        open={imageCacheDialogOpen}
        onClose={handleCloseImageCacheDialog}
        maxWidth='md'
        children={
          <CacheManagerDialog open={imageCacheDialogOpen} onClose={handleCloseImageCacheDialog} />
        }
      />

      <ClosableDialog
        open={queueDialogOpen}
        onClose={handleCloseQueueDialog}
        maxWidth='md'
        children={
          <QueueManagerDialog open={queueDialogOpen} onClose={handleCloseQueueDialog} />
        }
      />
      <ClosableDialog
        open={galleryDialogOpen}
        onClose={() => setGalleryDialogOpen(false)}
        maxWidth='md'
        children={
          <GalleryConfigDialog
  open={galleryDialogOpen}
  onClose={() => setGalleryDialogOpen(false)}
  handleGalleryResults={(results) => {
    if (results) {
      results.forEach(r => handleSaveCustomCard(r.name, r.imageUrl, null));
    }
    // Optional: Ergebnisse aus der Gallery verarbeiten
    // Beispiel: results.forEach(r => handleSaveCustomCard(r.name, r.imageUrl, null));
    setGalleryDialogOpen(false);
  }}
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
        cardName={currentCardName}
        forceCropMode={
          currentCardName && cardResults[currentCardName]
            ? Object.keys(groupResultsByApi(cardResults[currentCardName].results || [])).length === 0
            : true
        }
        cardIndex={currentCardIndex}
        onImageLoadError={(card) => handleImageError(card.name, card.imageUrl, card.apiName)}
        // PATCH: CropSettings-Änderung an selectedCards weiterreichen
        onCropSettingsChange={(cardName, cardIndex, updatedImage) => {
          setSelectedCards(prev => {
            const currentCards = prev[cardName] || [];
            return {
              ...prev,
              [cardName]: currentCards.map((card, idx) =>
                idx === cardIndex ? updatedImage : card
              )
            };
          });
        }}
      />

      {rawDataDialog && (
        <div className="dialog-overlay" onClick={handleCloseRawDataDialog}>
          <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
            <h3 className='title is-5'>Raw API Response</h3>
            <div className="json-viewer-container">
              <JsonView data={JSON.parse(rawDataDialog)} />
            </div>
            <div className="dialog-buttons">
              <button onClick={() => navigator.clipboard.writeText(rawDataDialog)}>Copy to Clipboard</button>
              <button onClick={handleCloseRawDataDialog}>Close</button>
            </div>
          </div>
        </div>
      )}

      <ClosableDialog
        open={customCardDialogOpen}
        onClose={handleCloseCustomCardDialog}
        children={<AddCardDialog
          open={customCardDialogOpen}
          onClose={handleCloseCustomCardDialog}
          onSave={handleSaveCustomCard}
          searchForApis={searchForApis}
        />}
      />
      <Dialog
        maxWidth='lg'
        fullWidth
        open={pdfProgressDialogOpen}>
        <DialogContent>
          <PdfProgressDialog
            open={pdfProgressDialogOpen}
            progressDtos={pdfProgressDtos}
            onFinish={downloadPDF}
            onError={handleProgressError}
          />
        </DialogContent>
      </Dialog>

      <ClosableDialog
        open={searchCacheDialogOpen}
        onClose={() => setSearchCacheDialogOpen(false)}
        maxWidth='md'
        children={
          <SearchCacheManagerDialog
            open={searchCacheDialogOpen}
            onClose={() => setSearchCacheDialogOpen(false)}
          />
        }
      />

      <ClosableDialog
        open={apiConfigDialogOpen}
        onClose={handleCloseApiConfigDialog}
        maxWidth='m'
        children={
          <ApiConfigDialog
            open={apiConfigDialogOpen}
            onClose={handleCloseApiConfigDialog}
            onSave={handleSaveApiConfigs}
          />
        }
      ></ClosableDialog>

      <DisclaimerDialog open={disclaimerOpen} onClose={() => setDisclaimerOpen(false)} />
    </div>
  );
};

export default DeckInputAndViewer;
