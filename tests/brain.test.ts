import { describe, expect, it } from 'vitest';
import { decide, findSavedAnswer, STRONG_MATCH, WEAK_MATCH, type BrainCtx } from '../src/shared/brain';
import { DEFAULT_PROFILE } from '../src/shared/profile';
import type { FieldInfo, SavedAnswer } from '../src/shared/types';

const field = (label: string, kind: FieldInfo['kind'] = 'text', options: string[] = [], hints = ''): FieldInfo => ({
  kind,
  label,
  hints,
  options,
  required: false,
});

const saved = (question: string, answer: string, id = question): SavedAnswer => ({ id, question, answer, uses: 0, updatedAt: 0 });

const ctx = (answers: SavedAnswer[] = [], company = 'Acme'): BrainCtx => ({ profile: DEFAULT_PROFILE, answers, company });

describe('decide', () => {
  it('uploads the resume to resume/CV file inputs only', () => {
    expect(decide(field('Resume/CV', 'file'), ctx())?.source).toBe('resume');
    expect(decide(field('Attach', 'file', [], 'resume'), ctx())?.source).toBe('resume');
    expect(decide(field('Cover Letter', 'file'), ctx())).toBeNull();
  });

  it('fills profile fields from the label, or from hints when the label is empty', () => {
    expect(decide(field('First Name'), ctx())).toMatchObject({ value: 'Nalam Guna Sri', source: 'profile' });
    expect(decide(field('Last Name'), ctx())?.value).toBe('Krishna');
    expect(decide(field('Email', 'email'), ctx())?.value).toBe('nalamguna15@gmail.com');
    expect(decide(field('LinkedIn Profile', 'url'), ctx())?.value).toBe('http://www.linkedin.com/in/nalam-guna');
    expect(decide(field('', 'tel', [], 'phone number'), ctx())?.value).toBe('+91 9515457530');
    expect(decide(field('Name'), ctx())?.value).toBe('Nalam Guna Sri Krishna');
  });

  it('extracts numbers for number fields', () => {
    expect(decide(field('Total years of experience', 'number'), ctx())?.value).toBe('1.2');
  });

  it('does not fill a profile field that is blank in the profile', () => {
    expect(decide(field('Expected CTC'), ctx())).toBeNull();
  });

  it('never ticks consent checkboxes', () => {
    expect(decide(field('I agree to the terms and privacy policy', 'checkbox'), ctx())).toBeNull();
  });

  it('answers worked-here-before radios with the rule', () => {
    const d = decide(field('Have you ever worked for Acme before?', 'radio', ['Yes', 'No']), ctx());
    expect(d).toMatchObject({ value: 'No', source: 'rule' });
  });

  it('prefers a strong saved answer over the default rule', () => {
    const answers = [saved('Have you ever worked for {company} before?', 'Yes')];
    const d = decide(field('Have you ever worked for Acme before?', 'radio', ['Yes', 'No']), ctx(answers));
    expect(d).toMatchObject({ value: 'Yes', source: 'memory', answerId: answers[0].id });
  });

  it('fills the company name into saved answers', () => {
    const answers = [saved('Why do you want to work at {company}?', 'I like what {company} builds.')];
    const d = decide(field('Why do you want to work at Globex?', 'textarea'), ctx(answers, 'Globex'));
    expect(d).toMatchObject({ value: 'I like what Globex builds.', source: 'memory' });
    expect(d!.confidence).toBeGreaterThanOrEqual(STRONG_MATCH);
  });

  it('uses a weak saved match only after rules, and nothing below the weak threshold', () => {
    const answers = [saved('Why are you interested in this role at {company}?', 'Backend work.')];
    const q = 'Why are you interested in this role?';
    const score = findSavedAnswer(q, answers, 'Acme')!.score;
    expect(score).toBeGreaterThanOrEqual(WEAK_MATCH);
    expect(score).toBeLessThan(STRONG_MATCH);
    expect(decide(field(q, 'textarea'), ctx(answers))).toMatchObject({ value: 'Backend work.', source: 'memory' });

    expect(decide(field('Describe your favourite data structure', 'textarea'), ctx(answers))).toBeNull();
  });

  it('maps choice answers onto the available options', () => {
    const d = decide(field('Will you require visa sponsorship?', 'select', ['Yes, I will', 'No, I will not']), ctx());
    expect(d?.value).toBe('No, I will not');
  });

  it('fills profile facts into dropdowns', () => {
    const d = decide(field('Country', 'select', ['United States', 'India', 'Canada']), ctx());
    expect(d).toMatchObject({ value: 'India', source: 'profile' });
  });

  it('declines self-ID dropdowns', () => {
    const d = decide(field('Veteran Status', 'select', ['I am a veteran', 'I am not a veteran', "I don't wish to answer"]), ctx());
    expect(d?.value).toBe("I don't wish to answer");
  });

  it('marks unknown questions as needing the user', () => {
    expect(decide(field('Tell us about a hard bug you fixed', 'textarea'), ctx())).toBeNull();
    expect(decide(field(''), ctx())).toBeNull();
  });
});
