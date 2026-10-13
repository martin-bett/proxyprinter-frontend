// SettingsDialog.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Checkbox, FormControlLabel, Radio, RadioGroup } from '@mui/material';
import { ChromePicker, ColorResult } from 'react-color';
import { useAuth } from '../../service/auth/auth';
import { PdfPagePreview, PreviewCard } from './PdfPagePreview';
import { autoCornerSizeMm, computePageLayout, cornerRadius, MM_TO_PT, REGISTRATION } from './pdfLayout';
import { downloadCutFile } from './cutFile';
import { MmInput } from './MmInput';

/** Passmarken-Muster für Silhouette Print and Cut: 3 Marken (CAMEO 3/4/5) oder 4 Marken (CAMEO 5α, Pro MK II). */
export type RegistrationMarkStyle = 'SILHOUETTE_3' | 'SILHOUETTE_4';

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
  /** Radius der Eckmarken in mm; fehlt = automatisch (1/8 Zoll bei echter Kartengröße). Bleibt bewusst aus defaultSettings, damit alte Hashes gleich bleiben. */
  cornerSize?: number;
  maxDpi: number;
  /** Blatt im Querformat (A4 quer). */
  pageLandscape: boolean;
  /** Karten um 90° gedreht aufs Blatt legen; width/height bleiben die Maße der aufrechten Karte. */
  cardsLandscape: boolean;
  /** Passmarken für den Schneideplotter; fehlt = keine. Bleibt aus defaultSettings, damit alte Hashes gleich bleiben. */
  registrationMarks?: RegistrationMarkStyle;
  /** Geht nicht in die PDF-Settings, sondern als eigenes Feld in den Request. Das Backend nimmt die Adresse des Kontos. */
  sendMail: boolean;
}

const defaultSettings: PdfSettings = {
  width: 63.5,
  height: 88.9,
  cutlines: false,
  cutlineColor: '#43FE43',
  cutlineThickness: 1,
  corners: false,
  vmargin: 0,
  hmargin: 0,
  cornerColor: '#000000',
  cornerColorAuto: true,
  maxDpi: 300,
  pageLandscape: false,
  cardsLandscape: false,
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
  const { t, i18n } = useTranslation();
  const [localSettings, setLocalSettings] = useState<PdfSettings>(settings);
  const auth = useAuth();

  const handleChange = <K extends keyof PdfSettings>(key: K, value: PdfSettings[K]) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleColorChange = (key: 'cutlineColor' | 'cornerColor', color: ColorResult) => {
    handleChange(key, color.hex);
  };

  // Automatik an = kein cornerSize in den Settings; der Text bleibt beim Umschalten erhalten
  const [cornerAuto, setCornerAuto] = useState(settings.cornerSize == null);

  const setCornerSize = (size: number | undefined) => {
    setLocalSettings(prev => {
      const { cornerSize, ...rest } = prev;
      return size === undefined ? rest : { ...rest, cornerSize: size };
    });
  };

  // Zuletzt gewähltes Muster bleibt beim Aus- und Einschalten der Passmarken erhalten
  const [markStyle, setMarkStyle] = useState<RegistrationMarkStyle>(settings.registrationMarks ?? 'SILHOUETTE_3');

  const setRegistrationMarks = (style: RegistrationMarkStyle | undefined) => {
    setLocalSettings(prev => {
      const { registrationMarks, ...rest } = prev;
      return style === undefined ? rest : { ...rest, registrationMarks: style };
    });
  };

  const handleMarkStyleChange = (style: RegistrationMarkStyle) => {
    setMarkStyle(style);
    if (localSettings.registrationMarks) setRegistrationMarks(style);
  };

  const layout = useMemo(() => computePageLayout(localSettings), [localSettings]);
  const formatMm = (mm: number) => new Intl.NumberFormat(i18n.language).format(mm);

  const handleCornerAutoChange = (auto: boolean) => {
    setCornerAuto(auto);
    setCornerSize(auto ? undefined : localSettings.cornerSize ?? autoCornerSizeMm(localSettings.height));
  };

  // Schließen per Klick neben den Dialog übernimmt die Änderungen genauso wie Ok, sonst gehen sie stillschweigend verloren
  const latest = useRef({ localSettings, onSettingsChange });
  latest.current = { localSettings, onSettingsChange };
  useEffect(() => () => latest.current.onSettingsChange(latest.current.localSettings), []);

  const handleSave = () => {
    onSettingsChange(localSettings);
    onClose();
  };

  const handleReset = () => {
    // Der Mailversand ist keine Druckeinstellung, Reset lässt ihn stehen
    setLocalSettings({ ...defaultSettings, sendMail: localSettings.sendMail });
    setCornerAuto(true);
    setMarkStyle('SILHOUETTE_3');
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
          <label htmlFor="pdf-width">{t('pdf.settings.width')}</label>
          <MmInput id="pdf-width" min={31} max={189} value={localSettings.width} onChange={(v) => handleChange('width', v)} />
        </div>
        <div>
          <label htmlFor="pdf-height">{t('pdf.settings.height')}</label>
          <MmInput id="pdf-height" min={44} max={264} value={localSettings.height} onChange={(v) => handleChange('height', v)} />
        </div>
        <div>
          <label htmlFor="pdf-vmargin">{t('pdf.settings.verticalMargin')}</label>
          <MmInput id="pdf-vmargin" min={0} max={15} value={localSettings.vmargin} onChange={(v) => handleChange('vmargin', v)} />
        </div>
        <div>
          <label htmlFor="pdf-hmargin">{t('pdf.settings.horizontalMargin')}</label>
          <MmInput id="pdf-hmargin" min={0} max={15} value={localSettings.hmargin} onChange={(v) => handleChange('hmargin', v)} />
        </div>
        <div>
          <label>{t('pdf.settings.maxDpi')}</label>
          <input className="input" type="number" min="0" max="1000" value={localSettings.maxDpi} onChange={(e) => handleChange('maxDpi', Number(e.target.value))} />
        </div>
        <div>
          <FormControlLabel
            control={<Checkbox checked={!!localSettings.pageLandscape} onChange={(e) => handleChange('pageLandscape', e.target.checked)} />}
            label={t('pdf.settings.pageLandscape')}
          />
        </div>
        <div>
          <FormControlLabel
            control={<Checkbox checked={!!localSettings.cardsLandscape} onChange={(e) => handleChange('cardsLandscape', e.target.checked)} />}
            label={t('pdf.settings.cardsLandscape')}
          />
        </div>
      </div>
      <div className="settings-category">
        <FormControlLabel
          className="title is-4"
          control={<Checkbox checked={localSettings.cutlines && !localSettings.registrationMarks} disabled={!!localSettings.registrationMarks} onChange={(e) => handleChange('cutlines', e.target.checked)} />}
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
            <div><FormControlLabel
              control={<Checkbox disabled={!localSettings.corners} checked={cornerAuto} onChange={(e) => handleCornerAutoChange(e.target.checked)} />}
              label={t('pdf.settings.cornerSizeAutomatic')}
            /></div>
            <MmInput
              id="pdf-corner-size"
              max={20}
              disabled={!localSettings.corners || cornerAuto}
              value={cornerAuto ? autoCornerSizeMm(localSettings.height) : localSettings.cornerSize ?? 0}
              onChange={(v) => setCornerSize(v)}
            />
            <p className="help settings-corner-hint">{t('pdf.settings.cornerSizeHint')}</p>
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
      <div className="settings-category settings-plotter">
        <FormControlLabel
          className="title is-4"
          control={<Checkbox checked={!!localSettings.registrationMarks} onChange={(e) => setRegistrationMarks(e.target.checked ? markStyle : undefined)} />}
          label={t('pdf.settings.plotter.marks')}
        />
        <RadioGroup value={markStyle} onChange={(e) => handleMarkStyleChange(e.target.value as RegistrationMarkStyle)}>
          <FormControlLabel value="SILHOUETTE_3" disabled={!localSettings.registrationMarks} control={<Radio size="small" />} label={t('pdf.settings.plotter.threeMarks')} />
          <FormControlLabel value="SILHOUETTE_4" disabled={!localSettings.registrationMarks} control={<Radio size="small" />} label={t('pdf.settings.plotter.fourMarks')} />
        </RadioGroup>
        <p className="help">{t('pdf.settings.plotter.hint')}</p>
        {layout.registration && (
          <>
            <p className="help">
              {t('pdf.settings.plotter.studioValues', {
                inset: formatMm(REGISTRATION.insetMm),
                length: formatMm(layout.registration.lengthMm),
                thickness: formatMm(REGISTRATION.thicknessMm),
              })}
            </p>
            {layout.slots.length > 0 && (
              <p className="help">
                {t('pdf.settings.plotter.cutFilePosition', {
                  x: formatMm(Math.round(layout.slots[0].x / MM_TO_PT * 10) / 10),
                  y: formatMm(Math.round(layout.slots[0].y / MM_TO_PT * 10) / 10),
                })}
              </p>
            )}
            <button
              className="button is-small"
              disabled={layout.slots.length === 0}
              onClick={() => downloadCutFile(layout, cornerRadius(layout.cardWidth, layout.cardHeight, localSettings.cornerSize))}
            >
              {t('pdf.settings.plotter.cutFile')}
            </button>
            <p className="help">{t('pdf.settings.plotter.cutFileHint')}</p>
          </>
        )}
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
