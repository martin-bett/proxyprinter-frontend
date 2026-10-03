import React, { useState, useEffect, useMemo } from 'react';

import './ImageSelectDialog.css';
import CardImage, { CardImageError } from './CardImage';

import CropImageOverlay from '../../container/CropImageOverlay';
import ChoiceButton from '../../container/inputs/ChoiceButton';
import { imageLoaderService } from "../../service/cache/ImageLoaderService";
import { CardResult, GroupedResults } from '../../api/types/types';

const NO_LANGUAGE = 'No Language';

interface ImageSelectDialogProps {
  open: boolean;
  onClose: (selectedImage: CardResult | null) => void;
  groupedResults: GroupedResults;
  initialSelectedImage: CardResult | null | undefined;
  onImageLoadError: (card: CardImageError) => void;
  initialVisibleLanguages: Set<string>;
  initialVisibleApis: Set<string>;
}

const ImageSelectDialog: React.FC<ImageSelectDialogProps> = ({
  open,
  onClose,
  groupedResults,
  initialSelectedImage,
  onImageLoadError,
  initialVisibleLanguages,
  initialVisibleApis }) => {
  const [selectedImage, setSelectedImage] = useState<CardResult | null>(initialSelectedImage || null);

  const [dialogVisibleLanguages, setDialogVisibleLanguages] = useState(initialVisibleLanguages);
  const [dialogVisibleApis, setDialogVisibleApis] = useState(initialVisibleApis);
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

  const handleImageLoad = (result: CardResult, imageInfo: CardResult['imageInfo']) => {
    Object.assign(result, { imageInfo: imageInfo });
  };

  // Take over the filters from the main page each time the dialog opens
  useEffect(() => {
    if (open) {
      setDialogVisibleLanguages(new Set(initialVisibleLanguages));
      setDialogVisibleApis(new Set(initialVisibleApis));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (initialSelectedImage) {
      setSelectedImage(initialSelectedImage);
    }
  }, [initialSelectedImage]);

  const toggleLanguage = (languageCode: string) => {
    setDialogVisibleLanguages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(languageCode)) {
        newSet.delete(languageCode);
      } else {
        newSet.add(languageCode);
      }
      return newSet;
    });
    updateLoaderService();
  };

  const toggleApi = (apiName: string) => {
    setDialogVisibleApis(prev => {
      const newSet = new Set(prev);
      if (newSet.has(apiName)) {
        newSet.delete(apiName);
      } else {
        newSet.add(apiName);
      }
      return newSet;
    });
    updateLoaderService();
  };

  const updateLoaderService = () => {
    const activeLanguages = new Set(dialogVisibleLanguages);
    const activeApis = new Set(dialogVisibleApis);

    imageLoaderService.stopForFilters(activeLanguages, activeApis);
  };

  const handleImageLoadError = (card: CardImageError) => {
    onImageLoadError(card);
  };

  const handleImageSelect = (image: CardResult) => {
    setSelectedImage(image);
  };

  const handleClose = () => {
    imageLoaderService.stopByCategory('selectgrid');
    onClose(selectedImage);
  };

  if (!open) return null;

  return (
    <div className="image-select-dialog">
      <div className="dialog-overlay" onClick={handleClose}>
        <div className="dialog-content" onClick={e => e.stopPropagation()}>
          <div className="image-selection-container">
            <CropImageOverlay
              selectedImage={selectedImage}
              handleCropSettings={null}
              fixedHeight={704}
            />
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
          <div className="filter-controls">
            <div className="language-filter input-tile-group">
              <h3 className="title is-4">Filter by Language</h3>
              {Array.from(availableLanguages).map(lang => (
                <ChoiceButton
                  key={lang}
                  id={`select-lang-${lang}`}
                  label={lang === NO_LANGUAGE ? 'No Language' : lang}
                  checked={dialogVisibleLanguages.has(lang)}
                  onChange={() => toggleLanguage(lang)}
                />
              ))}
            </div>
            <div className="language-filter input-tile-group">
              <h3 className="title is-4">Filter by API</h3>
              {Object.keys(groupedResults).map(apiName => (
                <ChoiceButton
                  key={apiName}
                  id={`select-api-${apiName}`}
                  label={apiName}
                  checked={dialogVisibleApis.has(apiName)}
                  onChange={() => toggleApi(apiName)}
                />
              ))}
            </div>
            {/* <div>
              {imageLoaderCacheSize}
            </div> */}
          </div>
        </div>
      </div>
    </div >
  );
};

export default ImageSelectDialog;
