// SettingsDialog.tsx
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Checkbox, FormControlLabel } from '@mui/material';
import { ChromePicker, ColorResult } from 'react-color';
import { useAuth } from '../../service/auth/auth';
import { PdfPagePreview, PreviewCard } from './PdfPagePreview';
import { autoCornerSizeMm } from './pdfLayout';

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
  /** Radius der Eckmarken in mm; fehlt = automatisch (3 % der Kartenhöhe). Bleibt bewusst aus defaultSettings, damit alte Hashes gleich bleiben. */
  cornerSize?: number;
  maxDpi: number;
  /** Geht nicht in die PDF-Settings, sondern als eigenes Feld in den Request. Das Backend nimmt die Adresse des Kontos. */
  sendMail: boolean;
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
  maxDpi: 300,
  sendMail: false
};

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  settings: PdfSettings;
  onSettingsChange: (settings: PdfSettings) => void;
  /** Kann der Server Mails verschicken? Sonst ist die Option ausgegraut. */
  mailEnabled?: boolean;
  /** Die ersten Karten des Decks für die Seitenvorschau; leer = graue Platzhalter. */
  previewCards?: PreviewCard[];
}

function SettingsDialog({ onClose, settings, onSettingsChange, mailEnabled = false, previewCards = [] }: SettingsDialogProps) {
  const { t } = useTranslation();
  const [localSettings, setLocalSettings] = useState<PdfSettings>(settings);
  const auth = useAuth();

  const handleChange = <K extends keyof PdfSettings>(key: K, value: PdfSettings[K]) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleColorChange = (key: 'cutlineColor' | 'cornerColor', color: ColorResult) => {
    handleChange(key, color.hex);
  };

  const handleCornerSizeChange = (value: string) => {
    setLocalSettings(prev => {
      const { cornerSize, ...rest } = prev;
      const size = parseFloat(value);
      return value.trim() === '' || isNaN(size) || size < 0 ? rest : { ...rest, cornerSize: size };
    });
  };

  const handleSave = () => {
    onSettingsChange(localSettings);
    onClose();
  };

  const handleReset = () => {
    // Der Mailversand ist keine Druckeinstellung, Reset lässt ihn stehen
    setLocalSettings({ ...defaultSettings, sendMail: localSettings.sendMail });
  };

  return (
    <div className="settings-dialog">
      <div className="settings-row">
      <div className="settings-category settings-preview">
        <h3 className="title is-4">{t('common.preview')}</h3>
        <PdfPagePreview settings={localSettings} cards={previewCards} />
      </div>
      <div className="settings-category">
        <h3 className="title is-4">{t('pdf.settings.dimensions')}</h3>
        <div>
          <label>{t('pdf.settings.width')}</label>
          <input className="input" type="number" min="31" max="189" value={localSettings.width} onChange={(e) => handleChange('width', Number(e.target.value))} />
        </div>
        <div>
          <label>{t('pdf.settings.height')}</label>
          <input className="input" type="number" min="44" max="264" value={localSettings.height} onChange={(e) => handleChange('height', Number(e.target.value))} />
        </div>
        <div>
          <label>{t('pdf.settings.verticalMargin')}</label>
          <input className="input" type="number" min="0" max="15" value={localSettings.vmargin} onChange={(e) => handleChange('vmargin', Number(e.target.value))} />
        </div>
        <div>
          <label>{t('pdf.settings.horizontalMargin')}</label>
          <input className="input" type="number" min="0" max="15" value={localSettings.hmargin} onChange={(e) => handleChange('hmargin', Number(e.target.value))} />
        </div>
        <div>
          <label>{t('pdf.settings.maxDpi')}</label>
          <input className="input" type="number" min="0" max="1000" value={localSettings.maxDpi} onChange={(e) => handleChange('maxDpi', Number(e.target.value))} />
        </div>
      </div>
      <div className="settings-category">
        <FormControlLabel
          className="title is-4"
          control={<Checkbox checked={localSettings.cutlines} onChange={(e) => handleChange('cutlines', e.target.checked)} />}
          label={t('pdf.settings.cutlines')}
        />

        <div>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <div>
              <label>{t('pdf.settings.lineThickness')}</label>
              <input className="input" type="number" min="1" max="10" value={localSettings.cutlineThickness} onChange={(e) => handleChange('cutlineThickness', Number(e.target.value))} />
            </div>
            <label>{t('pdf.settings.cutLineColor')}</label>
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
            label={t('pdf.settings.corners')}
          />
          <div><FormControlLabel
            control={<Checkbox disabled={!localSettings.corners} checked={localSettings.cornerColorAuto} onChange={(e) => handleChange('cornerColorAuto', e.target.checked)} />}
            label={t('pdf.settings.detectBorderColor')}
          /></div>
          <div>
            <label htmlFor="pdf-corner-size">{t('pdf.settings.cornerSize')}</label>
            <input
              id="pdf-corner-size"
              className="input"
              type="number"
              min="0"
              max="20"
              step="0.1"
              disabled={!localSettings.corners}
              placeholder={t('pdf.settings.cornerSizeAuto', { size: autoCornerSizeMm(localSettings.height) })}
              value={localSettings.cornerSize ?? ''}
              onChange={(e) => handleCornerSizeChange(e.target.value)}
            />
            <p className="help">{t('pdf.settings.cornerSizeHint')}</p>
          </div>
          <div> <label>{t('pdf.settings.cornerColor')}</label></div>
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
      </div>
      <div className="settings-category settings-email">
        <h3 className="title is-4">{t('pdf.settings.email.title')}</h3>
        <FormControlLabel
          control={
            <Checkbox
              checked={localSettings.sendMail && !!auth.email}
              disabled={!mailEnabled || !auth.email}
              onChange={(e) => handleChange('sendMail', e.target.checked)}
            />
          }
          label={auth.email ? t('pdf.settings.email.sendTo', { email: auth.email }) : t('pdf.settings.email.sendToMine')}
        />
        {!mailEnabled
          ? <p className="help">{t('pdf.settings.email.notAvailable')}</p>
          : !auth.email
            ? <p className="help">{t('pdf.settings.email.loginHint')}</p>
            : <p className="help">{t('pdf.settings.email.hint')}</p>}
      </div>
      <div className='dialog-footer'>
        <button className='button' onClick={handleReset}>{t('common.reset')}</button>
        <button className='button' onClick={handleSave}>{t('pdf.settings.ok')}</button>
      </div>
    </div>
  );
}

export { SettingsDialog, defaultSettings };
