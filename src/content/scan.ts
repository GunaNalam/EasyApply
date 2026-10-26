// Finds the questions on an application form and works out their label and options.

import type { FieldInfo, FieldKind } from '../shared/types';

export interface ScannedField {
  info: FieldInfo;
  /** One element for normal fields; every input of the group for radio/checkbox groups. */
  els: HTMLElement[];
  /** Element the badge is positioned next to. */
  anchor: HTMLElement;
}

type Control = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

const SKIP_TYPES = new Set(['hidden', 'submit', 'button', 'reset', 'image', 'password', 'search', 'range', 'color']);
export const UI_ATTR = 'data-easyapply';

export const clean = (s: string | null | undefined) =>
  (s ?? '')
    .replace(/\s+/g, ' ')
    .replace(/\s*\*\s*$/, '')
    .replace(/^\s*\*\s*/, '')
    .trim()
    .slice(0, 400);

function textOf(el: Element | null): string {
  if (!el) return '';
  const html = el as HTMLElement;
  // innerText respects visibility; jsdom lacks it, so fall back to textContent.
  return clean(html.innerText ?? html.textContent);
}

function byIds(ids: string | null, root: Document): string {
  if (!ids) return '';
  return clean(
    ids
      .split(/\s+/)
      .map((id) => root.getElementById(id)?.textContent ?? '')
      .join(' '),
  );
}

/** Text of a <label> without the text of form controls inside it. */
function labelText(label: HTMLLabelElement): string {
  const copy = label.cloneNode(true) as HTMLElement;
  copy.querySelectorAll('input, select, textarea, option, [aria-hidden="true"]').forEach((n) => n.remove());
  return clean(copy.textContent);
}

/** The label of one control on its own (its option text, for a radio/checkbox). */
export function ownLabel(el: Control): string {
  const doc = el.ownerDocument;
  if (el.id) {
    // Compare htmlFor directly: ids on ATS forms can contain characters a selector would need escaped.
    const lab = Array.from(doc.getElementsByTagName('label')).find((l) => l.htmlFor === el.id);
    if (lab) {
      const t = labelText(lab);
      if (t) return t;
    }
  }
  const wrap = el.closest('label');
  if (wrap) {
    const t = labelText(wrap as HTMLLabelElement);
    if (t) return t;
  }
  const aria = byIds(el.getAttribute('aria-labelledby'), doc) || clean(el.getAttribute('aria-label'));
  if (aria) return aria;
  // <input type=radio> Yes  — bare text right after the input.
  const next = el.nextSibling;
  if (next && next.nodeType === Node.TEXT_NODE && clean(next.textContent)) return clean(next.textContent);
  if (next instanceof HTMLElement && !next.matches('input, select, textarea')) return textOf(next);
  return '';
}

/** Walk up from the element looking for nearby question text (for forms without proper labels). */
function nearbyText(el: HTMLElement, exclude: string[] = []): string {
  let node: HTMLElement | null = el;
  for (let depth = 0; node && depth < 5; depth++) {
    let sib = node.previousElementSibling as HTMLElement | null;
    while (sib) {
      // Text before another control (or a label tied to one) belongs to that control, not this one.
      if (sib.matches('input, select, textarea') || sib.querySelector('input, select, textarea') || (sib as HTMLLabelElement).htmlFor) return '';
      if (!sib.matches('button, script, style')) {
        const t = textOf(sib);
        if (t && t.length < 400 && !exclude.includes(t)) return t;
      }
      sib = sib.previousElementSibling as HTMLElement | null;
    }
    node = node.parentElement;
    if (node?.matches('form, body')) break;
  }
  return '';
}

function questionForControl(el: Control): string {
  return ownLabel(el) || nearbyText(el) || clean(el.getAttribute('placeholder')) || clean(el.getAttribute('title'));
}

function commonAncestor(els: HTMLElement[]): HTMLElement {
  let anc: HTMLElement | null = els[0].parentElement;
  while (anc && !els.every((e) => anc!.contains(e))) anc = anc.parentElement;
  return anc ?? els[0].ownerDocument.body;
}

function questionForGroup(els: HTMLInputElement[], options: string[]): string {
  const doc = els[0].ownerDocument;
  const group = els[0].closest('fieldset, [role="radiogroup"], [role="group"]') as HTMLElement | null;
  if (group) {
    const legend = group.querySelector(':scope > legend');
    if (legend && textOf(legend)) return textOf(legend);
    const aria = byIds(group.getAttribute('aria-labelledby'), doc) || clean(group.getAttribute('aria-label'));
    if (aria) return aria;
  }
  const anc = group ?? commonAncestor(els);
  // Text inside the group container that isn't an option label.
  const copy = anc.cloneNode(true) as HTMLElement;
  copy.querySelectorAll('input, label, select, textarea').forEach((n) => n.remove());
  let inside = clean(copy.textContent);
  for (const o of options) inside = clean(inside.replace(o, ''));
  if (inside && inside.length < 400) return inside;
  return nearbyText(anc, options);
}

function isVisible(el: HTMLElement, checkLayout: boolean): boolean {
  if (el.getAttribute('aria-hidden') === 'true') return false;
  const style = el.ownerDocument.defaultView?.getComputedStyle(el);
  if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
  // Radios/checkboxes are often visually hidden behind custom styling; their label is what shows.
  const t = (el as HTMLInputElement).type;
  if (checkLayout && t !== 'radio' && t !== 'checkbox' && el.getClientRects().length === 0) return false;
  return true;
}

function kindOf(el: Control): FieldKind | null {
  if (el instanceof HTMLTextAreaElement) return 'textarea';
  if (el instanceof HTMLSelectElement) return 'select';
  const t = (el.type || 'text').toLowerCase();
  if (SKIP_TYPES.has(t)) return null;
  if (['email', 'tel', 'url', 'number', 'date', 'radio', 'checkbox', 'file'].includes(t)) return t as FieldKind;
  return 'text';
}

const PLACEHOLDER_OPTION = /^(select|choose|please|--|—|-)/i;

export function selectOptions(el: HTMLSelectElement): string[] {
  return Array.from(el.options)
    .filter((o) => !(o.value === '' || PLACEHOLDER_OPTION.test(clean(o.text))))
    .map((o) => clean(o.text))
    .filter(Boolean);
}

function hintsOf(el: Control): string {
  return [el.getAttribute('name'), el.id, el.getAttribute('autocomplete'), el.getAttribute('data-qa')]
    .filter(Boolean)
    .join(' ')
    .replace(/[_\-[\].]+/g, ' ');
}

/** checkLayout=false is for tests (jsdom has no layout engine). */
export function scanFields(root: Document = document, checkLayout = true): ScannedField[] {
  const controls = Array.from(root.querySelectorAll<Control>('input, textarea, select')).filter(
    (el) => !el.closest(`[${UI_ATTR}]`) && !el.disabled,
  );
  const out: ScannedField[] = [];
  const groups = new Map<string, HTMLInputElement[]>();

  for (const el of controls) {
    const kind = kindOf(el);
    if (!kind) continue;
    if (kind !== 'file' && !isVisible(el, checkLayout)) continue;
    if ((el as HTMLInputElement).readOnly && kind !== 'file') continue;

    if (kind === 'radio' || kind === 'checkbox') {
      const input = el as HTMLInputElement;
      const key = `${kind}:${input.name || input.closest('fieldset, [role="radiogroup"], [role="group"]')?.id || input.id}`;
      const list = groups.get(key) ?? [];
      list.push(input);
      groups.set(key, list);
      continue;
    }

    const options = el instanceof HTMLSelectElement ? selectOptions(el) : [];
    out.push({
      info: { kind, label: questionForControl(el), hints: hintsOf(el), options, required: el.required || el.getAttribute('aria-required') === 'true' },
      els: [el],
      anchor: el,
    });
  }

  for (const [key, els] of groups) {
    const kind = key.startsWith('radio') ? 'radio' : 'checkbox';
    if (kind === 'checkbox' && els.length === 1) {
      const el = els[0];
      // A lone checkbox: the question is its own label ("I agree…", "Willing to relocate").
      const own = ownLabel(el);
      out.push({
        info: { kind: 'checkbox', label: own || nearbyText(el), hints: hintsOf(el), options: [], required: el.required },
        els,
        anchor: (el.closest('label') as HTMLElement | null) ?? el,
      });
      continue;
    }
    const options = els.map((e) => ownLabel(e) || clean(e.value));
    const container = (els[0].closest('fieldset, [role="radiogroup"], [role="group"]') as HTMLElement | null) ?? commonAncestor(els);
    out.push({
      info: { kind, label: questionForGroup(els, options), hints: hintsOf(els[0]), options, required: els.some((e) => e.required) },
      els,
      anchor: container,
    });
  }

  // Keep page order so the review list reads top to bottom.
  out.sort((a, b) => (a.anchor.compareDocumentPosition(b.anchor) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  return out;
}
