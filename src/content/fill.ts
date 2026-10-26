// Writes values into fields in a way React/Vue/Angular forms notice, and reads current answers back.

import type { StoredResume } from '../shared/types';
import { normalize } from '../shared/text';
import type { ScannedField } from './scan';
import { clean, ownLabel, selectOptions } from './scan';

function fire(el: HTMLElement, ...types: string[]) {
  for (const t of types) el.dispatchEvent(new Event(t, { bubbles: true }));
}

/** Set .value through the native setter so framework-controlled inputs register the change. */
function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  el.focus();
  if (setter) setter.call(el, value);
  else el.value = value;
  fire(el, 'input', 'change');
  el.blur();
}

const isChecked = (el: HTMLElement) => (el as HTMLInputElement).checked;

/** True if the user (or the site) already put an answer here. We never overwrite those. */
export function hasValue(f: ScannedField): boolean {
  const el = f.els[0];
  switch (f.info.kind) {
    case 'radio':
    case 'checkbox':
      return f.els.some(isChecked);
    case 'select': {
      const s = el as HTMLSelectElement;
      return s.value !== '' && selectOptions(s).includes(clean(s.selectedOptions[0]?.text));
    }
    case 'file':
      return ((el as HTMLInputElement).files?.length ?? 0) > 0;
    default:
      return (el as HTMLInputElement).value.trim() !== '';
  }
}

/** The answer currently in a field, as text — what ➕ saves. Empty string if unanswered. */
export function currentAnswer(f: ScannedField): string {
  const el = f.els[0];
  switch (f.info.kind) {
    case 'radio':
      return f.els.filter(isChecked).map((e) => ownLabel(e as HTMLInputElement) || (e as HTMLInputElement).value)[0] ?? '';
    case 'checkbox':
      if (f.els.length === 1) return isChecked(el) ? 'Yes' : 'No';
      return f.els
        .filter(isChecked)
        .map((e) => ownLabel(e as HTMLInputElement) || (e as HTMLInputElement).value)
        .join(', ');
    case 'select': {
      const s = el as HTMLSelectElement;
      return hasValue(f) ? clean(s.selectedOptions[0]?.text) : '';
    }
    case 'file':
      return '';
    default:
      return (el as HTMLInputElement).value.trim();
  }
}

function resumeFile(r: StoredResume): File {
  const bin = atob(r.data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], r.name, { type: r.type || 'application/pdf' });
}

/** Apply a decided value. Returns false if the field couldn't take it. */
export function applyValue(f: ScannedField, value: string, resume: StoredResume | null): boolean {
  const el = f.els[0];
  switch (f.info.kind) {
    case 'select': {
      const s = el as HTMLSelectElement;
      const opt = Array.from(s.options).find((o) => clean(o.text) === value);
      if (!opt) return false;
      s.value = opt.value;
      fire(s, 'input', 'change');
      return true;
    }
    case 'radio': {
      const target = f.els.find((e) => (ownLabel(e as HTMLInputElement) || (e as HTMLInputElement).value) === value);
      if (!target) return false;
      if (!isChecked(target)) target.click();
      return true;
    }
    case 'checkbox': {
      if (f.els.length === 1) {
        const want = value === 'Yes';
        if (isChecked(el) !== want) el.click();
        return true;
      }
      const wanted = value.split(',').map((v) => normalize(v));
      let any = false;
      for (const e of f.els) {
        const lab = normalize(ownLabel(e as HTMLInputElement) || (e as HTMLInputElement).value);
        if (wanted.includes(lab) && !isChecked(e)) {
          e.click();
          any = true;
        }
      }
      return any;
    }
    case 'file': {
      if (!resume) return false;
      try {
        const dt = new DataTransfer();
        dt.items.add(resumeFile(resume));
        (el as HTMLInputElement).files = dt.files;
        fire(el, 'input', 'change');
        return true;
      } catch {
        return false;
      }
    }
    default:
      setNativeValue(el as HTMLInputElement | HTMLTextAreaElement, value);
      return true;
  }
}
