// SettingsDialog.tsx
import React, { useState } from 'react';
import { Checkbox, FormControlLabel } from '@mui/material';
import { ChromePicker, ColorResult } from 'react-color';

export interface PdfSettings {
  width: number;
  height: number;
  cutlines: boolean;
  cutlineColor: string;
  cutlineThickness: number;
  corners: boolean;
  vmargin: number;
  hmargin: number;
  cornerColor: string;
  cornerColorAuto: boolean;
  maxDpi: number;
}

const defaultSettings: PdfSettings = {
  width: 63,
  height: 88,
  cutlines: false,
  cutlineColor: '#43FE43',
  cutlineThickness: 1,
  corners: false,
  vmargin: 0,
  hmargin: 0,
  cornerColor: '#000000',
  cornerColorAuto: true,
  maxDpi: 300
};

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  settings: PdfSettings;
  onSettingsChange: (settings: PdfSettings) => void;
}

function SettingsDialog({ onClose, settings, onSettingsChange }: SettingsDialogProps) {
  const [localSettings, setLocalSettings] = useState<PdfSettings>(settings);

  const handleChange = <K extends keyof PdfSettings>(key: K, value: PdfSettings[K]) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleColorChange = (key: 'cutlineColor' | 'cornerColor', color: ColorResult) => {
    handleChange(key, color.hex);
  };

  const handleSave = () => {
    onSettingsChange(localSettings);
    onClose();
  };

  const handleReset = () => {
    setLocalSettings(defaultSettings);
  };

  return (
    <div className="settings-dialog">
      <div className="settings-category">
        <h3 className="title is-4">Dimensions</h3>
        <div>
          <label>Width: </label>
          <input className="input" type="number" min="31" max="189" value={localSettings.width} onChange={(e) => handleChange('width', Number(e.target.value))} />
        </div>
        <div>
          <label>Height: </label>
          <input className="input" type="number" min="44" max="264" value={localSettings.height} onChange={(e) => handleChange('height', Number(e.target.value))} />
        </div>
        <div>
          <label>Vertical Margin: </label>
          <input className="input" type="number" min="0" max="15" value={localSettings.vmargin} onChange={(e) => handleChange('vmargin', Number(e.target.value))} />
        </div>
        <div>
          <label>Horizontal Margin: </label>
          <input className="input" type="number" min="0" max="15" value={localSettings.hmargin} onChange={(e) => handleChange('hmargin', Number(e.target.value))} />
        </div>
        <div>
          <label>Max Dpi: </label>
          <input className="input" type="number" min="0" max="1000" value={localSettings.maxDpi} onChange={(e) => handleChange('maxDpi', Number(e.target.value))} />
        </div>
      </div>
      <div className="settings-category">
        <FormControlLabel
          className="title is-4"
          control={<Checkbox checked={localSettings.cutlines} onChange={(e) => handleChange('cutlines', e.target.checked)} />}
          label="Cutlines"
        />

        <div>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <div>
              <label>Line Thickness: </label>
              <input className="input" type="number" min="1" max="10" value={localSettings.cutlineThickness} onChange={(e) => handleChange('cutlineThickness', Number(e.target.value))} />
            </div>
            <label>Cut Line Color: </label>
            <ChromePicker color={localSettings.cutlineColor} onChange={(color) => handleColorChange('cutlineColor', color)} />
            {!localSettings.cutlines && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'var(--disabled-overlay)',
                  cursor: 'not-allowed',
                  zIndex: 1,  // Stellt sicher, dass das Overlay oben liegt
                }}
              ></div>
            )}
          </div>
        </div>
      </div>
      <div className="settings-category">
        <div>
          <FormControlLabel
            className="title is-4"
            control={<Checkbox checked={localSettings.corners} onChange={(e) => handleChange('corners', e.target.checked)} />}
            label="Corners"
          />
          <div><FormControlLabel
            control={<Checkbox disabled={!localSettings.corners} checked={localSettings.cornerColorAuto} onChange={(e) => handleChange('cornerColorAuto', e.target.checked)} />}
            label="Detect BorderColor"
          /></div>
          <div> <label>Corner Color: </label></div>
        </div>
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <ChromePicker
            color={localSettings.cornerColor}
            onChange={(color) => handleColorChange('cornerColor', color)}
          />
          {localSettings.cornerColorAuto && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'var(--disabled-overlay)',
                cursor: 'not-allowed',
                zIndex: 1,  // Stellt sicher, dass das Overlay oben liegt
              }}
            ></div>
          )}
        </div>
      </div>
      <div className='dialog-footer'>
        <button className='button' onClick={handleReset}>Reset</button>
        <button className='button' onClick={handleSave}>Ok</button>
      </div>
    </div>
  );
}

export { SettingsDialog, defaultSettings };
