// Detects the hiring company and job title from the current page.

const pretty = (slug: string) =>
  decodeURIComponent(slug)
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

const IGNORED_HOST_LABELS = new Set(['www', 'careers', 'career', 'jobs', 'job', 'apply', 'boards', 'hire', 'talent', 'recruit', 'join', 'work']);

export function companyFromUrl(href: string): string {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return '';
  }
  const host = url.hostname.toLowerCase();
  const seg = url.pathname.split('/').filter(Boolean);

  const forParam = url.searchParams.get('for'); // Greenhouse embeds: /embed/job_app?for=acme
  if (host.includes('greenhouse.io') && forParam) return pretty(forParam);

  const pathBoards = ['greenhouse.io', 'lever.co', 'ashbyhq.com', 'smartrecruiters.com', 'workable.com', 'wellfound.com'];
  if (pathBoards.some((b) => host.endsWith(b)) && seg[0] && seg[0] !== 'embed') return pretty(seg[0]);

  const subdomainBoards = ['myworkdayjobs.com', 'recruitee.com', 'darwinbox.in', 'freshteam.com', 'keka.com', 'zohorecruit.com', 'zohorecruit.in', 'bamboohr.com', 'breezy.hr'];
  if (subdomainBoards.some((b) => host.endsWith(b))) return pretty(host.split('.')[0]);

  // Company career site, e.g. careers.razorpay.com → Razorpay
  const labels = host.split('.').filter((l) => !IGNORED_HOST_LABELS.has(l));
  if (labels.length >= 2) return pretty(labels[labels.length - 2]);
  return '';
}

export function detectCompany(doc: Document = document, href: string = location.href): string {
  const fromUrl = companyFromUrl(href);
  if (fromUrl) return fromUrl;
  const site = doc.querySelector<HTMLMetaElement>('meta[property="og:site_name"]')?.content?.trim();
  return site ?? '';
}

export function detectJobTitle(doc: Document = document): string {
  const h1 = doc.querySelector('h1')?.textContent?.trim();
  if (h1 && h1.length < 120) return h1;
  const og = doc.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content?.trim();
  return og || doc.title.trim();
}
