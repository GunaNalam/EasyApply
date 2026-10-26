// Core data shapes shared by the content script, side panel and background worker.

export interface Profile {
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  country: string;
  linkedin: string;
  github: string;
  portfolio: string;
  currentCompany: string;
  currentTitle: string;
  /** Total professional experience in years, e.g. "1.2". */
  totalExperienceYears: string;
  noticePeriod: string;
  currentCtc: string;
  expectedCtc: string;
  /** Every company that appears on the resume. Drives "have you worked at X before?" answers. */
  pastCompanies: string[];
  college: string;
  degree: string;
  major: string;
  graduationYear: string;
  cgpa: string;
  skills: string;
  gender: string;
  /** Free-form "how did you hear about us" default. */
  referralSource: string;
}

/** A question the user approved an answer for (saved with the ➕ button). */
export interface SavedAnswer {
  id: string;
  /** Question as it appeared, with the company name replaced by {company}. */
  question: string;
  /** Answer, with the company name replaced by {company}. */
  answer: string;
  /** How many times this answer has been reused. */
  uses: number;
  updatedAt: number;
}

export type FieldKind =
  | 'text'
  | 'email'
  | 'tel'
  | 'url'
  | 'number'
  | 'date'
  | 'textarea'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'file';

/** Everything the brain needs to know about one form question. */
export interface FieldInfo {
  kind: FieldKind;
  /** Best human-readable question text for the field. */
  label: string;
  /** name/id/autocomplete hints, useful when the label is vague. */
  hints: string;
  /** Visible option texts for select/radio/checkbox-group fields. */
  options: string[];
  required: boolean;
}

export type AnswerSource = 'profile' | 'rule' | 'memory' | 'resume';

export interface Decision {
  /** Text value, or option text for choice fields. "Yes"/"No" for checkboxes. */
  value: string;
  source: AnswerSource;
  /** 0..1, shown to the user so weak matches get reviewed. */
  confidence: number;
  /** Short explanation shown on hover. */
  reason: string;
  /** Set when the value came from a saved answer. */
  answerId?: string;
}

export interface StoredResume {
  name: string;
  type: string;
  /** base64 (no data: prefix) */
  data: string;
}
