import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import ReactCrop, { PercentCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Button, Checkbox, CircularProgress, FormControlLabel, TextField, ToggleButton, ToggleButtonGroup } from '@mui/material';
import CropIcon from '@mui/icons-material/Crop';
import GridOnIcon from '@mui/icons-material/GridOn';
import { CropSettings } from '../../../service/ApiFactory';
import {
  clampRect, computeGridCrops, fitAspectInside, fitDisplaySize, GridOptions, percentToPixels, pixelsToPercent, PixelRect, tileSize
} from './gridCrops';
import './CropMask.css';

interface CropMaskProps {
  /** Bildquelle für die Vorschau (URL oder Object-URL einer gewählten Datei). */
  imageSrc: string;
  /** Seitenverhältnis einer Karte (Breite / Höhe) aus den PDF-Einstellungen. */
  cardAspect: number;
  /** Ausweich-Quelle, wenn das Bild direkt nicht lädt (z. B. über den Backend-Proxy). */
  loadFallback?: () => Promise<string | null>;
  /** Bestehender Zuschnitt, mit dem der Crop-Modus startet. */
  initialCrop?: CropSettings;
  /** Ohne Cut-Modus (z. B. im Bildauswahl-Dialog, dort gibt es nur einen Zuschnitt je Karte). */
  allowCut?: boolean;
  /** side: Bild links, Einstellungen rechts. stacked: Einstellungen unter dem Bild. */
  layout?: 'side' | 'stacked';
  /** Maximale Höhe des Bildes in Pixeln. */
  maxImageHeight?: number;
  /** Wird bei jeder Änderung mit den aktuellen Zuschnitten aufgerufen. */
  onChange?: (crops: CropSettings[]) => void;
  /** Mit onConfirm zeigt die Maske die Buttons Back und Add. */
  onConfirm?: (crops: CropSettings[]) => void;
  onBack?: () => void;
  /** Beschriftung der Buttons, Standard: Back und Add card / Add N cards. */
  backLabel?: string;
  confirmLabel?: (count: number) => string;
  busy?: boolean;
  error?: string;
}

/** crop: ein Ausschnitt per Maus oder Zahlen. cut: ganzes Bild in ein Raster schneiden (Galerie in einem Bild). */
type MaskMode = 'crop' | 'cut';
type RectField = keyof PixelRect;

const THUMB_HEIGHT = 110;
/** Breite der Seitenleiste plus Abstand im side-Layout, muss zu CropMask.css passen. */
const SIDE_PANEL_SPACE = 360 + 24;
const ASPECT_TOLERANCE = 0.015;

const numberField = (value: number, min: number) => Math.max(min, parseInt(String(value), 10) || min);

const hasArea = (crop?: CropSettings) => !!crop && (crop.width || 0) > 0 && (crop.height || 0) > 0;

const CropMask: React.FC<CropMaskProps> = ({
  imageSrc, cardAspect, loadFallback, initialCrop, allowCut = true, layout = 'side', maxImageHeight,
  onChange, onConfirm, onBack, backLabel = 'Back', confirmLabel, busy, error,
}) => {
  const [src, setSrc] = useState(imageSrc);
  const [triedFallback, setTriedFallback] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const [mode, setMode] = useState<MaskMode>('crop');
  const [crop, setCrop] = useState<PercentCrop | null>(null);
  const [keepAspect, setKeepAspect] = useState(true);
  const [grid, setGrid] = useState<GridOptions>({ rows: 1, cols: 1, margin: 0, gap: 0 });
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxWidth, setBoxWidth] = useState(0);
  // Eingabefelder halten ihren Text, solange getippt wird
  const [draft, setDraft] = useState<Partial<Record<RectField, string>>>({});
  // onChange erst nach einer Änderung durch den Nutzer melden, nicht schon den Startrahmen
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    setSrc(imageSrc);
    setTriedFallback(false);
    setLoadError(false);
    setNatural(null);
    setCrop(null);
    setTouched(false);
  }, [imageSrc]);

  // Verfügbare Breite messen, damit das Bild exakt so groß angezeigt wird wie der Crop-Rahmen
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    // side: Bild und Seitenleiste stehen zusammen mittig, das Bild bekommt den Rest der Breite
    const measure = () => setBoxWidth(Math.max(120, box.clientWidth - (layout === 'side' ? SIDE_PANEL_SPACE : 0)));
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [layout]);

  const maxHeight = maxImageHeight ?? Math.round(window.innerHeight * (layout === 'side' ? 0.58 : 0.5));
  const display = natural && boxWidth > 0 ? fitDisplaySize(natural.width, natural.height, boxWidth, maxHeight) : null;

  const handleImageLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    const width = img.naturalWidth;
    const height = img.naturalHeight;
    setNatural({ width, height });
    setLoadError(false);
    // Startrahmen: bestehender Zuschnitt, sonst Kartenformat zentriert im ganzen Bild
    const full = { x: 0, y: 0, width, height };
    if (initialCrop && hasArea(initialCrop)) {
      const rect = clampRect({
        x: initialCrop.offSetX || 0, y: initialCrop.offSetY || 0,
        width: initialCrop.width || 0, height: initialCrop.height || 0,
      }, width, height);
      setKeepAspect(Math.abs(rect.width / rect.height / cardAspect - 1) < ASPECT_TOLERANCE);
      setCrop(pixelsToPercent(rect, width, height));
    } else {
      setCrop(pixelsToPercent(clampRect(fitAspectInside(full, cardAspect), width, height), width, height));
    }
  };

  const handleImageError = async () => {
    if (loadFallback && !triedFallback) {
      setTriedFallback(true);
      const fallback = await loadFallback();
      if (fallback) {
        setSrc(fallback);
        return;
      }
    }
    setLoadError(true);
  };

  const cropArea = useMemo(
    () => (natural && crop ? percentToPixels(crop, natural.width, natural.height) : null),
    [crop, natural]
  );
  const fullArea = useMemo(
    () => (natural ? { x: 0, y: 0, width: natural.width, height: natural.height } : null),
    [natural]
  );
  const crops: CropSettings[] = useMemo(() => {
    if (mode === 'cut') return fullArea ? computeGridCrops(fullArea, grid) : [];
    if (!cropArea || cropArea.width <= 0 || cropArea.height <= 0) return [];
    return [{ offSetX: cropArea.x, offSetY: cropArea.y, width: cropArea.width, height: cropArea.height, isStretch: true }];
  }, [mode, fullArea, grid, cropArea]);

  const cropsKey = JSON.stringify(crops);
  useEffect(() => {
    if (onChange && touched && crops.length > 0) onChange(crops);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cropsKey, touched]);

  const tile = mode === 'cut'
    ? (fullArea ? tileSize(fullArea, grid) : null)
    : (cropArea ? { width: cropArea.width, height: cropArea.height } : null);
  const tileAspectOff = tile && tile.width > 0 && tile.height > 0
    ? Math.abs(tile.width / tile.height / cardAspect - 1)
    : 0;

  const setCropPixels = (rect: PixelRect) => {
    if (!natural) return;
    setTouched(true);
    setCrop(pixelsToPercent(clampRect(rect, natural.width, natural.height), natural.width, natural.height));
  };

  const handleKeepAspect = (checked: boolean) => {
    setKeepAspect(checked);
    if (checked && cropArea) setCropPixels(fitAspectInside(cropArea, cardAspect));
  };

  const handleWholeImage = () => {
    if (!fullArea) return;
    setKeepAspect(false);
    setCropPixels(fullArea);
  };

  // Zahlenfelder: Position und Größe in Bildpixeln. Mit Keep aspect ratio zieht die andere Seite mit.
  const handleRectInput = (field: RectField, value: string) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
    const number = Number(value);
    if (!cropArea || !natural || value === '' || !Number.isFinite(number)) return;
    const next = { ...cropArea, [field]: Math.round(number) };
    if (keepAspect && field === 'width') next.height = next.width / cardAspect;
    if (keepAspect && field === 'height') next.width = next.height * cardAspect;
    if (field === 'width' || field === 'height') {
      // Größe geht vor Position: Rahmen nach links/oben schieben, wenn er sonst übers Bild ragt
      next.width = Math.min(Math.max(1, next.width), natural.width);
      next.height = Math.min(Math.max(1, next.height), natural.height);
      if (keepAspect) {
        const fitted = fitAspectInside({ x: next.x, y: next.y, width: next.width, height: next.height }, cardAspect);
        next.width = fitted.width;
        next.height = fitted.height;
      }
    }
    setCropPixels(next);
  };

  const updateGrid = (field: keyof GridOptions, value: string) => {
    const min = field === 'rows' || field === 'cols' ? 1 : 0;
    setTouched(true);
    setGrid((prev) => ({ ...prev, [field]: numberField(Number(value), min) }));
  };

  const imageStyle = display ? { width: display.width, height: display.height } : undefined;
  const image = (
    <img src={src} alt="Zuschnitt" style={imageStyle} />
  );

  // Cut-Vorschau: weggeschnittene Ränder abdunkeln, Kacheln nummerieren
  const cutCrops = mode === 'cut' ? crops : [];
  const renderCutPreview = () => (
    <div className="crop-mask-cut">
      {image}
      {natural && (
        <svg className="crop-mask-cut-overlay" viewBox={`0 0 ${natural.width} ${natural.height}`} preserveAspectRatio="none">
          <path
            fillRule="evenodd"
            className="crop-mask-cut-shade"
            d={`M0 0H${natural.width}V${natural.height}H0Z ` + cutCrops
              .map((c) => `M${c.offSetX} ${c.offSetY}h${c.width}v${c.height}h${-(c.width || 0)}Z`)
              .join(' ')}
          />
          {cutCrops.map((c, i) => (
            <rect key={i} className="crop-mask-cut-tile" x={c.offSetX} y={c.offSetY} width={c.width} height={c.height}
              vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
      )}
      {natural && cutCrops.map((c, i) => (
        <span
          key={i}
          className="crop-mask-cut-badge"
          style={{
            left: `${((c.offSetX || 0) / natural.width) * 100}%`,
            top: `${((c.offSetY || 0) / natural.height) * 100}%`,
          }}
        >
          {i + 1}
        </span>
      ))}
    </div>
  );

  // Kleine Kartenvorschau je Ergebnis, im Kartenformat wie im Druck
  const renderThumbs = () => {
    if (!natural || crops.length === 0) return null;
    return (
      <div className="crop-mask-thumbs">
        {crops.map((c, i) => {
          const thumbWidth = THUMB_HEIGHT * cardAspect;
          const scaleX = thumbWidth / (c.width || 1);
          const scaleY = THUMB_HEIGHT / (c.height || 1);
          return (
            <div
              key={i}
              className="crop-mask-thumb"
              title={`Karte ${i + 1}`}
              style={{
                width: thumbWidth,
                height: THUMB_HEIGHT,
                backgroundImage: `url("${src}")`,
                backgroundSize: `${natural.width * scaleX}px ${natural.height * scaleY}px`,
                backgroundPosition: `${-(c.offSetX || 0) * scaleX}px ${-(c.offSetY || 0) * scaleY}px`,
              }}
            />
          );
        })}
      </div>
    );
  };

  const rectField = (field: RectField, label: string) => (
    <TextField
      label={label}
      type="number"
      size="small"
      inputProps={{ min: field === 'width' || field === 'height' ? 1 : 0 }}
      value={draft[field] ?? (cropArea ? cropArea[field] : '')}
      onChange={(e) => handleRectInput(field, e.target.value)}
      onBlur={() => setDraft((prev) => ({ ...prev, [field]: undefined }))}
      disabled={!cropArea}
    />
  );

  return (
    <div className={`crop-mask crop-mask--${layout}`} ref={boxRef}>
      <div className="crop-mask-image">
        {!natural && !loadError && <CircularProgress size={32} />}
        {loadError && (
          <p className="help is-danger">Das Bild konnte nicht geladen werden. Bitte die URL prüfen.</p>
        )}
        {!loadError && (!natural || !crop) && (
          // Unsichtbar laden, um die natürliche Größe zu kennen
          <img src={src} alt="" style={{ display: 'none' }} onLoad={handleImageLoad} onError={handleImageError} />
        )}
        {!loadError && natural && crop && mode === 'crop' && (
          <ReactCrop
            crop={crop}
            aspect={keepAspect ? cardAspect : undefined}
            keepSelection
            minWidth={10}
            minHeight={10}
            onChange={(_, percentCrop) => { setDraft({}); setTouched(true); setCrop(percentCrop); }}
          >
            <img src={src} alt="Zuschnitt" style={imageStyle} />
          </ReactCrop>
        )}
        {!loadError && natural && mode === 'cut' && renderCutPreview()}
      </div>

      <div className="crop-mask-side">
        {allowCut && (
          <ToggleButtonGroup
            className="crop-mask-mode"
            size="small"
            exclusive
            value={mode}
            onChange={(_, value: MaskMode | null) => { if (value) { setMode(value); setTouched(true); } }}
          >
            <ToggleButton value="crop"><CropIcon fontSize="small" />&nbsp;Crop</ToggleButton>
            <ToggleButton value="cut"><GridOnIcon fontSize="small" />&nbsp;Cut gallery</ToggleButton>
          </ToggleButtonGroup>
        )}

        {mode === 'crop' ? (
          <>
            <div className="crop-mask-row">
              <FormControlLabel
                control={<Checkbox checked={keepAspect} onChange={(e) => handleKeepAspect(e.target.checked)} />}
                label="Keep aspect ratio"
                title="Hält den Ausschnitt im Kartenformat aus den PDF-Einstellungen, damit das Bild beim Druck nicht verzerrt"
              />
              <Button size="small" variant="outlined" onClick={handleWholeImage} disabled={!natural}>
                Whole image
              </Button>
            </div>
            <div className="crop-mask-fields">
              {rectField('x', 'Offset X')}
              {rectField('y', 'Offset Y')}
              {rectField('width', 'Width')}
              {rectField('height', 'Height')}
            </div>
            <p className="crop-mask-hint">Rahmen mit der Maus verschieben, an den Ecken ziehen oder Werte in Pixeln eingeben.</p>
          </>
        ) : (
          <div className="crop-mask-fields">
            <TextField label="Rows" type="number" size="small" inputProps={{ min: 1 }}
              value={grid.rows} onChange={(e) => updateGrid('rows', e.target.value)} />
            <TextField label="Columns" type="number" size="small" inputProps={{ min: 1 }}
              value={grid.cols} onChange={(e) => updateGrid('cols', e.target.value)} />
            <TextField label="Outer border (px)" type="number" size="small" inputProps={{ min: 0 }}
              value={grid.margin} onChange={(e) => updateGrid('margin', e.target.value)} />
            <TextField label="Gap between cards (px)" type="number" size="small" inputProps={{ min: 0 }}
              disabled={grid.rows === 1 && grid.cols === 1}
              value={grid.gap} onChange={(e) => updateGrid('gap', e.target.value)} />
          </div>
        )}

        {natural && tile && (
          <p className="crop-mask-info">
            {crops.length === 0
              ? 'Rand und Abstände sind größer als das Bild.'
              : `${crops.length} ${crops.length === 1 ? 'Karte' : 'Karten'} à ${tile.width} × ${tile.height} px (Bild ${natural.width} × ${natural.height})`}
            {crops.length > 0 && tileAspectOff > 0.03 && ', weicht vom Kartenformat ab und wird beim Druck gestreckt'}
          </p>
        )}
        {renderThumbs()}
        {error && <p className="help is-danger">{error}</p>}

        {onConfirm && (
          <div className="crop-mask-actions">
            {onBack && <Button variant="outlined" onClick={onBack} disabled={busy}>{backLabel}</Button>}
            <Button
              variant="contained"
              onClick={() => onConfirm(crops)}
              disabled={busy || !natural || crops.length === 0}
            >
              {busy
                ? <CircularProgress size={24} />
                : confirmLabel
                  ? confirmLabel(crops.length)
                  : crops.length > 1 ? `Add ${crops.length} cards` : 'Add card'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CropMask;
