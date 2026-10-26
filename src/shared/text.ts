// Text normalisation and similarity used to match a new question to a saved one.

const STOPWORDS = new Set([
  'a', 'an', 'the', 'of', 'to', 'in', 'on', 'for', 'at', 'by', 'with', 'and', 'or', 'is', 'are',
  'be', 'you', 'your', 'yours', 'do', 'does', 'did', 'have', 'has', 'had', 'please', 'this', 'that',
  'what', 'which', 'if', 'any', 'we', 'our', 'us', 'i', 'my', 'me', 'it', 'as', 'will', 'would',
  'can', 'could', 'should', 'kindly', 'mention', 'enter', 'provide', 'select', 'specify', 'e', 'g',
]);

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Replace the hiring company's name with a {company} placeholder. */
export function templatize(text: string, company: string): string {
  const c = company.trim();
  if (c.length < 2) return text;
  return text.replace(new RegExp(`\\b${escapeRegExp(c)}\\b`, 'gi'), '{company}');
}

/** Put the hiring company's name back into a saved answer. */
export function fillTemplate(text: string, company: string): string {
  return text.replace(/\{company\}/g, company || 'your company');
}

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/\{company\}/g, ' companyx ')
    .replace(/\*/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokens(text: string): string[] {
  return normalize(text)
    .split(' ')
    .filter((t) => t && !STOPWORDS.has(t))
    .map(stem);
}

/** Tiny suffix stripper so "worked"/"working"/"works" compare equal. */
function stem(t: string): string {
  if (t.length > 5 && t.endsWith('ing')) return t.slice(0, -3);
  if (t.length > 4 && t.endsWith('ed')) return t.slice(0, -2);
  if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss')) return t.slice(0, -1);
  return t;
}

function trigrams(text: string): Set<string> {
  const s = ` ${normalize(text)} `;
  const out = new Set<string>();
  for (let i = 0; i + 3 <= s.length; i++) out.add(s.slice(i, i + 3));
  return out;
}

function jaccard<T>(a: Set<T>, b: Set<T>): number {
  if (!a.size && !b.size) return 1;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

/** 0..1 similarity between two questions: token overlap blended with character trigrams. */
export function similarity(a: string, b: string): number {
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  return 0.6 * jaccard(ta, tb) + 0.4 * jaccard(trigrams(a), trigrams(b));
}

/** Pick the option that best matches a desired answer. Returns null if nothing fits. */
export function matchOption(desired: string, options: string[]): string | null {
  if (!options.length) return null;
  const d = normalize(desired);
  if (!d) return null;
  const exact = options.find((o) => normalize(o) === d);
  if (exact) return exact;
  // Yes/No style answers: match options that start with yes/no ("Yes, I am authorised...").
  if (d === 'yes' || d === 'no') {
    const hit = options.find((o) => normalize(o).split(' ')[0] === d);
    return hit ?? null;
  }
  const contains = options.find((o) => {
    const n = normalize(o);
    return n && (n.includes(d) || d.includes(n));
  });
  if (contains) return contains;
  let best: string | null = null;
  let bestScore = 0;
  for (const o of options) {
    const s = similarity(o, desired);
    if (s > bestScore) {
      bestScore = s;
      best = o;
    }
  }
  return bestScore >= 0.45 ? best : null;
}
