// Decides what to put in each field. Order:
//   1. resume upload      2. profile fields          3. strong saved-answer match (➕)
//   4. default rules      5. weaker saved-answer match
// Anything left over is marked "needs you".

import type { Decision, FieldInfo, Profile, SavedAnswer } from './types';
import { profileValue } from './profile';
import { applyRules, isConsentQuestion } from './rules';
import { fillTemplate, matchOption, similarity, templatize } from './text';

export const STRONG_MATCH = 0.8;
export const WEAK_MATCH = 0.6;

export interface BrainCtx {
  profile: Profile;
  answers: SavedAnswer[];
  company: string;
}

export function findSavedAnswer(question: string, answers: SavedAnswer[], company: string): { answer: SavedAnswer; score: number } | null {
  const q = templatize(question, company);
  let best: SavedAnswer | null = null;
  let bestScore = 0;
  for (const a of answers) {
    const s = similarity(q, a.question);
    if (s > bestScore) {
      bestScore = s;
      best = a;
    }
  }
  return best ? { answer: best, score: bestScore } : null;
}

const isChoice = (f: FieldInfo) => f.kind === 'select' || f.kind === 'radio' || (f.kind === 'checkbox' && f.options.length > 1);

/** Turn a raw answer into a value the field accepts (an option for choice fields). */
function fit(raw: string, f: FieldInfo): string | null {
  if (isChoice(f)) return matchOption(raw, f.options);
  if (f.kind === 'checkbox') {
    const v = raw.trim().toLowerCase();
    if (['yes', 'true', 'checked', 'y'].includes(v)) return 'Yes';
    if (['no', 'false', 'unchecked', 'n'].includes(v)) return 'No';
    return null;
  }
  if (f.kind === 'number') {
    const m = raw.match(/-?\d+(\.\d+)?/);
    return m ? m[0] : null;
  }
  return raw;
}

export function decide(f: FieldInfo, ctx: BrainCtx): Decision | null {
  const question = f.label || f.hints;
  if (!question) return null;

  if (f.kind === 'file') {
    return /\b(resume|cv|curriculum)\b/i.test(`${f.label} ${f.hints}`)
      ? { value: 'resume', source: 'resume', confidence: 1, reason: 'Your saved resume' }
      : null;
  }

  if (f.kind === 'checkbox' && f.options.length <= 1 && isConsentQuestion(question)) return null;

  if (!isChoice(f) && f.kind !== 'checkbox') {
    const p = profileValue(f.label, f.hints, ctx.profile);
    if (p) {
      const v = fit(p.value, f);
      if (v) return { value: v, source: 'profile', confidence: 0.95, reason: `Profile: ${p.key}` };
    }
  }

  const saved = findSavedAnswer(question, ctx.answers, ctx.company);
  const fromSaved = (): Decision | null => {
    if (!saved) return null;
    const v = fit(fillTemplate(saved.answer.answer, ctx.company), f);
    return v
      ? { value: v, source: 'memory', confidence: saved.score, reason: `Saved answer to: "${saved.answer.question}"`, answerId: saved.answer.id }
      : null;
  };

  if (saved && saved.score >= STRONG_MATCH) {
    const d = fromSaved();
    if (d) return d;
  }

  const rule = applyRules(question, { profile: ctx.profile, company: ctx.company, options: f.options });
  if (rule) {
    const v = fit(rule.value, f);
    if (v) return { value: v, source: 'rule', confidence: rule.confidence, reason: rule.reason };
  }

  // Choice fields that ask for a profile fact ("Gender", "Country", "Notice period" dropdowns).
  if (isChoice(f)) {
    const p = profileValue(f.label, f.hints, ctx.profile);
    if (p) {
      const v = fit(p.value, f);
      if (v) return { value: v, source: 'profile', confidence: 0.85, reason: `Profile: ${p.key}` };
    }
  }

  if (saved && saved.score >= WEAK_MATCH) return fromSaved();
  return null;
}
