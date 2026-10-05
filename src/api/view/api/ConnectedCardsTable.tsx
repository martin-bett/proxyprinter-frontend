import React from 'react';
import AddIcon from '@mui/icons-material/Add';
import { ConnectedCardLocator } from '../../../service/ApiFactory';
import ActionButton from '../../../container/inputs/ActionButton';

type LocatorField = keyof ConnectedCardLocator;

const COLUMNS: { name: LocatorField; label: string; title: string; placeholder: string }[] = [
  { name: 'dataListField', label: 'Data List Field', title: 'Liste im Treffer, z.B. all_parts bei Scryfall', placeholder: 'all_parts' },
  { name: 'nameField', label: 'Name Field', title: 'Name je Eintrag, wird über alle aktiven APIs gesucht', placeholder: 'name' },
  { name: 'linkField', label: 'Link Field', title: 'Optional: Link auf das exakte Objekt (gleiches Format wie ein Treffer)', placeholder: 'uri' },
  { name: 'typeField', label: 'Type Field', title: 'Optional: Typ je Eintrag, z.B. type_line', placeholder: 'type_line' },
];

const emptyLocator = (): ConnectedCardLocator => ({ dataListField: '', nameField: '', linkField: '', typeField: '' });

interface ConnectedCardsTableProps {
  value: ConnectedCardLocator[];
  editable: boolean;
  onChange: (value: ConnectedCardLocator[]) => void;
}

/**
 * Listen verbundener Karten (Tokens, Emblems, ...). Jede Zeile ist eine Liste im Treffer;
 * jeder Eintrag wird eine eigene Karte mit Anzahl 1 und über alle aktiven APIs per Name gesucht.
 */
const ConnectedCardsTable: React.FC<ConnectedCardsTableProps> = ({ value, editable, onChange }) => {
  const rows = value ?? [];
  if (!editable && rows.length === 0) {
    return null;
  }

  const update = (index: number, field: LocatorField, fieldValue: string) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, [field]: fieldValue } : row)));

  return (
    <div className="connected-cards-table">
      <table className="config-table">
        <tbody>
          <tr className="config-table-group">
            <th colSpan={COLUMNS.length + (editable ? 1 : 0)} title="Jeder Eintrag einer Liste wird eine eigene Karte (Anzahl 1), gesucht über alle aktiven APIs">
              Connected Cards
            </th>
          </tr>
          <tr>
            {COLUMNS.map(column => <th key={column.name} title={column.title}>{column.label}</th>)}
            {editable ? <th /> : null}
          </tr>
          {rows.map((row, index) => (
            <tr key={index}>
              {COLUMNS.map(column => (
                <td key={column.name}>
                  {editable ? (
                    <input
                      type="text"
                      value={row[column.name] ?? ''}
                      placeholder={column.placeholder}
                      onChange={(e) => update(index, column.name, e.target.value)}
                    />
                  ) : (
                    <span className="config-value">{row[column.name] || '—'}</span>
                  )}
                </td>
              ))}
              {editable ? (
                <td>
                  <button type="button" className="delete is-small" title="Remove list" onClick={() => onChange(rows.filter((_, i) => i !== index))} />
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
      {editable ? (
        <ActionButton icon={<AddIcon />} onClick={() => onChange([...rows, emptyLocator()])}>Add list</ActionButton>
      ) : null}
    </div>
  );
};

export default ConnectedCardsTable;
