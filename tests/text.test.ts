import { describe, expect, it } from 'vitest';
import { fillTemplate, matchOption, normalize, similarity, templatize, tokens } from '../src/shared/text';

describe('normalize / tokens', () => {
  it('lowercases, strips punctuation and required-asterisks', () => {
    expect(normalize('  First Name *  ')).toBe('first name');
    expect(normalize("Don't wish to answer!")).toBe('don t wish to answer');
  });

  it('drops stopwords and stems simple suffixes', () => {
    expect(tokens('Have you worked here?')).toEqual(['work', 'here']);
    expect(tokens('Are you working')).toEqual(['work']);
  });
});

describe('company templates', () => {
  it('replaces the company name in any case and puts it back', () => {
    const t = templatize('Why do you want to join ACME? Acme is great.', 'Acme');
    expect(t).toBe('Why do you want to join {company}? {company} is great.');
    expect(fillTemplate(t, 'Globex')).toBe('Why do you want to join Globex? Globex is great.');
  });

  it('only replaces whole words', () => {
    expect(templatize('Acmeville office', 'Acme')).toBe('Acmeville office');
  });

  it('leaves text alone when the company is unknown', () => {
    expect(templatize('Why us?', '')).toBe('Why us?');
    expect(fillTemplate('Why {company}?', '')).toBe('Why your company?');
  });
});

describe('similarity', () => {
  it('is 1 for identical questions and symmetric', () => {
    expect(similarity('Why do you want to work here?', 'Why do you want to work here?')).toBeCloseTo(1);
    const a = 'Have you worked at {company} before?';
    const b = 'Have you previously worked for {company}?';
    expect(similarity(a, b)).toBeCloseTo(similarity(b, a));
  });

  it('scores rephrasings above unrelated questions', () => {
    const q = 'Have you previously worked at {company}?';
    const close = similarity(q, 'Have you worked at {company} previously?');
    const far = similarity(q, 'What is your expected salary?');
    expect(close).toBeGreaterThan(0.8);
    expect(far).toBeLessThan(0.3);
  });
});

describe('matchOption', () => {
  const yesNo = ['Yes', 'No'];
  it('matches exact options ignoring case', () => {
    expect(matchOption('yes', yesNo)).toBe('Yes');
  });

  it('matches yes/no to options that start with yes/no', () => {
    const opts = ['Yes, I am authorised to work in India', 'No, I will need sponsorship'];
    expect(matchOption('No', opts)).toBe(opts[1]);
    expect(matchOption('Yes', opts)).toBe(opts[0]);
  });

  it('matches by containment, then by similarity', () => {
    expect(matchOption('India', ['United States', 'India (IN)'])).toBe('India (IN)');
    expect(matchOption('Bachelors of Technology', ['Bachelor of Technology', 'Master of Science'])).toBe('Bachelor of Technology');
  });

  it('returns null when nothing fits', () => {
    expect(matchOption('Maybe', yesNo)).toBeNull();
    expect(matchOption('Yes', [])).toBeNull();
    expect(matchOption('Zebra', ['Apple', 'Banana'])).toBeNull();
  });
});
