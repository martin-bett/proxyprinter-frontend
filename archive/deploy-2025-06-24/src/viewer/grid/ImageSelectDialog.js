import React, { useState, useEffect, useMemo } from 'react';

import './ImageSelectDialog.css';
import CardImage from './CardImage';

import CropImageOverlay from '../../container/CropImageOverlay';
import { imageLoaderService } from "../../service/cache/ImageLoaderService.js";

const NO_LANGUAGE = 'No Language';

const ImageSelectDialog = ({
  open,
  onClose,
  groupedResults,
  initialSelectedImage,
  onImageLoadError,
  initialVisibleLanguages,
  initialVisibleApis,
  cardName,
  cardIndex,
  onCropSettingsChange,
  forceCropMode = false
}) => {
  const [selectedImage, setSelectedImage] = useState(initialSelectedImage);

  const [dialogVisibleLanguages, setDialogVisibleLanguages] = useState(initialVisibleLanguages);
  const [dialogVisibleApis, setDialogVisibleApis] = useState(initialVisibleApis);
  const [cropMode, setCropMode] = useState(forceCropMode);
  // const imageLoaderCacheSize = useImageLoaderCacheSize();

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

  const handleImageLoad = (result, imageInfo) => {
    Object.assign(result, { imageInfo: imageInfo });
  };

  useEffect(() => {
    if (initialSelectedImage) {
      setSelectedImage(initialSelectedImage);
    }
  }, [initialSelectedImage]);

  useEffect(() => {
    if (forceCropMode) setCropMode(true);
  }, [forceCropMode]);

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

  useEffect(() => {
  updateLoaderService();
}, [dialogVisibleLanguages, dialogVisibleApis]);

  const updateLoaderService = () => {
    const activeLanguages = new Set(dialogVisibleLanguages);
    const activeApis = new Set(dialogVisibleApis);
    console.log('Updating ImageLoaderService with active languages:', activeLanguages, 'and APIs:', activeApis);
    imageLoaderService.stopForFilters(activeLanguages, activeApis);
  };

  const handleImageLoadError = (card) => {
    onImageLoadError(card);
  };

  const handleImageSelect = (image) => {
    setSelectedImage(image);
  };

  // CropSettings-Änderung: Image-Objekt mutieren und Re-Render triggern
  const handleCropSettings = (image, newCropSettings) => {
    image.cropSettings = { ...newCropSettings };
    setSelectedImage({ ...image });
    if (onCropSettingsChange && cardName != null && cardIndex != null) {
      onCropSettingsChange(cardName, cardIndex, { ...image });
    }
  };

  const handleClose = () => {
    imageLoaderService.stopByCategory('selectgrid');
    onClose(selectedImage);
  };

  if (!open) return null;

  // Prüfe, ob groupedResults leer ist
  const isEmpty = !groupedResults || Object.keys(groupedResults).length === 0;

  return (
    <div className="image-select-dialog">
      <div className="dialog-overlay" onClick={handleClose}>
        <div className="dialog-content" onClick={e => e.stopPropagation()}>
          <div className="image-selection-container">
            <CropImageOverlay
              selectedImage={selectedImage || initialSelectedImage}
              handleCropSettings={handleCropSettings}
              fixedHeight={704}
              cropMode={cropMode}
              setCropMode={setCropMode}
            />
          </div>
          {!isEmpty && (
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
                            <CardImage
                              cardInput={result}
                              onLoad={(imageInfo) => handleImageLoad(result, imageInfo)}
                              onError={handleImageLoadError}
                              showImageSettings={true}
                              onlyDimensions={true}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
          {!isEmpty && (
            <div className="filter-controls">
              <div className="language-filter checkbox-group">
                <h3 className="title is-4">Filter by Language</h3>
                {Array.from(availableLanguages).map(lang => (
  <div key={lang} className="filter-checkbox-row">
    <input
      type="checkbox"
      checked={dialogVisibleLanguages.has(lang)}
      onChange={() => toggleLanguage(lang)}
    />
    <label style={{ marginLeft: 8 }}>
      {lang === NO_LANGUAGE ? 'No Language' : lang}
    </label>
  </div>
))}
              </div>
              <div className="api-filter checkbox-group">
                <h3 className="title is-4">Filter by API</h3>
                {Object.keys(groupedResults).map(apiName => (
                  <div key={apiName} style={{ marginBottom: 4 }}>
                    <input
                      type="checkbox"
                      checked={dialogVisibleApis.has(apiName)}
                      onChange={() => toggleApi(apiName)}
                    />
                    <label style={{ marginLeft: 8 }}>
                      {apiName}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageSelectDialog;
