import React, { useEffect, useMemo, useState } from 'react';
import ReactCrop, { PercentCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Button, Checkbox, CircularProgress, FormControlLabel, TextField, ToggleButton, ToggleButtonGroup } from '@mui/material';
import CropIcon from '@mui/icons-material/Crop';
import GridOnIcon from '@mui/icons-material/GridOn';
import { CropSettings } from '../../../service/ApiFactory';
import { centeredAspectPercent, computeGridCrops, GridOptions, percentToPixels, tileSize } from './gridCrops';
import './CropMask.css';

interface CropMaskProps {
  /** Bildquelle für die Vorschau (URL oder Object-URL einer gewählten Datei). */
  imageSrc: string;
  /** Seitenverhältnis einer Karte (Breite / Höhe) aus den PDF-Einstellungen. */
  cardAspect: number;
  /** Ausweich-Quelle, wenn das Bild direkt nicht lädt (z. B. über den Backend-Proxy). */
  loadFallback?: () => Promise<string | null>;
  busy?: boolean;
  error?: string;
  onBack: () => void;
  onConfirm: (crops: CropSettings[]) => void;
}

/** crop: ein Ausschnitt per Maus. cut: ganzes Bild in ein Raster schneiden (Galerie in einem Bild). */
type MaskMode = 'crop' | 'cut';

const FULL_IMAGE: PercentCrop = { unit: '%', x: 0, y: 0, width: 100, height: 100 };
const THUMB_HEIGHT = 110;

const numberField = (value: number, min: number) => Math.max(min, parseInt(String(value), 10) || min);

const CropMask: React.FC<CropMaskProps> = ({ imageSrc, cardAspect, loadFallback, busy, error, onBack, onConfirm }) => {
  const [src, setSrc] = useState(imageSrc);
  const [triedFallback, setTriedFallback] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const [mode, setMode] = useState<MaskMode>('crop');
  const [crop, setCrop] = useState<PercentCrop>(FULL_IMAGE);
  const [keepAspect, setKeepAspect] = useState(true);
  const [grid, setGrid] = useState<GridOptions>({ rows: 1, cols: 1, margin: 0, gap: 0 });

  useEffect(() => {
    setSrc(imageSrc);
    setTriedFallback(false);
    setLoadError(false);
    setNatural(null);
  }, [imageSrc]);

  const aspect = keepAspect ? cardAspect : undefined;

  // Beim Einschalten von „Keep aspect ratio“ den Ausschnitt im Kartenformat zentrieren
  useEffect(() => {
    if (natural && aspect) {
      setCrop(centeredAspectPercent(natural.width, natural.height, aspect));
    }
  }, [natural, aspect]);

  const handleImageLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    setNatural({ width: img.naturalWidth, height: img.naturalHeight });
    setLoadError(false);
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

  const fullArea = useMemo(
    () => (natural ? { x: 0, y: 0, width: natural.width, height: natural.height } : null),
    [natural]
  );
  const cropArea = useMemo(
    () => (natural ? percentToPixels(crop, natural.width, natural.height) : null),
    [crop, natural]
  );
  const cutCrops = useMemo(() => (fullArea ? computeGridCrops(fullArea, grid) : []), [fullArea, grid]);
  const crops: CropSettings[] = mode === 'cut'
    ? cutCrops
    : cropArea && cropArea.width > 0 && cropArea.height > 0
      ? [{ offSetX: cropArea.x, offSetY: cropArea.y, width: cropArea.width, height: cropArea.height, isStretch: true }]
      : [];
  const tile = mode === 'cut'
    ? (fullArea ? tileSize(fullArea, grid) : null)
    : (cropArea ? { width: cropArea.width, height: cropArea.height } : null);
  const tileAspectOff = tile && tile.width > 0 && tile.height > 0
    ? Math.abs(tile.width / tile.height / cardAspect - 1)
    : 0;

  const updateGrid = (field: keyof GridOptions, value: string) => {
    const min = field === 'rows' || field === 'cols' ? 1 : 0;
    setGrid((prev) => ({ ...prev, [field]: numberField(Number(value), min) }));
  };

  const image = <img src={src} alt="Zuschnitt" onLoad={handleImageLoad} onError={handleImageError} />;

  // Cut-Vorschau: weggeschnittene Ränder abdunkeln, Kacheln nummerieren
  const renderCutPreview = () => (
    <div className="crop-mask-cut" style={{ display: natural ? undefined : 'none' }}>
      {image}
      {natural && (
        <svg
          className="crop-mask-cut-overlay"
          viewBox={`0 0 ${natural.width} ${natural.height}`}
          preserveAspectRatio="none"
        >
          <path
            fillRule="evenodd"
            className="crop-mask-cut-shade"
            d={`M0 0H${natural.width}V${natural.height}H0Z ` + cutCrops
              .map((c) => `M${c.offSetX} ${c.offSetY}h${c.width}v${c.height}h${-(c.width || 0)}Z`)
              .join(' ')}
          />
          {cutCrops.map((c, i) => (
            <rect
              key={i}
              className="crop-mask-cut-tile"
              x={c.offSetX}
              y={c.offSetY}
              width={c.width}
              height={c.height}
              vectorEffect="non-scaling-stroke"
            />
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

  // Kleine Kartenvorschau je Kachel, im Kartenformat wie im Druck
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

  return (
    <div className="crop-mask">
      <ToggleButtonGroup
        className="crop-mask-mode"
        size="small"
        exclusive
        value={mode}
        onChange={(_, value: MaskMode | null) => value && setMode(value)}
      >
        <ToggleButton value="crop"><CropIcon fontSize="small" />&nbsp;Crop</ToggleButton>
        <ToggleButton value="cut"><GridOnIcon fontSize="small" />&nbsp;Cut gallery</ToggleButton>
      </ToggleButtonGroup>

      <div className="crop-mask-image">
        {!natural && !loadError && <CircularProgress size={32} />}
        {loadError && (
          <p className="help is-danger">Das Bild konnte nicht geladen werden. Bitte die URL prüfen.</p>
        )}
        {!loadError && mode === 'crop' && (
          <ReactCrop
            crop={crop}
            aspect={aspect}
            keepSelection
            minWidth={10}
            minHeight={10}
            onChange={(_, percentCrop) => setCrop(percentCrop)}
            style={{ display: natural ? undefined : 'none' }}
          >
            {image}
          </ReactCrop>
        )}
        {!loadError && mode === 'cut' && renderCutPreview()}
      </div>

      <div className="crop-mask-controls">
        {mode === 'crop' ? (
          <>
            <FormControlLabel
              control={<Checkbox checked={keepAspect} onChange={(e) => setKeepAspect(e.target.checked)} />}
              label="Keep aspect ratio"
              title="Hält den Ausschnitt im Kartenformat aus den PDF-Einstellungen, damit das Bild beim Druck nicht verzerrt"
            />
            <Button size="small" variant="outlined" onClick={() => { setKeepAspect(false); setCrop(FULL_IMAGE); }}>
              Whole image
            </Button>
            <p className="crop-mask-hint">Rahmen mit der Maus verschieben oder an den Ecken ziehen.</p>
          </>
        ) : (
          <div className="crop-mask-grid">
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

        {tile && (
          <p className="crop-mask-info">
            {crops.length === 0
              ? 'Rand und Abstände sind größer als das Bild.'
              : `${crops.length} ${crops.length === 1 ? 'Karte' : 'Karten'} à ${tile.width} × ${tile.height} px`}
            {crops.length > 0 && tileAspectOff > 0.03 && ' (weicht vom Kartenformat ab, wird beim Druck gestreckt)'}
          </p>
        )}
        {renderThumbs()}
        {error && <p className="help is-danger">{error}</p>}

        <div className="crop-mask-actions">
          <Button variant="outlined" onClick={onBack} disabled={busy}>Back</Button>
          <Button
            variant="contained"
            onClick={() => onConfirm(crops)}
            disabled={busy || !natural || crops.length === 0}
          >
            {busy ? <CircularProgress size={24} /> : crops.length > 1 ? `Add ${crops.length} cards` : 'Add card'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CropMask;
