import React from 'react';
import './inputs.css';
import useLongPress, { LONG_PRESS_MS } from './useLongPress';

interface ChoiceButtonProps {
  id: string;
  label: React.ReactNode;
  checked: boolean;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  indeterminate?: boolean;
  className?: string;
  /** Langer Klick (2 s), bei Filtern: nur diesen Eintrag auswählen. */
  onLongPress?: () => void;
  longPressHint?: string;
}

// Auswahlfeld im Button-Stil: volle Breite, Haken links, durch eine Kante vom Titel getrennt
const ChoiceButton: React.FC<ChoiceButtonProps> = ({ id, label, checked, onChange, indeterminate = false, className, onLongPress, longPressHint }) => {
  const { pressing, handlers } = useLongPress(onLongPress);
  const state = indeterminate ? 'is-indeterminate' : checked ? 'is-checked' : '';
  const longPressClass = onLongPress ? 'has-long-press' : '';
  return (
    <label
      className={`input-tile choice-button ${state} ${longPressClass} ${pressing ? 'is-pressing' : ''} ${className ?? ''}`}
      title={onLongPress ? longPressHint : undefined}
      style={onLongPress ? ({ '--long-press-ms': `${LONG_PRESS_MS}ms` } as React.CSSProperties) : undefined}
      {...handlers}
    >
      <input type="checkbox" id={id} checked={checked} onChange={onChange} className="input-tile-native" />
      <span className="input-tile-lead" aria-hidden="true">
        <span className="choice-mark" />
      </span>
      <span className="input-tile-title">{label}</span>
    </label>
  );
};

export default ChoiceButton;
