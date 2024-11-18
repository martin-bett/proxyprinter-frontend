import React, { useState, useEffect, useMemo } from 'react';
import CacheService from './CacheService';
import ApiFactory from '../api/ApiFactory';
import ImageSelectDialog from './ImageSelectDialog';
import PdfProgressDialog from './PdfProgressDialog';
import { JsonView } from 'react-json-view-lite';
import '../viewer/CardGrid.css';
import { SettingsDialog, defaultSettings } from './SettingsDialog';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import LocalPrintshopOutlinedIcon from '@mui/icons-material/LocalPrintshopOutlined';
import SearchIcon from '@mui/icons-material/Search';
import SettingsIcon from '@mui/icons-material/Settings';
import CardImage from './CardImage';
import CustomCardDialog from './CustomCardDialog';
import ApiConfigDialog from './ApiConfigDialog';
import TranslateIcon from '@mui/icons-material/Translate';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import PaletteIcon from '@mui/icons-material/Palette';
import PayPalDonateButton from './PayPalDonateButton';
import GitHubButton from './GitHubButton';
import TitleDiv from './TitleDiv';
import AddCardButton from './AddCardButton';
import VersionInfo from './VersionInfo';
import { Minus, Plus } from 'lucide-react';
import EyeTriangle from './EyeTriangle';

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

  const [visibleLanguages, setVisibleLanguages] = useState(new Set([NO_LANGUAGE]));
  const [visibleApis, setVisibleApis] = useState(new Set(Object.keys(apiConfigs)));
  const [pdfProgress, setPdfProgress] = useState(0);
  const [pdfProgressMessage, setPdfProgressMessage] = useState('');
  const [uniquePrints, setUniquePrints] = useState(true);

  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [imageSelectDialogOpen, setImageSelectDialogOpen] = useState(false);
  const [pdfProgressDialogOpen, setPdfProgressDialogOpen] = useState(false);
  const [customCardDialogOpen, setCustomCardDialogOpen] = useState(false);
  const [apiConfigDialogOpen, setApiConfigDialogOpen] = useState(false);
  const [rawDataDialogOpen, setRawDataDialogOpen] = useState(false);

  useEffect(() => {
    setApiFactory(new ApiFactory(apiConfigs));
  }, [apiConfigs]);

  useEffect(() => {
    const saved = localStorage.getItem('setConfigs');
    console.log('storage content', saved);
    if (saved) {
      handleSaveApiConfigs(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
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
    console.log(apis);
    setVisibleApis(apis);
    setAvailableLanguages(languages);
  }, [cardResults]);

  useEffect(() => {
    const initialCategoryStates = {};
    const categories = [...new Set(Object.values(apiConfigs).map(config => config.category))];
    categories.forEach(category => {
      initialCategoryStates[category] = false;
    });
    setCategoryStates(initialCategoryStates);
  }, [apiConfigs]);

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

  const handleSaveCustomCard = async (cardName, imageUrl, file) => {
    console.log(cardName);
    console.log(imageUrl);
    console.log(file);
    let finalImageUrl;
    if (imageUrl) {
      finalImageUrl = imageUrl;
    }

    if (file) {
      finalImageUrl = '/api/files/download/' + file;
    }

    setCardResults(prev => ({
      ...prev,
      [cardName]: {
        count: 1,
        results: [{
          imageUrl: finalImageUrl,
          apiName: 'custom',
          languageCode: NO_LANGUAGE
        }]
      }
    }));

    setSelectedCards(prev => ({
      ...prev,
      [cardName]: [{
        imageUrl: finalImageUrl,
        apiName: 'custom',
        languageCode: NO_LANGUAGE
      }]
    }));

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
    return (visibleLanguages.has(card.languageCode || NO_LANGUAGE) &&
      visibleApis.has(card.apiName) || card.apiName == 'custom');
  }, [visibleLanguages, visibleApis]);

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
        const match = line.match(/^(\d+)\s+(.+?)(?:\s+\([^)]+\)\s*\d*)?$/);
        if (match) {
          return { count: parseInt(match[1], 10), name: match[2].trim() };
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
              if (CacheService.hasSearchResult(apiKey, entry.name)) {
                result = CacheService.getSearchResult(apiKey, entry.name);
                addToLog(`Cached ${result.results.length} ${entry.name}`, apiKey);
              } else {
                result = await api({ cardname: entry.name });
                CacheService.setSearchResult(apiKey, entry.name, result);
                addToLog(`Found ${result.results.length} ${entry.name}`, apiKey, result.rawResponse);
              }
              groupResults[apiKey][entry.name] = result.results;
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
        results: enabledApiKeys.flatMap(apiKey => apiResults[apiKey][entry.name] || [])
      };
    });

    setCardResults(results);
    setIsLoading(false);

    // Set initial selected cards based on cache or select first image
    const initialSelectedCards = {};
    Object.entries(results).forEach(([cardName, cardData]) => {
      initialSelectedCards[cardName] = Array(cardData.count).fill().map((_, index) => {
        if (CacheService.hasSelectedImage(cardName, index + 1)) {
          const cachedImageUrl = CacheService.getSelectedImage(cardName, index + 1);
          return cardData.results.find(card => card.imageUrl === cachedImageUrl) || cardData.results[0] || null;
        }
        return cardData.results[0] || null;  // Select first image if no cache or cache not found
      });
    });
    setSelectedCards(initialSelectedCards);
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

        CacheService.setSelectedImage(currentCardName, currentCardIndex + 1, selectedImage.imageUrl);
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
      console.log(newSelectedCards);
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

  const createPDF = async () => {
    setPdfProgressDialogOpen(true);
    setPdfProgress(0);
    setPdfProgressMessage('Initializing PDF generation...');

    const createPdfDto = {
      imageUrls: Object.entries(selectedCards).flatMap(([cardName, cardSelections]) => {
        if (uniquePrints) {
          // Wenn uniquePrints true ist, nehmen wir einfach alle URLs wie sie sind
          return cardSelections.map(selectedCard => selectedCard?.imageUrl).filter(url => url);
        } else {
          // Wenn uniquePrints false ist, nehmen wir nur die erste URL und duplizieren sie entsprechend dem count
          const firstValidUrl = cardSelections.find(selectedCard => selectedCard?.imageUrl)?.imageUrl;
          if (!firstValidUrl) return [];
          const count = cardResults[cardName]?.count || 1;
          return Array(count).fill(firstValidUrl);
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
      const eventSource = new EventSource(`/api/progress/${progressId}`);

      eventSource.onmessage = (event) => {
        const message = event.data;
        console.log('Progress:', message);

        if (message.includes('Downloaded file')) {
          const [current, total] = message.match(/\d+/g);
          const downloadProgress = (parseInt(current) / parseInt(total)) * 70;
          setPdfProgress(Math.round(downloadProgress));
          setPdfProgressMessage(message);
        } else if (message === 'Starting PDF compilation') {
          setPdfProgress(70);
          setPdfProgressMessage('Compiling PDF...');
        } else if (message === 'PDF compilation completed') {
          setPdfProgress(100);
          setPdfProgressMessage('PDF generation completed');
          eventSource.close();
          downloadPDF(progressId);
        }
      };

      eventSource.onerror = (error) => {
        console.error('SSE Error:', error);
        eventSource.close();
        setPdfProgressDialogOpen(false);
        alert('Error during PDF generation. Please try again.');
      };

    } catch (error) {
      console.error('Error creating PDF:', error);
      setPdfProgressDialogOpen(false);
      alert('Failed to create PDF. Please try again.');
    }
  };

  const downloadPDF = async (progressId) => {
    try {
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
      <label htmlFor={id} className={`ml-2 text-sm font-medium ${labelClass? labelClass : ''}`}>{label}</label>
    </div>
  );


  const handleImageLoad = (cardName, index, imageInfo) => {
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
          <span class="external-link" onClick={(e) => handleWebsiteClick(config.officialWebsite, e)}>
            <ExitToAppIcon />
          </span>
        )}
      </div>
    );
  };

  const handleUniquePrintsChanged = (event) => {
    setUniquePrints(event.target.checked);
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
          if (CacheService.hasSearchResult(apiKey, cardEntry.name)) {
            const result = CacheService.getSearchResult(apiKey, cardEntry.name);
            addToLog(`Cached ${result.results.length} ${cardEntry.name}`, apiKey);
            groupResults[apiKey][cardEntry.name] = result.results;
          } else {
            const result = await api({ cardname: cardEntry.name });
            CacheService.setSearchResult(apiKey, cardEntry.name, result);
            addToLog(`Found ${result.results.length} ${cardEntry.name}`, apiKey, result.rawResponse);
            groupResults[apiKey][cardEntry.name] = result.results;
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

    // Combine results for the single card
    const results = {
      [cardEntry.name]: {
        count: cardEntry.count,
        results: enabledApiKeys.flatMap(apiKey => apiResults[apiKey][cardEntry.name] || [])
      }
    };

    setCardResults(prevResults => ({
      ...prevResults,
      ...results
    }));

    // Set initial selected cards based on cache or select first image
    const initialSelectedCards = {};
    Object.entries(results).forEach(([cardName, cardData]) => {
      initialSelectedCards[cardName] = Array(cardData.count).fill().map((_, index) => {
        if (CacheService.hasSelectedImage(cardName, index + 1)) {
          const cachedImageUrl = CacheService.getSelectedImage(cardName, index + 1);
          return cardData.results.find(card => card.imageUrl === cachedImageUrl) || cardData.results[0] || null;
        }
        return cardData.results[0] || null;  // Select first image if no cache or cache not found
      });
    });

    setSelectedCards(prevSelected => ({
      ...prevSelected,
      ...initialSelectedCards
    }));

    setIsLoading(false);
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

  return (
    <div className="deck-input-and-viewer">
      <TitleDiv />


      <div className="input-controls">
        <div className="api-controls">
          <div className="api-controls">
            <h3 className='title is-5'>API Controls</h3>
            <button className="button" onClick={handleOpenApiConfigDialog}><SettingsIcon />Manage Apis</button>

          </div>

          <div className="api-toggles checkbox-group">
            <h3 className="text-lg font-semibold mb-4 title is-4">API Selection</h3>
            {Object.entries(categoryStates).map(([category, _]) => (
              <div key={category} className="mb-4">
                {renderCheckbox(
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
              value={decklist}
              onChange={(e) => setDecklist(e.target.value)}
              placeholder="1 Forest"
              rows={10}
              cols={50}
            />
            <br />
            <button className="button mt-2 mb-2" type="submit" disabled={isLoading}><SearchIcon />Analyze Deck</button>
          </form>

        </div>
        {isLoading && (
          <div className="progress-bar">
            <div className="progress" style={{ width: `${progress}%` }}></div>
            <span>{progress}%</span>
          </div>
        )}
        <div className="log">
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
        </div>
      </div>

      <div className="decklist-viewer">

        <div className="deck-viewer">
          <div className="deck-viewer-content">
            <div className="card-grid">
              <h2 className='title is-4'>Deck Viewer </h2>

              <div className="card-tiles">
                {Object.entries(cardResults).map(([cardName, cardData]) => {
                  const visibleResults = cardData.results.filter(filterCard);
                  const noMatchingCard = visibleResults.length === 0;

                  // Bestimme die Anzahl der anzuzeigenden Tiles
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
                        <div className="card-image-container" onClick={() => selectedCard?.apiName !== 'custom' && handleCardClick(cardName, index)}>
                          {selectedCard ? (
                            <CardImage
                              src={selectedCard.imageUrl}
                              alt={cardName}
                              onLoad={(imageInfo) => handleImageLoad(cardName, index, imageInfo)}
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
                <div className='card-tile'>
                  <div className="add-custom-card" onClick={handleAddCustomCard}>
                    <AddCardButton />
                  </div>
                  <div className="card-name">
                    <p>Add Image</p>
                  </div>
                  <div className="card-name">
                    <p>by search, url or upload</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="view-selection">
        <div className="filter-controls">
          <h2 className='title is-4'>View Selection</h2>
          <div className="language-filter checkbox-group">
            {renderCheckbox('uniquePrints', 'Unique Prints', uniquePrints, (event) => handleUniquePrintsChanged(event))}
          </div>
          <div className="language-filter checkbox-group">
            <h3 className='title is-5'>Language Filter</h3>
            {Array.from(availableLanguages).map(lang => (
              <label key={lang}>
                <input
                  type="checkbox"
                  checked={visibleLanguages.has(lang)}
                  onChange={() => toggleLanguage(lang)}
                />
                {lang === NO_LANGUAGE ? 'No Language' : lang}
                {/* <img src="%PUBLIC_URL%/flags/phyrex.png"></img> */}
              </label>
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
        <button className="button" onClick={handleOpenSettingsDialog}><PictureAsPdfOutlinedIcon />Settings</button>
        <button className="button" disabled={Object.keys(cardResults).length === 0} onClick={() => createPDF().catch(console.error)}><LocalPrintshopOutlinedIcon />Create PDF</button>
      </div>

      <div className="bottom">
        <div><PayPalDonateButton /></div>
        <div><GitHubButton /></div>
        <div><VersionInfo /></div>
      </div>


      <SettingsDialog
        open={settingsDialogOpen}
        onClose={handleCloseSettingsDialog}
        settings={settings}
        onSettingsChange={handleSettingsChange}
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
        cardIndex={currentCardIndex}
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

      <PdfProgressDialog
        open={pdfProgressDialogOpen}
        progress={pdfProgress}
        message={pdfProgressMessage}
      />
      <CustomCardDialog
        open={customCardDialogOpen}
        onClose={handleCloseCustomCardDialog}
        onSave={handleSaveCustomCard}
        searchForApis={searchForApis}
      />

      <ApiConfigDialog
        open={apiConfigDialogOpen}
        onClose={handleCloseApiConfigDialog}
        onSave={handleSaveApiConfigs}
      ></ApiConfigDialog>

    </div>
  );
};

export default DeckInputAndViewer;
