import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HTMLElement } from 'node-html-parser';
import { FieldAssignment, FieldRole } from './jsonFields';
import { elementSelector, fieldElement, listItems } from './htmlFields';
import { ROLES, roleClass } from './roles';

interface Props {
  root: HTMLElement;
  fields: FieldAssignment;
  onSelect: (el: HTMLElement) => void;
}

const MAX_CHILDREN = 80;
const SKIP = new Set(['script', 'style', 'noscript', 'svg', 'head', 'link', 'meta']);

interface Marks {
  roles: Map<HTMLElement, FieldRole[]>;
  open: Set<HTMLElement>;
}

function computeMarks(root: HTMLElement, fields: FieldAssignment): Marks {
  const roles = new Map<HTMLElement, FieldRole[]>();
  const open = new Set<HTMLElement>();
  const add = (el: HTMLElement | null, role: FieldRole) => {
    if (!el) return;
    roles.set(el, [...(roles.get(el) || []), role]);
  };
  const items = listItems(root, fields.dataListField);
  items.forEach(item => {
    add(item, 'dataListField');
    ROLES.forEach(({ role }) => {
      if (role !== 'dataListField') add(fieldElement(item, fields[role]), role);
    });
  });
  // Weg zum ersten Listeneintrag und dessen Inhalt aufklappen
  if (items[0]) {
    for (let cur: HTMLElement | null = items[0]; cur; cur = cur.parentNode as HTMLElement | null) open.add(cur);
    items[0].querySelectorAll('*').forEach(el => open.add(el));
  } else {
    // ohne Liste: body und die ersten Ebenen
    const body = root.querySelector('body') || root;
    for (let cur: HTMLElement | null = body; cur; cur = cur.parentNode as HTMLElement | null) open.add(cur);
    body.childNodes.forEach(c => { if (c instanceof HTMLElement) open.add(c); });
  }
  return { roles, open };
}

function ownText(el: HTMLElement): string {
  const text = el.childNodes
    .filter(c => c.nodeType === 3)
    .map(c => c.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > 60 ? text.slice(0, 57) + '…' : text;
}

function interestingAttrs(el: HTMLElement): string {
  const out: string[] = [];
  ['src', 'data-src', 'href', 'alt'].forEach(a => {
    const v = el.getAttribute(a);
    if (v) out.push(`${a}="${v.length > 50 ? v.slice(0, 47) + '…' : v}"`);
  });
  return out.join(' ');
}

const HtmlNode: React.FC<{ el: HTMLElement; marks: Marks; onSelect: (el: HTMLElement) => void }> = ({ el, marks, onSelect }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(() => marks.open.has(el));
  const children = el.childNodes.filter((c): c is HTMLElement => c instanceof HTMLElement && !SKIP.has(c.tagName.toLowerCase()));
  const roles = marks.roles.get(el) || [];
  const text = ownText(el);
  const attrs = interestingAttrs(el);
  return (
    <div className="wiz-row">
      {children.length > 0
        ? <button type="button" className="wiz-toggle" onClick={() => setOpen(!open)}>{open ? '▾' : '▸'}</button>
        : <span className="wiz-toggle" />}
      <span
        className={'wiz-node' + (roles.length ? ' wiz-marked ' + roles.map(roleClass).join(' ') : '')}
        onClick={e => { e.stopPropagation(); onSelect(el); }}
      >
        <span className="wiz-key">&lt;{elementSelector(el)}&gt;</span>
        {attrs && <span className="wiz-punct"> {attrs}</span>}
        {text && <span className="wiz-value wiz-string"> {text}</span>}
        {roles.map(r => <span key={r} className={'wiz-badge ' + roleClass(r)} />)}
      </span>
      {open && children.length > 0 && (
        <div className="wiz-children">
          {children.slice(0, MAX_CHILDREN).map((c, i) => <HtmlNode key={i} el={c} marks={marks} onSelect={onSelect} />)}
          {children.length > MAX_CHILDREN && <div className="wiz-more">{t('wizard.tree.more', { count: children.length - MAX_CHILDREN })}</div>}
        </div>
      )}
    </div>
  );
};

/** Rohdaten-Viewer für HTML: Elementbaum, Listeneinträge und Felder farbig markiert. */
const HtmlTreeView: React.FC<Props> = ({ root, fields, onSelect }) => {
  const marks = useMemo(() => computeMarks(root, fields), [root, fields]);
  const top = (root.querySelector('html') || root).childNodes.filter(
    (c): c is HTMLElement => c instanceof HTMLElement && !SKIP.has(c.tagName.toLowerCase()),
  );
  return (
    <div className="wiz-tree" key={fields.dataListField ?? '-'}>
      {top.map((el, i) => <HtmlNode key={i} el={el} marks={marks} onSelect={onSelect} />)}
    </div>
  );
};

export default HtmlTreeView;
