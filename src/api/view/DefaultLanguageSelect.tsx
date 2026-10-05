import React from 'react';

// Sprachen, in denen es Magic-Karten gibt (ISO-639-1, Phyrexianisch als "ph")
const LANGUAGES: [string, string][] = [
  ['en', 'English'],
  ['de', 'German'],
  ['fr', 'French'],
  ['it', 'Italian'],
  ['es', 'Spanish'],
  ['pt', 'Portuguese'],
  ['ja', 'Japanese'],
  ['ko', 'Korean'],
  ['ru', 'Russian'],
  ['zh', 'Chinese'],
  ['ph', 'Phyrexian'],
];

interface Props {
  value?: string;
  disabled?: boolean;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}

/** Sprache für Karten, zu denen die Quelle keine Sprache liefert. */
const DefaultLanguageSelect: React.FC<Props> = ({ value, disabled, onChange }) => (
  <>
    <label title="Sprache für Karten, zu denen die Quelle keine Sprache liefert">Default Language:</label>
    <select name="defaultLanguage" value={value || ''} onChange={onChange} disabled={disabled}>
      <option value="">None</option>
      {LANGUAGES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
    </select>
  </>
);

export default DefaultLanguageSelect;
