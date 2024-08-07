import React, { useState, useEffect, useMemo, useCallback } from 'react';
import './ImageSelectDialog.css';

const NO_LANGUAGE = 'No Language';

const ImageSelectDialog = ({ open, onClose, groupedResults, initialSelectedImage , 
  initialVisibleLanguages, 
  initialVisibleApis }) => {
  const [selectedImage, setSelectedImage] = useState(initialSelectedImage);
  const [dialogVisibleLanguages, setDialogVisibleLanguages] = useState(initialVisibleLanguages);
  const [dialogVisibleApis, setDialogVisibleApis] = useState(initialVisibleApis);

  const availableLanguages = useMemo(() => {
    const languages = new Set([NO_LANGUAGE]);
    Object.values(groupedResults).forEach(results => {
      results.forEach(result => {
        if (result.languageCode) {
          languages.add(result.languageCode);
        }
      });
    });
    return languages;
  }, [groupedResults]);

  const visibleResults = useMemo(() => {
    return Object.entries(groupedResults)
      .filter(([apiName]) => dialogVisibleApis.has(apiName))
      .flatMap(([_, results]) =>
        results.filter(result =>
          dialogVisibleLanguages.has(result.languageCode || NO_LANGUAGE)
        )
      );
  }, [groupedResults, dialogVisibleApis, dialogVisibleLanguages]);

  // const initializeFilters = useCallback(() => {
  //   setDialogVisibleLanguages(new Set(availableLanguages));
  //   setDialogVisibleApis(new Set(Object.keys(groupedResults)));
  // }, [availableLanguages, groupedResults]);

  // useEffect(() => {
  //   initializeFilters();
  // }, [initializeFilters]);

  useEffect(() => {
    if (initialSelectedImage) {
      setSelectedImage(initialSelectedImage);
    }
  }, [initialSelectedImage]);

  useEffect(() => {
    if (visibleResults.length > 0 && (!selectedImage || !visibleResults.some(result => result.imageUrl === selectedImage.imageUrl))) {
      setSelectedImage(visibleResults[0]);
    }
  }, [visibleResults, selectedImage]);

  if (!open) return null;

  const toggleLanguage = (languageCode) => {
    setDialogVisibleLanguages(prev => {
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
    setDialogVisibleApis(prev => {
      const newSet = new Set(prev);
      if (newSet.has(apiName)) {
        newSet.delete(apiName);
      } else {
        newSet.add(apiName);
      }
      return newSet;
    });
  };

  const handleImageSelect = (image) => {
    setSelectedImage(image);
  };

  const handleClose = () => {
    onClose(selectedImage);
  };

  return (
    <div className="image-select-dialog">
      <div className="dialog-overlay" onClick={handleClose}>
        <div className="dialog-content" onClick={e => e.stopPropagation()}>
          <h2>Select Image</h2>
          <div className="image-selection-container">
            <div className="selected-image-container">
              {selectedImage && (
                <img src={selectedImage.imageUrl} alt={selectedImage.name} />
              )}
            </div>
            <div className="image-grid-container">
              {Object.entries(groupedResults)
                .filter(([apiName]) => dialogVisibleApis.has(apiName))
                .map(([apiName, results]) => {
                  const visibleResults = results.filter(result =>
                    dialogVisibleLanguages.has(result.languageCode || NO_LANGUAGE)
                  );
                  return (
                    <div key={apiName} className={visibleResults.length === 0 ? 'no-matching-card' : ''}>
                      <h3>{apiName}</h3>
                      <div className="image-grid">
                        {visibleResults.map((result, index) => (
                          <div
                            key={index}
                            className={`image-option ${result === selectedImage ? 'selected' : ''}`}
                            onClick={() => handleImageSelect(result)}
                          >
                            <div className="image-container">
                              <img src={result.imageUrl} alt={result.name} />
                              <span className="image-symbol">
                                {result.languageCode || apiName.toUpperCase()}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
            </div>
            <div className="filter-controls">
              <div className="language-filter">
                <h3>Filter by Language</h3>
                {Array.from(availableLanguages).map(lang => (
                  <label key={lang}>
                    <input
                      type="checkbox"
                      checked={dialogVisibleLanguages.has(lang)}
                      onChange={() => toggleLanguage(lang)}
                    />
                    {lang === NO_LANGUAGE ? 'No Language' : lang}
                  </label>
                ))}
              </div>
              <div className="language-filter">
                <h3>Filter by API</h3>
                {Object.keys(groupedResults).map(apiName => (
                  <label key={apiName}>
                    <input
                      type="checkbox"
                      checked={dialogVisibleApis.has(apiName)}
                      onChange={() => toggleApi(apiName)}
                    />
                    {apiName}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="dialog-buttons">
            <button onClick={handleClose}>Confirm Selection</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageSelectDialog;