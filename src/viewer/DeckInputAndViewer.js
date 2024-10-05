import React, { useState, useEffect, useMemo } from 'react';
import CacheService from './CacheService';
import ApiFactory from '../api/ApiFactory';
import ImageSelectDialog from './ImageSelectDialog';
import PdfProgressDialog from './PdfProgressDialog';
import { JsonView } from 'react-json-view-lite';
import '../viewer/CardGrid.css';
import { SettingsDialog, defaultSettings } from './SettingsDialog';
import { apiConfigs } from '../api/configs';
import ApiConfigWizard from '../api/ApiConfigWizard';
import CardImage from './CardImage';
import CustomCardDialog from './CustomCardDialog';

console.log('apiConfigs:', apiConfigs);

const factory = new ApiFactory(apiConfigs);
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
  const [customApiConfigs, setCustomApiConfigs] = useState([]);

  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [imageSelectDialogOpen, setImageSelectDialogOpen] = useState(false);
  const [pdfProgressDialogOpen, setPdfProgressDialogOpen] = useState(false);
  const [apiConfigWizardOpen, setApiConfigWizardOpen] = useState(false);
  const [customCardDialogOpen, setCustomCardDialogOpen] = useState(false);
  const [rawDataDialogOpen, setRawDataDialogOpen] = useState(false);

  useEffect(() => {
    const languages = new Set([NO_LANGUAGE]);
    Object.values(cardResults).forEach(cardData => {
      cardData.results.forEach(card => {
        if (card.languageCode) {
          languages.add(card.languageCode);
        }
      });
    });
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

  const handleSaveCustomCard = async (cardName, imageUrl, file) => {
    console.log(cardName);
    console.log(imageUrl);
    console.log(file);
    let finalImageUrl;
    if(imageUrl){
      finalImageUrl = imageUrl;
    }

    if(file){
      finalImageUrl = '/api/files/download/'+file;
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

  const handleOpenApiConfigWizard = () => setApiConfigWizardOpen(true);
  const handleCloseApiConfigWizard = () => setApiConfigWizardOpen(false);

  const handleSaveApiConfig = (newConfig) => {
    setCustomApiConfigs(prev => [...prev, newConfig]);
    setEnabledApis(prev => ({ ...prev, [newConfig.name]: true }));
    factory.updateConfigs([newConfig]);
  };

  const allApiConfigs = useMemo(() => {
    return [...Object.values(apiConfigs), ...customApiConfigs];
  }, [customApiConfigs]);

  useEffect(() => {
    if (typeof apiConfigs === 'object' && apiConfigs !== null) {
      const configs = Object.values(apiConfigs);
      factory.updateConfigs(configs);
    }
  }, []);


  const filterCard = useMemo(() => (card) => {
    return (visibleLanguages.has(card.languageCode || NO_LANGUAGE) &&
      visibleApis.has(card.apiName));
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

    for (const apiKey of enabledApiKeys) {
      apiResults[apiKey] = {};
      const limit = apiConfigs[apiKey]?.concurrentLimit || Infinity;
      const api = factory.createApi(apiKey);

      const tasks = cardEntries.map(entry => async () => {
        if (!apiResults[apiKey][entry.name]) {
          addToLog(`Searching for: ${entry.name}`, 'System');
          try {
            let result;
            if (CacheService.hasSearchResult(apiKey, entry.name)) {
              result = CacheService.getSearchResult(apiKey, entry.name);
              addToLog(`Retrieved cached results for ${entry.name}`, apiKey);
            } else {
              result = await api({ cardname: entry.name });
              CacheService.setSearchResult(apiKey, entry.name, result);
              addToLog(`Found ${result.results.length} results for ${entry.name}`, apiKey, result.rawResponse);
            }
            apiResults[apiKey][entry.name] = result.results;
          } catch (error) {
            addToLog(`Error searching for ${entry.name}: ${error.message}`, 'System');
            apiResults[apiKey][entry.name] = [];
          }
        }
        completedCards += entry.count;
        setProgress(Math.round((completedCards / (totalCards * enabledApiKeys.length)) * 100));
      });
      await limitConcurrency(tasks, limit);
    }

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
        const newSelectedCards = {
          ...prev,
          [currentCardName]: prev[currentCardName].map((card, index) =>
            index === currentCardIndex ? selectedImage : card
          )
        };
        // Cache the selected image
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
      if (newResults[cardName].count > 1) {
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

  const handleOpenRawDataDialog = (rawResponse) => {
    setRawDataDialog(rawResponse);
    setRawDataDialogOpen(true);
  };

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
    refreshVisibleCards();
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
    refreshVisibleCards();
  };

  const filterCardsByVisibleApis = (cards) => {
    return cards.filter(card => visibleApis.has(card.apiName));
  };

  const refreshVisibleCards = () => {
    
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
        return cardSelections.map(selectedCard => selectedCard?.imageUrl).filter(url => url);
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

  const renderCheckbox = (id, label, checked, onChange, isIndeterminate = false) => (
    <div className="flex items-center mb-2">
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
      <label htmlFor={id} className="ml-2 text-sm font-medium">{label}</label>
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

  return (
    <div className="deck-input-and-viewer">
    <div className="headline">
      <h1>Universal Proxy Print</h1>
    </div>



      <div className="api-controls">
        <div className="api-controls">
          <h3>API Controls</h3>
          <button onClick={handleOpenApiConfigWizard}>Add New API Config</button>
        </div>

        <div className="api-toggles checkbox-group">
        <h3 className="text-lg font-semibold mb-4">API Selection</h3>
      {Object.entries(categoryStates).map(([category, _]) => (
        <div key={category} className="mb-4">
          {renderCheckbox(
            category,
            category.toUpperCase(),
            getCategoryState(category) === 'checked',
            () => handleCategoryToggle(category),
            getCategoryState(category) === 'indeterminate'
          )}
          <div className="ml-6">
            {Object.values(apiConfigs)
              .filter(config => config.category === category)
              .map(config => (
                <div key={config.name} className="ml-2">
                  {renderCheckbox(
                    config.name,
                    config.name,
                    enabledApis[config.name] || false,
                    () => handleApiToggle(config.name)
                  )}
                </div>
              ))}
          </div>
        </div>
      ))}
        </div>
      </div>

      <div className="decklist-input">
        <h2>Enter Decklist</h2>
        <form onSubmit={handleSubmit}>
          <textarea
            value={decklist}
            onChange={(e) => setDecklist(e.target.value)}
            placeholder="Enter your decklist here (e.g., '1 Stonecoil Serpent')..."
            rows={10}
            cols={50}
          />
          <br />
          <button type="submit" disabled={isLoading}>Analyze Deck</button>
        </form>

      </div>

      <div className="log">
        <h2>Search Log</h2>
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

      <div className="decklist-viewer">
        {isLoading && (
        <div className="progress-bar">
          <div className="progress" style={{ width: `${progress}%` }}></div>
          <span>{progress}%</span>
        </div>
       )}
       <div className="deck-viewer">
       <div className="deck-viewer-content">
              <div className="card-grid">
                <h2>Deck Viewer</h2>
          
                <div className="card-tiles">
                {Object.entries(cardResults).map(([cardName, cardData]) => {
                  const visibleResults = cardData.results.filter(filterCard);
                  const noMatchingCard = visibleResults.length === 0;

                  return Array(cardData.count).fill().map((_, index) => {
                    let selectedCard = selectedCards[cardName]?.[index];
                    if (visibleResults.length > 0 && visibleResults.indexOf(selectedCard) === -1) {
                      selectedCard = visibleResults[0];
                    }
                    return (
                      <div
                        key={`${cardName}-${index}`}
                        className={`card-tile ${noMatchingCard ? 'no-matching-card' : ''} ${selectedCard?.apiName === 'custom' ? 'custom-card' : ''}`}
                      >
                        <div onClick={() => selectedCard?.apiName !== 'custom' && handleCardClick(cardName, index)}>
                          {selectedCard ? (
                            <CardImage
                              src={selectedCard.imageUrl}
                              alt={cardName}
                              onLoad={(imageInfo) => handleImageLoad(cardName, index, imageInfo)}
                            />
                          ) : (
                            <div className="no-image">No image available</div>
                          )}
                        </div>
                        <div className="card-name">
                          <span
                            className="remove-card"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveCard(cardName, index);
                            }}
                          >
                            ✕
                          </span>
                          <p>{cardName}</p>
                        </div>
                      </div>
                    );
                  });
                })}
                
                <div className="add-custom-card" onClick={handleAddCustomCard}>
                  <img src='/green-add-button.png' />
                </div>
                </div>
        </div>
        </div>
      </div>
      </div>

      <div className="view-selection">
        <div className="filter-controls">
          <h2>View Selection</h2>
          <div className="language-filter checkbox-group">
            <h3>Language Filter</h3>
            {Array.from(availableLanguages).map(lang => (
              <label key={lang}>
                <input
                  type="checkbox"
                  checked={visibleLanguages.has(lang)}
                  onChange={() => toggleLanguage(lang)}
                />
                {lang === NO_LANGUAGE ? 'No Language' : lang}
              </label>
            ))}
          </div>
          <div className="api-filter checkbox-group">
            <h3>API Filter</h3>
            {Object.values(apiConfigs).map(config => (
              <label key={config.name}>
                <input
                  type="checkbox"
                  checked={visibleApis.has(config.name)}
                  onChange={() => toggleApi(config.name)}
                />
                {config.name}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="pdf-controls">
        <h3>PDF Generation</h3>
        <button onClick={handleOpenSettingsDialog}>Open PDF Settings</button>
        <button onClick={() => createPDF().catch(console.error)}>Create PDF of Visible Cards</button>
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
            <h3>Raw API Response</h3>
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

      {apiConfigWizardOpen && (
        <div className="dialog-overlay">
          <div className="dialog-content">
            <ApiConfigWizard
              onClose={handleCloseApiConfigWizard}
              onSave={handleSaveApiConfig}
            />
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
      />
    </div>
  );
};

export default DeckInputAndViewer;
