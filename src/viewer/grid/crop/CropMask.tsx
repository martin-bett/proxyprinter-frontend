import React, { useEffect, useMemo, useState } from 'react';
import ReactCrop, { PercentCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Button, Checkbox, CircularProgress, FormControlLabel, TextField } from '@mui/material';
import { CropSettings } from '../../../service/ApiFactory';
import { areaAspect, centeredAspectPercent, computeGridCrops, GridOptions, percentToPixels, tileSize } from './gridCrops';
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

const FULL_IMAGE: PercentCrop = { unit: '%', x: 0, y: 0, width: 100, height: 100 };

const numberField = (value: number, min: number) => Math.max(min, parseInt(String(value), 10) || min);

const CropMask: React.FC<CropMaskProps> = ({ imageSrc, cardAspect, loadFallback, busy, error, onBack, onConfirm }) => {
  const [src, setSrc] = useState(imageSrc);
  const [triedFallback, setTriedFallback] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const [crop, setCrop] = useState<PercentCrop>(FULL_IMAGE);
  const [keepAspect, setKeepAspect] = useState(true);
  const [grid, setGrid] = useState<GridOptions>({ rows: 1, cols: 1, margin: 0, gap: 0 });

  useEffect(() => {
    setSrc(imageSrc);
    setTriedFallback(false);
    setLoadError(false);
    setNatural(null);
  }, [imageSrc]);

  const aspect = keepAspect ? areaAspect(cardAspect, grid.rows, grid.cols) : undefined;

  // Beim Einschalten von „Keep aspect ratio“ (oder geändertem Raster) den Ausschnitt passend zentrieren
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

  const area = useMemo(
    () => (natural ? percentToPixels(crop, natural.width, natural.height) : null),
    [crop, natural]
  );
  const crops = useMemo(() => (area ? computeGridCrops(area, grid) : []), [area, grid]);
  const tile = area ? tileSize(area, grid) : null;
  const tileAspectOff = tile && tile.width > 0 && tile.height > 0
    ? Math.abs(tile.width / tile.height / cardAspect - 1)
    : 0;

  const updateGrid = (field: keyof GridOptions, value: string) => {
    const min = field === 'rows' || field === 'cols' ? 1 : 0;
    setGrid((prev) => ({ ...prev, [field]: numberField(Number(value), min) }));
  };

  // Kachel-Rahmen als Overlay im Ausschnitt, in Prozent des Ausschnitts
  const renderTiles = () => {
    if (!area || area.width <= 0 || area.height <= 0) return null;
    if (grid.rows === 1 && grid.cols === 1 && grid.margin === 0) return null;
    return (
      <div className="crop-mask-tiles">
        {crops.map((c, i) => (
          <div
            key={i}
            className="crop-mask-tile"
            style={{
              left: `${(((c.offSetX || 0) - area.x) / area.width) * 100}%`,
              top: `${(((c.offSetY || 0) - area.y) / area.height) * 100}%`,
              width: `${((c.width || 0) / area.width) * 100}%`,
              height: `${((c.height || 0) / area.height) * 100}%`,
            }}
          >
            <span>{i + 1}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="crop-mask">
      <div className="crop-mask-image">
        {!natural && !loadError && <CircularProgress size={32} />}
        {loadError && (
          <p className="help is-danger">Das Bild konnte nicht geladen werden. Bitte die URL prüfen.</p>
        )}
        {!loadError && (
          <ReactCrop
            crop={crop}
            aspect={aspect}
            keepSelection
            minWidth={10}
            minHeight={10}
            onChange={(_, percentCrop) => setCrop(percentCrop)}
            renderSelectionAddon={renderTiles}
            style={{ display: natural ? undefined : 'none' }}
          >
            <img src={src} alt="Zuschnitt" onLoad={handleImageLoad} onError={handleImageError} />
          </ReactCrop>
        )}
      </div>

      <div className="crop-mask-controls">
        <FormControlLabel
          control={<Checkbox checked={keepAspect} onChange={(e) => setKeepAspect(e.target.checked)} />}
          label="Keep aspect ratio"
          title="Hält den Ausschnitt im Kartenformat aus den PDF-Einstellungen, damit das Bild beim Druck nicht verzerrt"
        />
        <Button size="small" variant="outlined" onClick={() => { setKeepAspect(false); setCrop(FULL_IMAGE); }}>
          Whole image
        </Button>

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

        {area && tile && (
          <p className="crop-mask-info">
            {crops.length === 0
              ? 'Rand und Abstände sind größer als der Ausschnitt.'
              : `${crops.length} ${crops.length === 1 ? 'Karte' : 'Karten'} à ${tile.width} × ${tile.height} px`}
            {crops.length > 0 && tileAspectOff > 0.03 && ' (weicht vom Kartenformat ab, wird beim Druck gestreckt)'}
          </p>
        )}
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
