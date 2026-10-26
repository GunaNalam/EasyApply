import type { Profile } from './types';
import { normalize } from './text';

/** Starting profile, prefilled from the resume. Editable in the side panel. */
export const DEFAULT_PROFILE: Profile = {
  firstName: 'Nalam Guna Sri',
  lastName: 'Krishna',
  fullName: 'Nalam Guna Sri Krishna',
  email: 'nalamguna15@gmail.com',
  phone: '+91 9515457530',
  city: 'Bengaluru',
  state: 'Karnataka',
  country: 'India',
  linkedin: 'http://www.linkedin.com/in/nalam-guna',
  github: 'https://github.com/GunaNalam',
  portfolio: 'https://portfoliogunanalam.netlify.app/',
  currentCompany: 'Tessell',
  currentTitle: 'Software Development Engineer 1',
  totalExperienceYears: '1.2',
  noticePeriod: 'Immediate',
  currentCtc: '',
  expectedCtc: '',
  pastCompanies: ['Tessell', 'Siemens EDA', 'Siemens'],
  college: 'Vellore Institute of Technology, Vellore',
  degree: 'Bachelor of Technology',
  major: 'Computer Science and Engineering',
  graduationYear: '2025',
  cgpa: '9.17',
  skills:
    'Java, Spring Boot, Go, Python, C++, SQL, PostgreSQL, MongoDB, Redis, AWS, GCP, Docker, Kubernetes, Microservices, REST APIs',
  gender: '',
  referralSource: 'LinkedIn',
};

export const PROFILE_LABELS: Record<keyof Profile, string> = {
  firstName: 'First name',
  lastName: 'Last name',
  fullName: 'Full name',
  email: 'Email',
  phone: 'Phone',
  city: 'City',
  state: 'State',
  country: 'Country',
  linkedin: 'LinkedIn URL',
  github: 'GitHub URL',
  portfolio: 'Portfolio / website',
  currentCompany: 'Current / last company',
  currentTitle: 'Current / last title',
  totalExperienceYears: 'Total experience (years)',
  noticePeriod: 'Notice period',
  currentCtc: 'Current CTC',
  expectedCtc: 'Expected CTC',
  pastCompanies: 'Past companies (comma separated)',
  college: 'College',
  degree: 'Degree',
  major: 'Major / branch',
  graduationYear: 'Graduation year',
  cgpa: 'CGPA',
  skills: 'Skills',
  gender: 'Gender (leave blank to skip)',
  referralSource: '"How did you hear about us" default',
};

interface Mapping {
  key: keyof Profile;
  /** Tested against the normalised label + hints. */
  test: RegExp;
  /** If this matches, the mapping is skipped (e.g. "referrer email"). */
  exclude?: RegExp;
}

// Order matters: more specific patterns first.
const MAPPINGS: Mapping[] = [
  { key: 'firstName', test: /\b(first name|given name|fname|firstname)\b/ },
  { key: 'lastName', test: /\b(last name|surname|family name|lname|lastname)\b/ },
  { key: 'email', test: /\be ?mail\b/, exclude: /\b(referr|recruiter|manager|reference)/ },
  { key: 'phone', test: /\b(phone|mobile|contact number|cell|whatsapp)\b/, exclude: /\b(referr|reference)/ },
  { key: 'linkedin', test: /\blinked ?in\b/ },
  { key: 'github', test: /\bgit ?hub\b/ },
  { key: 'portfolio', test: /\b(portfolio|personal website|website|personal site|blog)\b/ },
  { key: 'expectedCtc', test: /\b(expected|desired|expectation)\b.*\b(ctc|salary|compensation|pay)\b|\b(salary|ctc|compensation) expect/ },
  { key: 'currentCtc', test: /\b(current|present|last)\b.*\b(ctc|salary|compensation|pay)\b/ },
  { key: 'noticePeriod', test: /\bnotice period\b|\bearliest start\b|\bhow soon can you join\b/ },
  { key: 'totalExperienceYears', test: /\b(years of|total|overall|relevant) (work |professional |industry )?experience\b|\bexperience in years\b|\bhow many years\b/ },
  { key: 'currentTitle', test: /\b(current|present|last|most recent) (job )?(title|role|designation|position)\b|\bdesignation\b/ },
  { key: 'currentCompany', test: /\b(current|present|last|most recent) (company|employer|organi[sz]ation)\b|\bemployer name\b/ },
  { key: 'graduationYear', test: /\b(graduation year|year of graduation|passing year|year of passing|grad year|batch)\b/ },
  { key: 'cgpa', test: /\b(cgpa|gpa|cpi|aggregate|percentage)\b/ },
  { key: 'major', test: /\b(major|discipline|field of study|specialization|specialisation|branch|stream)\b/ },
  { key: 'degree', test: /\b(degree|qualification)\b/ },
  { key: 'college', test: /\b(college|university|institute|institution|school)\b/ },
  { key: 'state', test: /\b(state|province)\b/, exclude: /\bstatement\b/ },
  { key: 'country', test: /\bcountry\b/, exclude: /\b(code|dial)\b/ },
  { key: 'city', test: /\b(city|current location|location|where are you based|town)\b/, exclude: /\b(prefer|willing|relocat|open to)\b/ },
  { key: 'gender', test: /\bgender\b/ },
  { key: 'referralSource', test: /\bhow did you (hear|find|learn)\b|\bsource\b/ },
  { key: 'skills', test: /\b(key )?skills\b/ },
];

const FULL_NAME = /^(your |full |legal |candidate |applicant )?name$/;

/** Find the profile value for a field, if the field is clearly asking for one. */
export function profileValue(label: string, hints: string, p: Profile): { key: keyof Profile; value: string } | null {
  const l = normalize(label);
  const text = `${l} ${normalize(hints)}`;
  if (FULL_NAME.test(l) || /\b(full name|fullname|legal name)\b/.test(text)) {
    return p.fullName ? { key: 'fullName', value: p.fullName } : null;
  }
  for (const m of MAPPINGS) {
    // Labels win over hints; hints are only used when the label says nothing.
    const hay = l || text;
    if (!m.test.test(hay)) continue;
    if (m.exclude?.test(hay)) continue;
    const raw = p[m.key];
    const value = Array.isArray(raw) ? raw.join(', ') : raw;
    return value ? { key: m.key, value } : null;
  }
  return null;
}
