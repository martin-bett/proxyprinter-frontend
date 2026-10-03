import React from 'react';
import './inputs.css';

interface ChoiceButtonProps {
  id: string;
  label: React.ReactNode;
  checked: boolean;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  indeterminate?: boolean;
  className?: string;
}

// Auswahlfeld im Button-Stil: volle Breite, Haken links, durch eine Kante vom Titel getrennt
const ChoiceButton: React.FC<ChoiceButtonProps> = ({ id, label, checked, onChange, indeterminate = false, className }) => {
  const state = indeterminate ? 'is-indeterminate' : checked ? 'is-checked' : '';
  return (
    <label className={`input-tile choice-button ${state} ${className ?? ''}`}>
      <input type="checkbox" id={id} checked={checked} onChange={onChange} className="input-tile-native" />
      <span className="input-tile-lead" aria-hidden="true">
        <span className="choice-mark" />
      </span>
      <span className="input-tile-title">{label}</span>
    </label>
  );
};

export default ChoiceButton;
