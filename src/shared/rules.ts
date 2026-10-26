// Default answers for common screening questions, derived from the profile.
// Saved answers (➕) that closely match a question take priority over these.

import type { Profile } from './types';
import { escapeRegExp, normalize } from './text';

export interface RuleAnswer {
  value: string;
  confidence: number;
  reason: string;
}

interface RuleCtx {
  profile: Profile;
  /** Hiring company's name, as detected on the page. */
  company: string;
  options: string[];
}

function mentions(text: string, name: string): boolean {
  const n = normalize(name);
  return n.length > 1 && new RegExp(`\\b${escapeRegExp(n)}\\b`).test(text);
}

function isPastCompany(name: string, p: Profile): boolean {
  const n = normalize(name);
  if (!n) return false;
  return p.pastCompanies.some((c) => {
    const pc = normalize(c);
    return pc && (pc === n || n.startsWith(pc + ' ') || pc.startsWith(n + ' '));
  });
}

const DECLINE = /\b(decline|prefer not|do not wish|don t wish|not to (say|disclose|answer)|rather not)\b/;

type Rule = (q: string, ctx: RuleCtx) => RuleAnswer | null;

const RULES: Rule[] = [
  // "Have you previously worked at {company}?" → No unless the company is on the resume.
  (q, { profile, company }) => {
    const workedBefore =
      /\b(previously|ever|formerly|before|prior|past)\b.*\b(work|worked|employed|employee|intern|interned)\b/.test(q) ||
      /\b(work|worked|employed|interned)\b.*\b(previously|before|formerly|in the past|prior)\b/.test(q) ||
      /\b(former|ex) (employee|intern)\b/.test(q) ||
      /\bare you an? (current |former )?(employee|alumn)/.test(q);
    if (!workedBefore) return null;
    const pastHit = profile.pastCompanies.find((c) => mentions(q, c));
    if (pastHit) return { value: 'Yes', confidence: 0.9, reason: `${pastHit} is on your resume` };
    if (company && isPastCompany(company, profile)) {
      return { value: 'Yes', confidence: 0.85, reason: `${company} is on your resume` };
    }
    return { value: 'No', confidence: 0.9, reason: 'Company is not on your resume' };
  },
  // Relatives / friends working at the company.
  (q) =>
    /\b(relative|relatives|family|related|spouse|friend|friends)\b/.test(q) && /\b(work|working|employ|employed)\b/.test(q)
      ? { value: 'No', confidence: 0.85, reason: 'Default: no relatives there' }
      : null,
  // Applied / interviewed before.
  (q) =>
    /\b(previously|already|ever|before|past)\b.*\b(applied|interviewed)\b/.test(q) || /\b(applied|interviewed)\b.*\b(before|previously|past)\b/.test(q)
      ? { value: 'No', confidence: 0.7, reason: 'Default: first application here' }
      : null,
  // Visa sponsorship.
  (q) =>
    /\b(sponsor|sponsorship|visa)\b/.test(q)
      ? { value: 'No', confidence: 0.8, reason: 'Assumes an India-based role' }
      : null,
  // Work authorisation.
  (q) =>
    /\b(authori[sz]ed|eligible|legally|right) to work\b|\bwork (permit|authori[sz]ation)\b/.test(q)
      ? { value: 'Yes', confidence: 0.8, reason: 'Assumes an India-based role' }
      : null,
  // Relocation.
  (q) => (/\brelocat/.test(q) ? { value: 'Yes', confidence: 0.75, reason: 'Default: open to relocate' } : null),
  // Currently employed?
  (q, { profile }) =>
    /\b(currently|presently) (employed|working)\b|\bare you employed\b/.test(q)
      ? { value: /immediate/i.test(profile.noticePeriod) ? 'No' : 'Yes', confidence: 0.75, reason: 'From notice period' }
      : null,
  // Can you join immediately / within N days?
  (q, { profile }) =>
    /\b(join|start)\b.*\b(immediately|immediate|asap|within|short notice)\b/.test(q) && /immediate/i.test(profile.noticePeriod)
      ? { value: 'Yes', confidence: 0.85, reason: 'Notice period: immediate' }
      : null,
  // Age.
  (q) =>
    /\b(18|eighteen) years\b|\blegal age\b|\bover 18\b/.test(q) ? { value: 'Yes', confidence: 0.9, reason: 'Age check' } : null,
  // Background verification.
  (q) =>
    /\bbackground (check|verification|screening)\b/.test(q)
      ? { value: 'Yes', confidence: 0.8, reason: 'Default: agree to background check' }
      : null,
  // Non-compete / bound by an agreement.
  (q) =>
    /\bnon ?(compete|solicitation)\b|\bbound by\b.*\bagreement\b/.test(q)
      ? { value: 'No', confidence: 0.75, reason: 'Default: no restrictive agreements' }
      : null,
  // Voluntary self-identification: pick the decline option if there is one.
  // Gender counts too, unless the profile has one (then the profile fills it).
  (q, { options, profile }) => {
    const selfId =
      /\b(disability|veteran|ethnicity|race|hispanic|latino|sexual orientation|gender identity|pronoun|caste|religion)\b/.test(q) ||
      (!profile.gender && /\bgender\b/.test(q));
    if (!selfId) return null;
    const decline = options.find((o) => DECLINE.test(normalize(o)));
    return decline ? { value: decline, confidence: 0.7, reason: 'Voluntary self-ID: declined' } : null;
  },
];

/** First matching default rule for a question, or null. */
export function applyRules(question: string, ctx: RuleCtx): RuleAnswer | null {
  const q = normalize(question);
  for (const rule of RULES) {
    const hit = rule(q, ctx);
    if (hit) return hit;
  }
  return null;
}

/** Consent / terms checkboxes are never ticked automatically. */
export function isConsentQuestion(question: string): boolean {
  return /\b(i agree|agree to|consent|terms|privacy policy|acknowledge|certify|declare|confirm that)\b/.test(normalize(question));
}
