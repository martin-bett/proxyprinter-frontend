// SettingsDialog.js
import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Checkbox, FormControlLabel } from '@mui/material';
import { ChromePicker } from 'react-color';

const defaultSettings = {
  width: 63,
  height: 88,
  cutlines: false,
  cutlineColor: '#43FE43',
  corners: false,
  vmargin: 0,
  hmargin: 0,
  cornerColor: '#000000',
  cornerColorAuto: true
};

function SettingsDialog({ open, onClose, settings, onSettingsChange }) {
  const [localSettings, setLocalSettings] = useState(settings);

  const handleChange = (key, value) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleColorChange = (key, color) => {
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
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>PDF Settings</DialogTitle>
      <DialogContent>
        <FormControlLabel
          control={<Checkbox checked={localSettings.cutlines} onChange={(e) => handleChange('cutlines', e.target.checked)} />}
          label="Cutlines"
        />
        <FormControlLabel
          control={<Checkbox checked={localSettings.corners} onChange={(e) => handleChange('corners', e.target.checked)} />}
          label="Corners"
        />

        <div>
          <label>Width: </label>
          <input type="number" value={localSettings.width} onChange={(e) => handleChange('width', Number(e.target.value))} />
        </div>
        <div>
          <label>Height: </label>
          <input type="number" value={localSettings.height} onChange={(e) => handleChange('height', Number(e.target.value))} />
        </div>
        <div>
          <label>Vertical Margin: </label>
          <input type="number" value={localSettings.vmargin} onChange={(e) => handleChange('vmargin', Number(e.target.value))} />
        </div>
        <div>
          <label>Horizontal Margin: </label>
          <input type="number" value={localSettings.hmargin} onChange={(e) => handleChange('hmargin', Number(e.target.value))} />
        </div>
        <div style={{ position: 'relative', display: 'inline-block' }}>
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
        <div> <label>Corner Color: </label></div>
        <div>
         
          <FormControlLabel
            control={<Checkbox disabled={!localSettings.corners} checked={localSettings.cornerColorAuto} onChange={(e) => handleChange('cornerColorAuto', e.target.checked)} />}
            label="Corner Detect BorderColor"
          />
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
      </DialogContent>
      <DialogActions>
        <Button onClick={handleReset}>Reset</Button>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

export { SettingsDialog, defaultSettings };