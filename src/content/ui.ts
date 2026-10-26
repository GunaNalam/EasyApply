// On-page overlay: a badge next to every question, and the review panel.
// Lives in a shadow root positioned over the page, so it never touches the site's own DOM tree
// (inserting nodes inside React-managed forms can break them).

import { UI_ATTR } from './scan';

export type FieldStatus = 'profile' | 'rule' | 'memory' | 'resume' | 'kept' | 'needs' | 'saved';

export interface BadgeModel {
  anchor: HTMLElement;
  status: FieldStatus;
  /** Hover text. */
  reason: string;
  /** Show the ➕ save button. */
  savable: boolean;
  /** Low-confidence answers get an amber ring. */
  lowConfidence: boolean;
}

export interface PanelModel {
  company: string;
  filled: number;
  kept: number;
  needs: { label: string; index: number }[];
  lowConfidence: number;
}

export interface UiHandlers {
  onSave(index: number): void;
  onSaveAll(): void;
  onFillAgain(): void;
  onMarkApplied(): void;
  onCompanyChange(name: string): void;
  onFocusField(index: number): void;
  onPillClick(): void;
}

const COLORS: Record<FieldStatus, [string, string]> = {
  profile: ['#2563eb', 'P'],
  resume: ['#2563eb', 'CV'],
  rule: ['#7c3aed', 'R'],
  memory: ['#059669', 'M'],
  kept: ['#6b7280', '·'],
  needs: ['#dc2626', '?'],
  saved: ['#059669', '✓'],
};

const CSS = `
:host { all: initial; }
* { box-sizing: border-box; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
.badge { position: fixed; display: flex; gap: 3px; align-items: center; pointer-events: auto; z-index: 1; }
.dot { min-width: 20px; height: 20px; padding: 0 5px; border-radius: 10px; color: #fff; font: 600 11px/20px system-ui; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,.3); cursor: default; }
.dot.low { outline: 2px solid #f59e0b; outline-offset: 1px; }
.plus { width: 20px; height: 20px; border-radius: 10px; border: 1px solid #059669; background: #fff; color: #059669; font: 700 13px/18px system-ui; cursor: pointer; padding: 0; box-shadow: 0 1px 3px rgba(0,0,0,.2); }
.plus:hover { background: #059669; color: #fff; }
.panel { position: fixed; right: 16px; bottom: 16px; width: 320px; max-height: 70vh; overflow: auto; background: #fff; color: #111827; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,.25); pointer-events: auto; font-size: 13px; border: 1px solid #e5e7eb; }
.head { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: #111827; color: #fff; border-radius: 12px 12px 0 0; font-weight: 600; }
.head button { background: none; border: 0; color: #fff; font-size: 16px; cursor: pointer; }
.body { padding: 10px 12px; display: grid; gap: 8px; }
.row { display: flex; gap: 6px; align-items: center; }
.row input { flex: 1; padding: 4px 6px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; }
.stats { display: flex; gap: 10px; flex-wrap: wrap; }
.stat b { font-size: 15px; }
.needs { margin: 0; padding-left: 18px; color: #b91c1c; }
.needs li { cursor: pointer; margin: 2px 0; }
.needs li:hover { text-decoration: underline; }
.btns { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.btn { padding: 7px 8px; border-radius: 8px; border: 1px solid #d1d5db; background: #f9fafb; cursor: pointer; font-size: 12px; font-weight: 600; color: #111827; }
.btn.primary { background: #059669; border-color: #059669; color: #fff; }
.note { font-size: 12px; color: #374151; background: #fef3c7; border-radius: 8px; padding: 6px 8px; }
.toast { color: #047857; font-size: 12px; min-height: 14px; }
.legend { font-size: 11px; color: #6b7280; }
.pill { position: fixed; right: 16px; bottom: 16px; pointer-events: auto; background: #111827; color: #fff; border: 0; border-radius: 999px; padding: 10px 16px; font: 600 13px system-ui; cursor: pointer; box-shadow: 0 6px 20px rgba(0,0,0,.3); }
.pill:hover { background: #059669; }
`;

export class Overlay {
  private host: HTMLDivElement;
  private root: ShadowRoot;
  private badgeLayer: HTMLDivElement;
  private panel: HTMLDivElement | null = null;
  private pill: HTMLButtonElement | null = null;
  private badges: { model: BadgeModel; el: HTMLDivElement }[] = [];
  private raf = 0;
  private timer: number;

  constructor(private h: UiHandlers) {
    this.host = document.createElement('div');
    this.host.setAttribute(UI_ATTR, '');
    this.host.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647;';
    this.root = this.host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = CSS;
    this.badgeLayer = document.createElement('div');
    this.root.append(style, this.badgeLayer);
    document.documentElement.appendChild(this.host);
    const schedule = () => {
      cancelAnimationFrame(this.raf);
      this.raf = requestAnimationFrame(() => this.position());
    };
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    this.timer = window.setInterval(() => this.position(), 800);
  }

  showPill() {
    if (this.pill || this.panel) return;
    this.pill = document.createElement('button');
    this.pill.className = 'pill';
    this.pill.textContent = '⚡ EasyApply: Autofill';
    this.pill.onclick = () => this.h.onPillClick();
    this.root.appendChild(this.pill);
  }

  hidePill() {
    this.pill?.remove();
    this.pill = null;
  }

  setBadges(models: BadgeModel[]) {
    this.badgeLayer.replaceChildren();
    this.badges = models.map((model, i) => {
      const el = document.createElement('div');
      el.className = 'badge';
      this.renderBadge(el, model, i);
      this.badgeLayer.appendChild(el);
      return { model, el };
    });
    this.position();
  }

  updateBadge(index: number, patch: Partial<BadgeModel>) {
    const b = this.badges[index];
    if (!b) return;
    b.model = { ...b.model, ...patch };
    this.renderBadge(b.el, b.model, index);
  }

  private renderBadge(el: HTMLDivElement, m: BadgeModel, index: number) {
    const [color, text] = COLORS[m.status];
    const dot = document.createElement('span');
    dot.className = 'dot' + (m.lowConfidence ? ' low' : '');
    dot.style.background = color;
    dot.textContent = text;
    dot.title = m.reason;
    el.replaceChildren(dot);
    if (m.savable) {
      const plus = document.createElement('button');
      plus.className = 'plus';
      plus.textContent = '+';
      plus.title = 'Save this answer for future applications';
      plus.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.h.onSave(index);
      };
      el.appendChild(plus);
    }
  }

  private position() {
    const vw = window.innerWidth;
    for (const { model, el } of this.badges) {
      const r = model.anchor.getBoundingClientRect();
      const offscreen = r.width === 0 && r.height === 0;
      if (!model.anchor.isConnected || offscreen || r.bottom < 0 || r.top > window.innerHeight) {
        el.style.display = 'none';
        continue;
      }
      el.style.display = 'flex';
      el.style.left = `${Math.min(r.right + 4, vw - 52)}px`;
      el.style.top = `${Math.max(r.top, 0)}px`;
    }
  }

  showPanel(m: PanelModel) {
    this.hidePill();
    this.panel?.remove();
    const p = document.createElement('div');
    p.className = 'panel';
    p.innerHTML = `
      <div class="head"><span>⚡ EasyApply</span><button data-a="close" title="Hide">×</button></div>
      <div class="body">
        <div class="row"><span>Company</span><input data-a="company" /></div>
        <div class="stats">
          <span class="stat"><b data-s="filled"></b> filled</span>
          <span class="stat"><b data-s="kept"></b> already had answers</span>
          <span class="stat" style="color:#b91c1c"><b data-s="needs"></b> need you</span>
        </div>
        <ol class="needs"></ol>
        <div class="note">Check every answer (amber ring = low confidence). Fill the red ones, press <b>Save all answers</b>, then click the site's <b>Submit</b> yourself. EasyApply never submits.</div>
        <div class="btns">
          <button class="btn primary" data-a="saveall">Save all answers</button>
          <button class="btn" data-a="fill">Fill again</button>
          <button class="btn" data-a="applied">Mark applied</button>
          <button class="btn" data-a="close">Hide</button>
        </div>
        <div class="toast"></div>
        <div class="legend">P profile · R default rule · M saved answer · ? needs you · ✓ saved · + save one answer</div>
      </div>`;
    const company = p.querySelector<HTMLInputElement>('[data-a="company"]')!;
    company.value = m.company;
    company.onchange = () => this.h.onCompanyChange(company.value.trim());
    p.querySelector<HTMLElement>('[data-s="filled"]')!.textContent = String(m.filled);
    p.querySelector<HTMLElement>('[data-s="kept"]')!.textContent = String(m.kept);
    p.querySelector<HTMLElement>('[data-s="needs"]')!.textContent = String(m.needs.length);
    const list = p.querySelector('.needs')!;
    for (const n of m.needs) {
      const li = document.createElement('li');
      li.textContent = n.label || '(unlabelled field)';
      li.onclick = () => this.h.onFocusField(n.index);
      list.appendChild(li);
    }
    p.querySelectorAll<HTMLButtonElement>('[data-a]').forEach((b) => {
      const a = b.dataset.a;
      if (a === 'close') b.onclick = () => this.hidePanel();
      if (a === 'saveall') b.onclick = () => this.h.onSaveAll();
      if (a === 'fill') b.onclick = () => this.h.onFillAgain();
      if (a === 'applied') b.onclick = () => this.h.onMarkApplied();
    });
    this.panel = p;
    this.root.appendChild(p);
  }

  hidePanel() {
    this.panel?.remove();
    this.panel = null;
    this.badgeLayer.replaceChildren();
    this.badges = [];
  }

  toast(msg: string) {
    const t = this.panel?.querySelector('.toast');
    if (t) t.textContent = msg;
  }

  destroy() {
    clearInterval(this.timer);
    this.host.remove();
  }
}
