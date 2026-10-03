// SettingsDialog.js
import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Checkbox, FormControlLabel } from '@mui/material';
import { ChromePicker } from 'react-color';

const defaultSettings = {
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
  maxDpi: 500
};

function SettingsDialog({ open, onClose, settings, onPrint }) {
  const [localSettings, setLocalSettings] = useState(settings);

  const handleChange = (key, value) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleColorChange = (key, color) => {
    handleChange(key, color.hex);
  };

  const handleReset = () => {
    setLocalSettings(defaultSettings);
  };

  const handlePrint = () => {
    onPrint(localSettings); // Übergibt die Settings an den Parent
    onClose();
  };

  return (
    <div className="settings-dialog">
      <div class="settings-category-row">
        <div class="settings-category">
          <h4 class="title is-4">Dimensions</h4>
          <div>
            <label>Width: </label>
            <input class="input" type="number" min="31" max="189" value={localSettings.width} onChange={(e) => handleChange('width', Number(e.target.value))} />
          </div>
          <div>
            <label>Height: </label>
            <input class="input" type="number" min="44" max="264" value={localSettings.height} onChange={(e) => handleChange('height', Number(e.target.value))} />
          </div>
          <div>
            <label>Vertical Margin: </label>
            <input class="input" type="number" min="0" max="15" value={localSettings.vmargin} onChange={(e) => handleChange('vmargin', Number(e.target.value))} />
          </div>
          <div>
            <label>Horizontal Margin: </label>
            <input class="input" type="number" min="0" max="15" value={localSettings.hmargin} onChange={(e) => handleChange('hmargin', Number(e.target.value))} />
          </div>
          <div>
            <label>Max Dpi: </label>
            <input class="input" type="number" min="0" max="1000" value={localSettings.maxDpi} onChange={(e) => handleChange('maxDpi', Number(e.target.value))} />
          </div>
        </div>
        <div class="settings-category">
          <div class="settings-category-header">
            <FormControlLabel
              class="title is-4"
              control={<Checkbox checked={localSettings.cutlines} onChange={(e) => handleChange('cutlines', e.target.checked)} />}
              label={<h4 class="title is-4">Cutlines</h4>}
            />
          </div>

          <div>
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <div>
                <label>Line Thickness: </label>
                <input class="input" type="number" min="1" max="10" value={localSettings.cutlineThickness} onChange={(e) => handleChange('cutlineThickness', Number(e.target.value))} />
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
                    backgroundColor: 'rgba(255, 255, 255, 0.5)',
                    cursor: 'not-allowed',
                    zIndex: 1,  // Stellt sicher, dass das Overlay oben liegt
                  }}
                ></div>
              )}
            </div>
          </div>
        </div>
        <div class="settings-category">
          <div>
            <div class="settings-category-header">
              <FormControlLabel
                class="title is-4"
                control={<Checkbox checked={localSettings.corners} onChange={(e) => handleChange('corners', e.target.checked)} />}
                label={<h4 class="title is-4">Corners</h4>}
              />
            </div>
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
                  backgroundColor: 'rgba(255, 255, 255, 0.5)',
                  cursor: 'not-allowed',
                  zIndex: 1,  // Stellt sicher, dass das Overlay oben liegt
                }}
              ></div>
            )}
          </div>
        </div>
      </div>
      <div className='dialog-footer'>
        <button className='button' onClick={handleReset}>Reset</button>
        <button className='button' onClick={handlePrint}>Print</button>
      </div>
    </div>
  );
}

export { SettingsDialog, defaultSettings };