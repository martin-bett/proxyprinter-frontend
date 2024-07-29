// SettingsDialog.js
import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Checkbox, FormControlLabel } from '@mui/material';
import { ChromePicker } from 'react-color';

const defaultSettings = {
  width: 63,
  height: 88,
  cutlines: false,
  cutLineColor: '#444444',
  corners: false,
  vmargin: 0,
  hmargin: 0,
  cornerColor: '#000000'
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
        <div>
          <label>Cut Line Color: </label>
          <ChromePicker color={localSettings.cutLineColor} onChange={(color) => handleColorChange('cutLineColor', color)} />
        </div>
        <div>
          <label>Corner Color: </label>
          <ChromePicker color={localSettings.cornerColor} onChange={(color) => handleColorChange('cornerColor', color)} />
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