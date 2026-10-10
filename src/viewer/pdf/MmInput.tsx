import React from 'react';
import { useTranslation } from 'react-i18next';

interface MmInputProps {
  /** Wert in mm, eine Nachkommastelle */
  value: number;
  onChange: (value: number) => void;
  /** id des Felds für ganze Millimeter, für <label htmlFor> */
  id?: string;
  min?: number;
  max?: number;
  disabled?: boolean;
}

/** Zehntel als ganze Zahl, damit 88.9 nicht als 88.89999 zerfällt. */
const toTenths = (value: number): number => Math.round((value || 0) * 10);

/** Millimeterwert mit getrennten Feldern für ganze Millimeter und Zehntel. */
export function MmInput({ value, onChange, id, min = 0, max, disabled }: MmInputProps) {
  const { t } = useTranslation();
  const tenths = toTenths(value);
  const whole = Math.floor(tenths / 10);
  const tenth = tenths % 10;

  const emit = (w: number, d: number) => onChange((w * 10 + d) / 10);

  return (
    <div className="mm-input">
      <input
        id={id}
        className="input mm-whole"
        type="number"
        min={min}
        max={max}
        step="1"
        disabled={disabled}
        value={whole}
        onChange={(e) => emit(Math.max(0, Math.floor(Number(e.target.value) || 0)), tenth)}
      />
      <span className="mm-separator">,</span>
      <input
        className="input mm-tenth"
        type="number"
        min="0"
        max="9"
        step="1"
        disabled={disabled}
        aria-label={t('pdf.settings.tenthMm')}
        value={tenth}
        onChange={(e) => emit(whole, Math.min(9, Math.max(0, Math.floor(Number(e.target.value) || 0))))}
      />
      <span className="mm-unit">mm</span>
    </div>
  );
}
