import React, { useState, useEffect, useMemo } from 'react';

import './ImageSelectDialog.css';
import CardImage, { CardImageError } from './CardImage';

import CropImageOverlay from '../../container/CropImageOverlay';
import ChoiceButton from '../../container/inputs/ChoiceButton';
import LanguageFlag from '../../container/LanguageFlag';
import { imageLoaderService } from "../../service/cache/ImageLoaderService";
import { CardResult, GroupedResults } from '../../api/types/types';

const NO_LANGUAGE = 'No Language';

// Druckschärfe-Filter. "unrated" = gemessen, aber kein Text erkannt.
// Noch nicht gemessene Bilder ("pending") fallen nie raus, sonst würden sie nie geladen und gemessen.
type QualityFilter = 'good' | 'ok' | 'poor' | 'unrated';
const QUALITY_FILTERS: { key: QualityFilter; label: string }[] = [
  { key: 'good', label: 'Gut lesbar' },
  { key: 'ok', label: 'Etwas weich' },
  { key: 'poor', label: 'Schlecht lesbar' },
  { key: 'unrated', label: 'Nicht bewertet' },
];

const qualityFilterOf = (result: CardResult): QualityFilter | 'pending' => {
  const rating = result.imageInfo?.quality?.rating;
  if (!rating) return 'pending';
  return rating === 'good' || rating === 'ok' || rating === 'poor' ? rating : 'unrated';
};

const passesQualityFilter = (result: CardResult, visible: Set<QualityFilter>): boolean => {
  const filter = qualityFilterOf(result);
  return filter === 'pending' || visible.has(filter);
};

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
  const [visibleQualities, setVisibleQualities] = useState<Set<QualityFilter>>(
    () => new Set(QUALITY_FILTERS.map(f => f.key))
  );
  // Schärfe kommt asynchron nach dem Laden; neu filtern, sobald sich eine Bewertung ändert
  const [, setQualityVersion] = useState(0);
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
    const before = qualityFilterOf(result);
    Object.assign(result, { imageInfo: imageInfo });
    if (qualityFilterOf(result) !== before) setQualityVersion(v => v + 1);
  };

  const toggleQuality = (key: QualityFilter) => {
    setVisibleQualities(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
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
                  dialogVisibleLanguages.has(result.languageCode || NO_LANGUAGE) &&
                  passesQualityFilter(result, visibleQualities)
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
                  label={
                    <div className="label-container">
                      <span>{lang === NO_LANGUAGE ? 'No Language' : lang}</span>
                      <LanguageFlag language={lang} />
                    </div>
                  }
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
            <div className="language-filter input-tile-group">
              <h3 className="title is-4">Filter by Sharpness</h3>
              {QUALITY_FILTERS.map(({ key, label }) => (
                <ChoiceButton
                  key={key}
                  id={`select-quality-${key}`}
                  label={
                    <div className="label-container">
                      <span>{label}</span>
                      <span className={`quality-dot-inline quality-${key === 'unrated' ? 'unknown' : key}`} />
                    </div>
                  }
                  checked={visibleQualities.has(key)}
                  onChange={() => toggleQuality(key)}
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
