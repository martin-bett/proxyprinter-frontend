import React, { useMemo } from 'react';
import CollapsibleSection from '../../container/inputs/CollapsibleSection';
import './ConfigFieldTable.css';

type InputChange = React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>;

export interface ConfigField {
  name: string;
  label: string;
  // Gruppe als Zwischenzeile in der Tabelle (z. B. "Request", "Locator")
  group: string;
  type?: 'text' | 'number' | 'checkbox' | 'select' | 'json';
  options?: [string, string][];
  title?: string;
  required?: boolean;
}

export const CATEGORY_OPTIONS: [string, string][] = [['MTG', 'MTG'], ['POKE', 'Poke'], ['YUGIOH', 'Yugi'], ['MISC', 'Misc']];

/** Ein Feld gilt als gesetzt, wenn es einen Wert hat: true, nicht leeres Objekt, nicht leerer Text. */
export const isFieldSet = (value: unknown): boolean => {
  if (value === undefined || value === null) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'object') return Object.keys(value as object).length > 0;
  return String(value).trim() !== '';
};

interface ConfigFieldTableProps {
  fields: ConfigField[];
  // Aktueller Entwurf, den die Eingabefelder anzeigen
  values: Record<string, unknown>;
  // Gespeicherter Stand: entscheidet, ob ein Feld unter SET oder UNSET steht.
  // So springt ein Feld beim Tippen nicht in den anderen Bereich.
  savedValues?: Record<string, unknown> | null;
  editable: boolean;
  onChange: (e: InputChange) => void;
  onJsonChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}

const displayValue = (field: ConfigField, value: unknown): string => {
  if (field.type === 'json') return JSON.stringify(value ?? {}, null, 2);
  if (field.type === 'select') return field.options?.find(([v]) => v === String(value ?? ''))?.[1] ?? String(value ?? '');
  return value === undefined || value === null ? '' : String(value);
};

const FieldInput: React.FC<{ field: ConfigField; value: unknown; editable: boolean; onChange: (e: InputChange) => void; onJsonChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void }> = ({ field, value, editable, onChange, onJsonChange }) => {
  if (field.type === 'checkbox') {
    return <input type="checkbox" name={field.name} checked={!!value} onChange={onChange} disabled={!editable} />;
  }
  if (!editable) {
    // Nur ansehen: Wert als Text statt ausgegrautem Eingabefeld
    const text = displayValue(field, value);
    return field.type === 'json'
      ? <pre className="config-value is-json">{text}</pre>
      : <span className="config-value">{text || '—'}</span>;
  }
  if (field.type === 'select') {
    return (
      <select name={field.name} value={String(value ?? '')} onChange={onChange}>
        {field.options?.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
      </select>
    );
  }
  if (field.type === 'json') {
    return <textarea name={field.name} value={displayValue(field, value)} onChange={onJsonChange} />;
  }
  return (
    <input
      type={field.type === 'number' ? 'number' : 'text'}
      name={field.name}
      value={displayValue(field, value)}
      onChange={onChange}
      required={field.required}
    />
  );
};

const FieldRows: React.FC<Omit<ConfigFieldTableProps, 'savedValues'>> = ({ fields, values, editable, onChange, onJsonChange }) => {
  if (fields.length === 0) {
    return <p className="config-table-empty">No properties.</p>;
  }
  const rows: React.ReactNode[] = [];
  let group = '';
  fields.forEach(field => {
    if (field.group !== group) {
      group = field.group;
      rows.push(<tr key={`group-${group}`} className="config-table-group"><th colSpan={2}>{group}</th></tr>);
    }
    rows.push(
      <tr key={field.name}>
        <th scope="row" title={field.title}>{field.label}</th>
        <td>
          <FieldInput field={field} value={values[field.name]} editable={editable} onChange={onChange} onJsonChange={onJsonChange} />
        </td>
      </tr>
    );
  });
  return <table className="config-table"><tbody>{rows}</tbody></table>;
};

/** Config-Felder in zwei Bereichen: gesetzte (aufgeklappt) und nicht gesetzte (zugeklappt). */
const ConfigFieldTable: React.FC<ConfigFieldTableProps> = ({ fields, values, savedValues, ...rest }) => {
  const source = savedValues ?? values;
  const [setFields, unsetFields] = useMemo(() => {
    const set: ConfigField[] = [];
    const unset: ConfigField[] = [];
    fields.forEach(f => (isFieldSet(source[f.name]) ? set : unset).push(f));
    return [set, unset];
  }, [fields, source]);

  return (
    <div className="config-field-table">
      <CollapsibleSection title={<span className="config-section-title">SET properties<span className="config-count">{setFields.length}</span></span>} defaultOpen>
        <FieldRows fields={setFields} values={values} {...rest} />
      </CollapsibleSection>
      <CollapsibleSection title={<span className="config-section-title">UNSET properties<span className="config-count">{unsetFields.length}</span></span>} defaultOpen={false}>
        <FieldRows fields={unsetFields} values={values} {...rest} />
      </CollapsibleSection>
    </div>
  );
};

export default ConfigFieldTable;
