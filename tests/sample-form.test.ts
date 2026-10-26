import { describe, expect, it } from 'vitest';
import html from '../test-pages/sample-form.html?raw';
import { scanFields } from '../src/content/scan';
import { decide } from '../src/shared/brain';
import { DEFAULT_PROFILE } from '../src/shared/profile';

// End to end over the local test page: scan every question, then decide each answer.
describe('test-pages/sample-form.html', () => {
  it('fills what it knows and leaves the rest for you', () => {
    document.documentElement.innerHTML = html.replace(/^[\s\S]*?<html[^>]*>/i, '').replace(/<\/html>\s*$/i, '');
    const ctx = { profile: DEFAULT_PROFILE, answers: [], company: 'Acme Robotics' };
    const got = Object.fromEntries(scanFields(document, false).map((f) => [f.info.label, decide(f.info, ctx)?.value ?? null]));

    expect(got).toEqual({
      'First Name': 'Nalam Guna Sri',
      'Last Name': 'Krishna',
      Email: 'nalamguna15@gmail.com',
      Phone: '+91 9515457530',
      'Location (City)': 'Bengaluru',
      'Resume/CV': 'resume',
      'Cover Letter': null,
      'LinkedIn Profile': 'http://www.linkedin.com/in/nalam-guna',
      Website: 'https://portfoliogunanalam.netlify.app/',
      'Current Company': 'Tessell',
      'What is your notice period?': 'Immediate',
      'Have you previously worked at Acme Robotics?': 'No',
      'Do you have any relatives currently working at Acme Robotics?': 'No',
      'Will you now or in the future require visa sponsorship to work in this role?': 'No',
      'Are you legally authorized to work in India?': 'Yes',
      'Why do you want to work at Acme Robotics?': null,
      'Tell us about a backend system you built and the hardest problem you solved in it.': null,
      Gender: 'Decline To Self Identify',
      'Veteran Status': "I don't wish to answer",
      'I agree to the processing of my personal data in accordance with the Privacy Policy.': null,
    });
  });
});
