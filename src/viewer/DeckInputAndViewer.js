import React, { useState, useEffect } from 'react';
import ApiFactory from '../api/ApiFactory';
import ImageSelectDialog from './ImageSelectDialog';
import PdfProgressDialog from './PdfProgressDialog';
import { JsonView } from 'react-json-view-lite';
import './card/CardGrid.css';
import { SettingsDialog, defaultSettings } from './SettingsDialog';
import { apiConfigs } from '../api/configs';
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
  const [enabledApis, setEnabledApis] = useState(() =>
    Object.keys(apiConfigs).reduce((acc, key) => ({ ...acc, [apiConfigs[key].name]: true }), {})
  );
  const [selectedCards, setSelectedCards] = useState({});
  const [currentCardName, setCurrentCardName] = useState(null);
  const [currentCardIndex, setCurrentCardIndex] = useState(null);
  const [availableLanguages, setAvailableLanguages] = useState(new Set([NO_LANGUAGE]));
  const [visibleLanguages, setVisibleLanguages] = useState(new Set([NO_LANGUAGE]));
  const [visibleApis, setVisibleApis] = useState(new Set(Object.values(apiConfigs).map(config => config.name)));
  const [imageSelectDialogOpen, setImageSelectDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [pdfProgressDialogOpen, setPdfProgressDialogOpen] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(0);
  const [pdfProgressMessage, setPdfProgressMessage] = useState('');

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
    setVisibleLanguages(prev => new Set([...prev, ...languages]));
  }, [cardResults]);

  const addToLog = (message, configName, rawResponse) => {
    setLog((prevLog) => [...prevLog, { message, configName, rawResponse }]);
  };

  const handleSettingsChange = (newSettings) => {
    setSettings(newSettings);
  };

  const filterCard = (card) => {
    return (visibleLanguages.has(card.languageCode || NO_LANGUAGE) &&
      visibleApis.has(card.apiName));
  };

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
            const result = await api({ cardname: entry.name });
            apiResults[apiKey][entry.name] = result.results;
            addToLog(`Found ${result.results.length} results for ${entry.name}`, apiKey, result.rawResponse);
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
  };

  const handleCardClick = (cardName, index) => {
    setCurrentCardName(cardName);
    setCurrentCardIndex(index);
    setImageSelectDialogOpen(true);
  };

  const handleCloseImageSelectDialog = (selectedImage) => {
    if (selectedImage && currentCardName !== null && currentCardIndex !== null) {
      setSelectedCards(prev => ({
        ...prev,
        [currentCardName]: prev[currentCardName].map((card, index) =>
          index === currentCardIndex ? selectedImage : card
        )
      }));
    }
    setImageSelectDialogOpen(false);
    setCurrentCardName(null);
    setCurrentCardIndex(null);
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

  const filterCardsByVisibleApis = (cards) => {
    return cards.filter(card => visibleApis.has(card.apiName));
  };

  useEffect(() => {
    setSelectedCards(prev => {
      const newSelectedCards = { ...prev };
      Object.entries(cardResults).forEach(([cardName, cardData]) => {
        const visibleResults = cardData.results.filter(filterCard);

        newSelectedCards[cardName] = Array(cardData.count).fill().map((_, index) => {
          const currentSelection = prev[cardName]?.[index];
          if (visibleResults.length > 0) {
            // Wenn es sichtbare Ergebnisse gibt, wähle eines davon
            if (currentSelection && visibleResults.some(card => card.imageUrl === currentSelection.imageUrl)) {
              return currentSelection;
            } else {
              return visibleResults[0];
            }
          } else {
            // Wenn keine sichtbaren Ergebnisse, behalte die aktuelle Auswahl bei
            return currentSelection || cardData.results[0] || null;
          }
        });
      });
      return newSelectedCards;
    });
  }, [visibleLanguages, visibleApis, cardResults, filterCard]);

  const handleApiToggle = (apiKey) => {
    setEnabledApis(prev => ({ ...prev, [apiKey]: !prev[apiKey] }));
  };

  const createPDF = async () => {
    setPdfProgressDialogOpen(true);
    setPdfProgress(0);
    setPdfProgressMessage('Initializing PDF generation...');

    const createPdfDto = {
      imageUrls: Object.entries(cardResults).flatMap(([cardName, cardData]) => {
        return Array(cardData.count).fill().map((_, index) => {
          const selectedImage = selectedCards[cardName]?.[index] || cardData.results[0];
          return selectedImage?.imageUrl;
        });
      }).filter(url => url),
      settings: settings
    };

    try {
      const response = await fetch('http://localhost:8080/api/pdf', {
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
      const eventSource = new EventSource(`http://localhost:8080/api/progress/${progressId}`);

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
      const pdfResponse = await fetch(`http://localhost:8080/api/pdf/${progressId}`);
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
      <h1>MTG Deck Analyzer</h1>

      {isLoading && (
        <div className="progress-bar">
          <div className="progress" style={{ width: `${progress}%` }}></div>
          <span>{progress}%</span>
        </div>
      )}

      <div className="input-and-log-container">
        <div className="api-toggles">
          <h3>API Selection</h3>
          {Object.values(apiConfigs).map(config => (
            <div key={config.name}>
              <input
                type="checkbox"
                id={config.name}
                checked={enabledApis[config.name]}
                onChange={() => handleApiToggle(config.name)}
              />
              <label htmlFor={config.name}>{config.name}</label>
            </div>
          ))}
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
          <h3>Search Log</h3>
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
      {Object.keys(cardResults).length > 0 && (
        <div className="deck-viewer">
          <div className="deck-viewer-content">
            <div className="card-grid">
              <h2>Deck Viewer</h2>
              <div className="card-tiles">
                {Object.entries(cardResults).map(([cardName, cardData]) => {
                  const visibleResults = cardData.results.filter(filterCard);
                  const noMatchingCard = visibleResults.length === 0;

                  return Array(cardData.count).fill().map((_, index) => {
                    const selectedCard = selectedCards[cardName]?.[index];

                    return (
                      <div
                        key={`${cardName}-${index}`}
                        className={`card-tile ${noMatchingCard ? 'no-matching-card' : ''}`}
                        onClick={() => handleCardClick(cardName, index)}
                      >
                        {selectedCard ? (
                          <img src={selectedCard.imageUrl} alt={cardName} />
                        ) : (
                          <div className="no-image">No image available</div>
                        )}
                        <p>{cardName}</p>
                      </div>
                    );
                  });
                })}
              </div>

            </div>
            <div className="filter-controls">
              <div className="language-filter">
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
              <div className="api-filter">
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
              <div className="pdf-controls">
                <h3>PDF Generation</h3>
                <button onClick={handleOpenSettingsDialog}>Open PDF Settings</button>
                <button onClick={() => createPDF().catch(console.error)}>Create PDF of Visible Cards</button>
              </div>
            </div>
          </div>
        </div>
      )}


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
        groupedResults={
          currentCardName
            ? groupResultsByApi(cardResults[currentCardName]?.results || [])
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

      <PdfProgressDialog
        open={pdfProgressDialogOpen}
        progress={pdfProgress}
        message={pdfProgressMessage}
      />

    </div>
  );
};

export default DeckInputAndViewer;