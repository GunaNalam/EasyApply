// Content script entry: runs on every page (and every iframe, so embedded Greenhouse forms work).

import { decide } from '../shared/brain';
import { addApplication, loadState, saveAnswers, upsertAnswer } from '../shared/storage';
import { FILL_MESSAGE, type FillResult } from '../shared/messages';
import { templatize } from '../shared/text';
import type { Decision, SavedAnswer } from '../shared/types';
import { detectCompany, detectJobTitle } from './company';
import { applyValue, currentAnswer, hasValue } from './fill';
import { scanFields, type ScannedField } from './scan';
import { Overlay, type BadgeModel, type FieldStatus } from './ui';

const MIN_FIELDS_FOR_PILL = 3;

interface Session {
  fields: ScannedField[];
  decisions: (Decision | null)[];
  statuses: FieldStatus[];
  company: string;
}

let overlay: Overlay | null = null;
let session: Session | null = null;
let companyOverride = '';

function ui(): Overlay {
  overlay ??= new Overlay({
    onSave: (i) => void saveOne(i),
    onSaveAll: () => void saveAll(),
    onFillAgain: () => void runFill(),
    onMarkApplied: () => void markApplied(),
    onCompanyChange: (name) => {
      companyOverride = name;
      void runFill();
    },
    onFocusField: (i) => {
      const f = session?.fields[i];
      if (!f) return;
      f.anchor.scrollIntoView({ behavior: 'smooth', block: 'center' });
      (f.els[0] as HTMLElement).focus({ preventScroll: true });
    },
    onPillClick: () => void runFill(),
  });
  return overlay;
}

export async function runFill(): Promise<FillResult> {
  const state = await loadState();
  const company = companyOverride || detectCompany();
  const fields = scanFields();
  const decisions: (Decision | null)[] = [];
  const statuses: FieldStatus[] = [];
  const usedAnswerIds = new Set<string>();

  for (const f of fields) {
    if (hasValue(f)) {
      decisions.push(null);
      statuses.push('kept');
      continue;
    }
    const d = decide(f.info, { profile: state.profile, answers: state.answers, company });
    if (d && applyValue(f, d.value, state.resume)) {
      decisions.push(d);
      statuses.push(d.source);
      if (d.answerId) usedAnswerIds.add(d.answerId);
    } else {
      decisions.push(null);
      statuses.push('needs');
    }
  }

  if (usedAnswerIds.size) {
    const answers: SavedAnswer[] = state.answers.map((a) => (usedAnswerIds.has(a.id) ? { ...a, uses: a.uses + 1 } : a));
    await saveAnswers(answers);
  }

  session = { fields, decisions, statuses, company };
  const o = ui();
  o.setBadges(fields.map((f, i) => badgeModel(f, decisions[i], statuses[i])));
  const needs = statuses.flatMap((s, i) => (s === 'needs' ? [{ label: fields[i].info.label, index: i }] : []));
  const filled = statuses.filter((s) => s !== 'needs' && s !== 'kept').length;
  const kept = statuses.filter((s) => s === 'kept').length;
  o.showPanel({ company, filled, kept, needs, lowConfidence: decisions.filter((d) => d && d.confidence < 0.8).length });
  return { filled, kept, needs: needs.length };
}

function badgeModel(f: ScannedField, d: Decision | null, status: FieldStatus): BadgeModel {
  const savable = f.info.kind !== 'file' && status !== 'profile' && status !== 'resume';
  const reason =
    status === 'needs' ? 'No answer found. Fill it, then press + to remember it.' : status === 'kept' ? 'Already had a value; left as is.' : d?.reason ?? '';
  return { anchor: f.anchor, status, reason, savable, lowConfidence: !!d && d.confidence < 0.8 };
}

async function persistAnswer(answers: SavedAnswer[], f: ScannedField, company: string): Promise<SavedAnswer[] | null> {
  const ans = currentAnswer(f);
  const question = f.info.label;
  if (!ans || !question) return null;
  return upsertAnswer(answers, templatize(question, company), templatize(ans, company));
}

async function saveOne(i: number) {
  if (!session) return;
  const f = session.fields[i];
  const { answers } = await loadState();
  const next = await persistAnswer(answers, f, session.company);
  if (!next) {
    ui().toast('Fill that field first, then press +.');
    return;
  }
  await saveAnswers(next);
  ui().updateBadge(i, { status: 'saved', reason: 'Saved for future applications', lowConfidence: false });
  ui().toast(`Saved: "${f.info.label.slice(0, 60)}"`);
}

async function saveAll() {
  if (!session) return;
  let { answers } = await loadState();
  let count = 0;
  for (let i = 0; i < session.fields.length; i++) {
    const s = session.statuses[i];
    const f = session.fields[i];
    if (s === 'profile' || s === 'resume' || f.info.kind === 'file') continue;
    const next = await persistAnswer(answers, f, session.company);
    if (!next) continue;
    answers = next;
    count++;
    ui().updateBadge(i, { status: 'saved', reason: 'Saved for future applications', lowConfidence: false });
  }
  await saveAnswers(answers);
  ui().toast(`Saved ${count} answers. Now review and submit on the site.`);
}

async function markApplied() {
  const added = await addApplication({ company: session?.company || detectCompany(), title: detectJobTitle(), url: location.href });
  ui().toast(added ? 'Logged in your applications list.' : 'Already logged today.');
}

// Log the application when the user submits a form we filled.
document.addEventListener(
  'submit',
  () => {
    if (session) void addApplication({ company: session.company, title: detectJobTitle(), url: location.href });
  },
  true,
);

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== FILL_MESSAGE) return false;
  // Only frames that actually contain a form answer, so the side panel hears from the right one.
  if (scanFields().length === 0) return false;
  runFill().then(sendResponse, (e) => sendResponse({ error: String(e) }));
  return true;
});

// Offer the floating "Autofill" button on pages that look like application forms.
let pillTimer = 0;
const observer = new MutationObserver(() => {
  clearTimeout(pillTimer);
  pillTimer = window.setTimeout(checkForForm, 1200);
});
const JOBBY = /\b(apply|application|applicant|candidate|career|careers|job|jobs|resume|cv|hiring|recruit)/i;
function looksLikeApplication(fields: ScannedField[]): boolean {
  if (fields.some((f) => f.info.kind === 'file' && /resume|cv/i.test(f.info.label + f.info.hints))) return true;
  return JOBBY.test(location.href) || JOBBY.test(document.title);
}
function checkForForm() {
  if (session) return;
  const fields = scanFields();
  if (fields.filter((f) => f.info.kind !== 'file').length >= MIN_FIELDS_FOR_PILL && looksLikeApplication(fields)) {
    ui().showPill();
    observer.disconnect();
  }
}
observer.observe(document.documentElement, { childList: true, subtree: true });
checkForForm();
