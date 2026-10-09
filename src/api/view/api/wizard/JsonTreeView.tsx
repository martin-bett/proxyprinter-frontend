import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FieldAssignment, FieldRole, JsonPath, pathToString, rolesAt } from './jsonFields';
import { roleClass } from './roles';

interface Props {
  data: unknown;
  fields: FieldAssignment;
  onSelect: (path: JsonPath) => void;
}

const MAX_CHILDREN = 50;

function shouldOpen(path: JsonPath, fields: FieldAssignment): boolean {
  if (path.length === 0) return true;
  const list = fields.dataListField;
  if (list === undefined) return path.length < 2;
  const prefix = list ? list.split('.') : [];
  const p = path.map(String);
  // Weg zur Liste offen, dazu das erste Listenelement
  if (p.length <= prefix.length) return prefix.slice(0, p.length).join('.') === p.join('.');
  return p.slice(0, prefix.length).join('.') === prefix.join('.') && p[prefix.length] === '0' && p.length <= prefix.length + 2;
}

function preview(value: unknown): string {
  if (Array.isArray(value)) return `[${value.length}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).length}}`;
  return '';
}

const RoleBadges: React.FC<{ roles: FieldRole[] }> = ({ roles }) => (
  <>{roles.map(r => <span key={r} className={'wiz-badge ' + roleClass(r)} />)}</>
);

const JsonNode: React.FC<{ name: string | number | null; value: unknown; path: JsonPath; fields: FieldAssignment; onSelect: (p: JsonPath) => void }> = ({ name, value, path, fields, onSelect }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(() => shouldOpen(path, fields));
  const roles = rolesAt(path, fields);
  const isContainer = value !== null && typeof value === 'object';
  const cls = 'wiz-node' + (roles.length ? ' wiz-marked ' + roles.map(roleClass).join(' ') : '');

  const label = (
    <span
      className={cls}
      onClick={e => { e.stopPropagation(); onSelect(path); }}
      title={pathToString(path) || t('wizard.tree.root')}
    >
      {name !== null && <span className="wiz-key">{typeof name === 'number' ? `[${name}]` : name}</span>}
      {name !== null && <span className="wiz-punct">: </span>}
      {isContainer
        ? <span className="wiz-punct">{preview(value)}</span>
        : <span className={'wiz-value wiz-' + (value === null ? 'null' : typeof value)}>{JSON.stringify(value)}</span>}
      <RoleBadges roles={roles} />
    </span>
  );

  if (!isContainer) return <div className="wiz-row">{label}</div>;

  const entries: [string | number, unknown][] = Array.isArray(value)
    ? value.map((v, i) => [i, v])
    : Object.entries(value as Record<string, unknown>);
  return (
    <div className="wiz-row">
      <button type="button" className="wiz-toggle" onClick={() => setOpen(!open)} aria-label={open ? t('wizard.tree.collapse') : t('wizard.tree.expand')}>
        {open ? '▾' : '▸'}
      </button>
      {label}
      {open && (
        <div className="wiz-children">
          {entries.slice(0, MAX_CHILDREN).map(([k, v]) => (
            <JsonNode key={String(k)} name={k} value={v} path={[...path, k]} fields={fields} onSelect={onSelect} />
          ))}
          {entries.length > MAX_CHILDREN && <div className="wiz-more">{t('wizard.tree.more', { count: entries.length - MAX_CHILDREN })}</div>}
        </div>
      )}
    </div>
  );
};

/** Rohdaten-Viewer für JSON: anklickbarer Baum, zugewiesene Felder farbig markiert. */
const JsonTreeView: React.FC<Props> = ({ data, fields, onSelect }) => (
  <div className="wiz-tree">
    {/* key erzwingt neues Aufklappen, wenn sich die Liste ändert */}
    <JsonNode key={fields.dataListField ?? '-'} name={null} value={data} path={[]} fields={fields} onSelect={onSelect} />
  </div>
);

export default JsonTreeView;
