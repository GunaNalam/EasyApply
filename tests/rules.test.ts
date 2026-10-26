import { describe, expect, it } from 'vitest';
import { applyRules, isConsentQuestion } from '../src/shared/rules';
import { DEFAULT_PROFILE } from '../src/shared/profile';

const ctx = (company = 'Acme', options: string[] = []) => ({ profile: DEFAULT_PROFILE, company, options });
const ans = (q: string, company?: string, options?: string[]) => applyRules(q, ctx(company, options))?.value ?? null;

describe('worked here before', () => {
  it('answers No for a company not on the resume', () => {
    expect(ans('Have you ever worked for Acme before?')).toBe('No');
    expect(ans('Are you a former employee of Acme?')).toBe('No');
    expect(ans('Have you previously been employed by us?')).toBe('No');
  });

  it('answers Yes when the hiring company is a past company', () => {
    expect(ans('Have you previously worked at this company?', 'Tessell')).toBe('Yes');
    expect(ans('Have you worked here before?', 'Siemens EDA')).toBe('Yes');
  });

  it('answers Yes when the question names a past company', () => {
    expect(ans('Have you previously worked at Siemens or any of its subsidiaries?')).toBe('Yes');
  });
});

describe('screening defaults', () => {
  it.each([
    ['Do you have any relatives or friends working at Acme?', 'No'],
    ['Will you now or in the future require visa sponsorship?', 'No'],
    ['Are you legally authorized to work in India?', 'Yes'],
    ['Are you willing to relocate to Hyderabad?', 'Yes'],
    ['Have you applied to Acme before?', 'No'],
    ['Are you over 18 years of age?', 'Yes'],
    ['Do you consent to a background check?', 'Yes'],
  ])('%s → %s', (q, expected) => {
    expect(ans(q)).toBe(expected);
  });

  it('has no answer for open questions', () => {
    expect(ans('Why do you want to work at Acme?')).toBeNull();
    expect(ans('Tell us about a project you are proud of')).toBeNull();
  });
});

describe('voluntary self-identification', () => {
  it('picks the decline option', () => {
    const opts = ['I am a protected veteran', 'I am not a protected veteran', "I don't wish to answer"];
    expect(ans('Veteran Status', 'Acme', opts)).toBe("I don't wish to answer");
    expect(ans('Disability status', 'Acme', ['Yes', 'No', 'Prefer not to say'])).toBe('Prefer not to say');
  });

  it('declines gender only while the profile has no gender', () => {
    const opts = ['Male', 'Female', 'Decline to self-identify'];
    expect(ans('Gender', 'Acme', opts)).toBe('Decline to self-identify');
    expect(applyRules('Gender', { profile: { ...DEFAULT_PROFILE, gender: 'Male' }, company: 'Acme', options: opts })).toBeNull();
  });

  it('has no answer without a decline option', () => {
    expect(ans('Race / ethnicity', 'Acme', ['Asian', 'White'])).toBeNull();
  });
});

describe('consent', () => {
  it('recognises consent and terms checkboxes', () => {
    expect(isConsentQuestion('I agree to the Privacy Policy')).toBe(true);
    expect(isConsentQuestion('I certify that the information above is true')).toBe(true);
    expect(isConsentQuestion('Willing to relocate')).toBe(false);
  });
});
