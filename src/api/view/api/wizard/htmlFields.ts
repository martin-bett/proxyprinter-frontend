// Hilfen für HTML-Antworten im API-Wizard. Die Feld-Syntax ist die von
// ApiFactory.parseHtmlValue: "css-selektor | innerText" oder "css-selektor | attr:src".
import { HTMLElement, parse } from 'node-html-parser';
import type { FieldAssignment, FieldRole } from './jsonFields';

export function parseHtml(text: string): HTMLElement {
  return parse(text, { comment: false, blockTextElements: { script: false, style: false, noscript: false, pre: true } });
}

const SAFE_CLASS = /^[A-Za-z_-][\w-]*$/;

/** tag.klasse1.klasse2 für ein Element (nur unproblematische Klassen). */
export function elementSelector(el: HTMLElement): string {
  const tag = el.tagName ? el.tagName.toLowerCase() : '';
  const classes = (el.getAttribute('class') || '')
    .split(/\s+/)
    .filter(c => c && SAFE_CLASS.test(c))
    .slice(0, 2);
  return tag + classes.map(c => '.' + c).join('');
}

function safeQueryAll(root: HTMLElement, selector: string): HTMLElement[] {
  try {
    return root.querySelectorAll(selector);
  } catch {
    return [];
  }
}

function safeQuery(root: HTMLElement, selector: string): HTMLElement | null {
  try {
    return root.querySelector(selector);
  } catch {
    return null;
  }
}

export function listItems(root: HTMLElement, listSelector: string | undefined): HTMLElement[] {
  return listSelector ? safeQueryAll(root, listSelector) : [];
}

/** "img.card | attr:src" → Element im Listeneintrag, wie parseHtmlValue es findet. */
export function fieldElement(item: HTMLElement, field: string | undefined): HTMLElement | null {
  if (!field) return null;
  for (const alt of field.split('||')) {
    const css = alt.split('|')[0].trim();
    if (!css) continue;
    const el = safeQuery(item, css);
    if (el) return el;
  }
  return null;
}

function imageAttribute(el: HTMLElement): string {
  const src = el.getAttribute('src') || '';
  if (src && !src.startsWith('data:')) return 'src';
  for (const attr of ['data-src', 'data-lazy-src', 'data-original', 'srcset', 'data-srcset']) {
    if (el.getAttribute(attr)) return attr;
  }
  return 'src';
}

function valueType(el: HTMLElement, role: FieldRole): string {
  const tag = el.tagName.toLowerCase();
  if (role === 'imageUrlField') {
    if (tag === 'img' || tag === 'source') return 'attr:' + imageAttribute(el);
    if (tag === 'a') return 'attr:href';
  }
  if (role === 'nameField' && tag === 'img' && el.getAttribute('alt')) return 'attr:alt';
  return 'innerText';
}

function isAncestor(ancestor: HTMLElement, el: HTMLElement | null): boolean {
  for (let cur = el; cur; cur = cur.parentNode as HTMLElement | null) {
    if (cur === ancestor) return true;
  }
  return false;
}

/** Klick auf ein Element → Feldwert für die Rolle. */
export function htmlFieldForRole(
  root: HTMLElement,
  clicked: HTMLElement,
  role: FieldRole,
  listSelector: string | undefined,
): { path: string } | { error: string } {
  if (role === 'dataListField') {
    const sel = elementSelector(clicked);
    if (!sel) return { error: 'Click on an element.' };
    return { path: sel };
  }
  const items = listItems(root, listSelector);
  if (items.length === 0) return { error: 'Choose the result list first.' };
  const item = items.find(i => isAncestor(i, clicked) && i !== clicked);
  if (!item) return { error: 'Click on an element inside one of the marked list entries.' };

  let css = elementSelector(clicked);
  // Findet der einfache Selektor ein anderes Element zuerst, den Elternteil davorhängen
  let cur = clicked.parentNode as HTMLElement | null;
  while (safeQuery(item, css) !== clicked && cur && cur !== item) {
    css = elementSelector(cur) + ' ' + css;
    cur = cur.parentNode as HTMLElement | null;
  }
  return { path: `${css} | ${valueType(clicked, role)}` };
}

/** Wert eines Feldes wie ApiFactory.parseHtmlValue. */
export function htmlFieldValue(item: HTMLElement, field: string | undefined): string {
  if (!field) return '';
  for (const alt of field.split('||').map(s => s.trim())) {
    const [css, type = 'innerText'] = alt.split('|').map(s => s.trim());
    const el = safeQuery(item, css);
    if (!el) continue;
    const val = type.startsWith('attr:') ? el.getAttribute(type.slice(5)) || '' : el.textContent || '';
    if (val) return val;
  }
  return '';
}

/**
 * Vorschlag: der Selektor, der sich am häufigsten wiederholt, ein Bild enthält und
 * möglichst den gesuchten Namen; darin Bild und Name.
 */
export function guessHtmlFields(root: HTMLElement, searchName: string): FieldAssignment {
  const name = searchName.trim().toLowerCase();
  const counts = new Map<string, HTMLElement[]>();
  root.querySelectorAll('*').forEach(el => {
    if (!(el.getAttribute('class') || '').trim()) return;
    const sel = elementSelector(el);
    if (!sel.includes('.')) return;
    const list = counts.get(sel) || [];
    list.push(el);
    counts.set(sel, list);
  });

  let best: { sel: string; score: number } | undefined;
  counts.forEach((els, sel) => {
    if (els.length < 2) return;
    const withImg = els.filter(e => e.querySelector('img'));
    if (withImg.length < els.length * 0.8) return;
    const withName = name ? els.filter(e => (e.textContent + ' ' + (e.querySelector('img')?.getAttribute('alt') || '')).toLowerCase().includes(name)).length : 0;
    const size = els.reduce((n, e) => n + e.querySelectorAll('*').length, 0) / els.length;
    // viele Treffer mit Namen zählen am meisten, kleine Container gewinnen bei Gleichstand
    const score = withName * 1000 + els.length * 10 - size * 0.01;
    if (!best || score > best.score) best = { sel, score };
  });
  if (!best) return {};

  const result: FieldAssignment = { dataListField: best.sel };
  const items = listItems(root, best.sel);
  const item = items.find(i => name && i.textContent.toLowerCase().includes(name)) || items[0];
  const img = item.querySelector('img');
  if (img) {
    const field = htmlFieldForRole(root, img, 'imageUrlField', best.sel);
    if ('path' in field) result.imageUrlField = field.path;
  }
  if (name) {
    const textEl = item
      .querySelectorAll('*')
      .filter(e => e.childNodes.some(c => c.nodeType === 3 && c.text.toLowerCase().includes(name)))[0];
    const target = textEl || (img && (img.getAttribute('alt') || '').toLowerCase().includes(name) ? img : null);
    if (target) {
      const field = htmlFieldForRole(root, target, 'nameField', best.sel);
      if ('path' in field) result.nameField = field.path;
    }
  }
  return result;
}
