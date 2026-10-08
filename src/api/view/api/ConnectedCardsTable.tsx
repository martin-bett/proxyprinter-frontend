import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ParseKeys } from 'i18next';
import AddIcon from '@mui/icons-material/Add';
import { ConnectedCardLocator } from '../../../service/ApiFactory';
import ActionButton from '../../../container/inputs/ActionButton';

type LocatorField = keyof ConnectedCardLocator;

const COLUMNS: { name: LocatorField; label: ParseKeys; title: ParseKeys; placeholder: string }[] = [
  { name: 'dataListField', label: 'configCommon.fields.dataListField', title: 'apiConfig.connectedCards.dataListFieldTitle', placeholder: 'all_parts' },
  { name: 'nameField', label: 'configCommon.fields.nameField', title: 'apiConfig.connectedCards.nameFieldTitle', placeholder: 'name' },
  { name: 'linkField', label: 'apiConfig.connectedCards.linkField', title: 'apiConfig.connectedCards.linkFieldTitle', placeholder: 'uri' },
  { name: 'typeField', label: 'apiConfig.connectedCards.typeField', title: 'apiConfig.connectedCards.typeFieldTitle', placeholder: 'type_line' },
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
  const { t } = useTranslation();
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
            <th colSpan={COLUMNS.length + (editable ? 1 : 0)} title={t('apiConfig.connectedCards.titleTooltip')}>
              {t('apiConfig.connectedCards.title')}
            </th>
          </tr>
          <tr>
            {COLUMNS.map(column => <th key={column.name} title={t(column.title)}>{t(column.label)}</th>)}
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
                  <button type="button" className="delete is-small" title={t('apiConfig.connectedCards.removeList')} onClick={() => onChange(rows.filter((_, i) => i !== index))} />
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
      {editable ? (
        <ActionButton icon={<AddIcon />} onClick={() => onChange([...rows, emptyLocator()])}>{t('apiConfig.connectedCards.addList')}</ActionButton>
      ) : null}
    </div>
  );
};

export default ConnectedCardsTable;
