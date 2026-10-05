import React, { useState, useEffect, useMemo } from 'react';

import './ImageSelectDialog.css';
import CardImage, { CardImageError } from './CardImage';

import CropImageOverlay from '../../container/CropImageOverlay';
import ChoiceButton from '../../container/inputs/ChoiceButton';
import { ONLY_THIS_HINT } from '../../container/inputs/useLongPress';
import LanguageFlag from '../../container/LanguageFlag';
import SortableList, { PriorityRank } from '../../container/inputs/SortableList';
import { applyOrder, priorityRank, sortByPriority } from '../filterPriority';
import { imageLoaderService } from "../../service/cache/ImageLoaderService";
import { CardResult, GroupedResults } from '../../api/types/types';

const NO_LANGUAGE = 'No Language';

// Druckschärfe-Filter. Noch nicht gemessene Bilder (nicht geladen) und "kein Text erkannt"
// laufen unter "unrated", damit sie standardmäßig sichtbar bleiben und überhaupt gemessen werden.
type QualityFilter = 'good' | 'ok' | 'poor' | 'unrated';
const QUALITY_FILTERS: { key: QualityFilter; label: string }[] = [
  { key: 'good', label: 'Gut lesbar' },
  { key: 'ok', label: 'Etwas weich' },
  { key: 'poor', label: 'Schlecht lesbar' },
  { key: 'unrated', label: 'Nicht bewertet' },
];

const qualityFilterOf = (result: CardResult): QualityFilter => {
  const rating = result.imageInfo?.quality?.rating;
  return rating === 'good' || rating === 'ok' || rating === 'poor' ? rating : 'unrated';
};

const FilterCount: React.FC<{ count: number }> = ({ count }) => (
  <span className={`filter-count ${count === 0 ? 'is-empty' : ''}`} title={`${count} Bilder`}>{count}</span>
);

const languageOf = (result: CardResult) => result.languageCode || NO_LANGUAGE;

interface ImageSelectDialogProps {
  open: boolean;
  /** Bekommt das gewählte Bild nur, wenn im Dialog eins angeklickt wurde, sonst null */
  onClose: (selectedImage: CardResult | null) => void;
  groupedResults: GroupedResults;
  initialSelectedImage: CardResult | null | undefined;
  onImageLoadError: (card: CardImageError) => void;
  initialVisibleLanguages: Set<string>;
  initialVisibleApis: Set<string>;
  /** Seitenverhältnis einer Karte (Breite / Höhe) aus den PDF-Einstellungen. */
  cardAspect?: number;
  /** Filter-Priorität der Hauptseite (oben gewinnt), im Dialog sortierbar */
  languageOrder?: string[];
  apiOrder?: string[];
  onReorderLanguages?: (order: string[]) => void;
  onReorderApis?: (order: string[]) => void;
}

const noReorder = () => undefined;

const ImageSelectDialog: React.FC<ImageSelectDialogProps> = ({
  open,
  onClose,
  groupedResults,
  initialSelectedImage,
  onImageLoadError,
  initialVisibleLanguages,
  initialVisibleApis,
  cardAspect,
  languageOrder = [],
  apiOrder = [],
  onReorderLanguages = noReorder,
  onReorderApis = noReorder }) => {
  const [selectedImage, setSelectedImage] = useState<CardResult | null>(initialSelectedImage || null);
  // Nur ein Klick auf ein Bild ist eine manuelle Wahl, bloßes Öffnen und Schließen nicht
  const [picked, setPicked] = useState(false);

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
  const orderedLanguages = applyOrder(languageOrder, availableLanguages);
  const orderedApis = applyOrder(apiOrder, Object.keys(groupedResults));

  // Zähler je Filterwert: wie viele Bilder zu sehen wären, wenn der Wert an ist.
  // Die jeweils anderen Filtergruppen gelten mit, die eigene Gruppe nicht.
  // Ohne useMemo, weil die Schärfe-Bewertung erst nach dem Laden in die Ergebnisse geschrieben wird.
  const languageCounts = new Map<string, number>();
  const apiCounts = new Map<string, number>();
  const qualityCounts = new Map<QualityFilter, number>();
  const increment = <K,>(counts: Map<K, number>, key: K) => counts.set(key, (counts.get(key) ?? 0) + 1);
  Object.entries(groupedResults).forEach(([apiName, results]) => {
    const apiVisible = dialogVisibleApis.has(apiName);
    results.forEach(result => {
      const language = result.languageCode || NO_LANGUAGE;
      const quality = qualityFilterOf(result);
      const languageVisible = dialogVisibleLanguages.has(language);
      const qualityVisible = visibleQualities.has(quality);
      if (apiVisible && qualityVisible) increment(languageCounts, language);
      if (languageVisible && qualityVisible) increment(apiCounts, apiName);
      if (apiVisible && languageVisible) increment(qualityCounts, quality);
    });
  });

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
      setPicked(false);
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
    setPicked(true);
  };

  const handleClose = () => {
    imageLoaderService.stopByCategory('selectgrid');
    onClose(picked ? selectedImage : null);
  };

  if (!open) return null;

  return (
    <div className="image-select-dialog">
      <div className="dialog-overlay" onClick={handleClose}>
        <div className="dialog-content" onClick={e => e.stopPropagation()}>
          <div className="image-selection-container">
            <CropImageOverlay
              selectedImage={selectedImage}
              cardAspect={cardAspect}
            />
          </div>
          <div className="image-grid-container">
            {orderedApis
              .filter(apiName => dialogVisibleApis.has(apiName))
              .map(apiName => {
                // Innerhalb einer API nach Sprach-Priorität, sonst in der Reihenfolge der Suche
                const visibleResults = sortByPriority(groupedResults[apiName].filter(result =>
                  dialogVisibleLanguages.has(languageOf(result)) &&
                  visibleQualities.has(qualityFilterOf(result))
                ), languageOrder, [], languageOf);
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
              <SortableList
                items={orderedLanguages}
                onReorder={onReorderLanguages}
                renderItem={(lang, handle) => (
                  <ChoiceButton
                    id={`select-lang-${lang}`}
                    label={
                      <div className="label-container">
                        <span>{lang === NO_LANGUAGE ? 'No Language' : lang}</span>
                        <FilterCount count={languageCounts.get(lang) ?? 0} />
                        <LanguageFlag language={lang} />
                      </div>
                    }
                    checked={dialogVisibleLanguages.has(lang)}
                    onChange={() => toggleLanguage(lang)}
                    onLongPress={() => setDialogVisibleLanguages(new Set([lang]))}
                    longPressHint={ONLY_THIS_HINT}
                    trailing={handle}
                    badge={<PriorityRank rank={priorityRank(orderedLanguages, dialogVisibleLanguages, lang)} />}
                  />
                )}
              />
            </div>
            <div className="language-filter input-tile-group">
              <h3 className="title is-4">Filter by API</h3>
              <SortableList
                items={orderedApis}
                onReorder={onReorderApis}
                renderItem={(apiName, handle) => (
                  <ChoiceButton
                    id={`select-api-${apiName}`}
                    label={
                      <div className="label-container">
                        <span>{apiName}</span>
                        <FilterCount count={apiCounts.get(apiName) ?? 0} />
                      </div>
                    }
                    checked={dialogVisibleApis.has(apiName)}
                    onChange={() => toggleApi(apiName)}
                    onLongPress={() => setDialogVisibleApis(new Set([apiName]))}
                    longPressHint={ONLY_THIS_HINT}
                    trailing={handle}
                    badge={<PriorityRank rank={priorityRank(orderedApis, dialogVisibleApis, apiName)} />}
                  />
                )}
              />
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
                      <FilterCount count={qualityCounts.get(key) ?? 0} />
                      <span className={`quality-dot-inline quality-${key === 'unrated' ? 'unknown' : key}`} />
                    </div>
                  }
                  checked={visibleQualities.has(key)}
                  onChange={() => toggleQuality(key)}
                  onLongPress={() => setVisibleQualities(new Set([key]))}
                  longPressHint={ONLY_THIS_HINT}
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
