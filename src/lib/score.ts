// The Whistle Score and its bands. Keep this the only place the formula lives.

// A score is said as "62% Whistle", the way people say "8.2 on IMDb".
// The bands are named after how loud the whistle is; `waves` is how many sound waves the band's icon shows.
export type Tier = { name: string; min: number; max: number; waves: 0 | 1 | 2 | 3; line: string; text: string };

export const TIERS: Tier[] = [
  { name: 'Full Whistle', min: 75, max: 100, waves: 3, line: 'The hall is on its feet.', text: 'The crowd loved it. Opening-day energy that lasted.' },
  { name: 'Whistle-worthy', min: 60, max: 74, waves: 2, line: 'Loud and happy.', text: 'Clearly positive, with a vocal minority against.' },
  { name: 'Half Whistle', min: 40, max: 59, waves: 1, line: 'Split down the aisle.', text: 'The house is split. Expect debate.' },
  { name: 'No Whistle', min: 0, max: 39, waves: 0, line: 'Crickets.', text: 'The conversation turned against the film.' },
];

/** 62 -> "62% Whistle" */
export const scoreLabel = (score: number) => `${score}% Whistle`;

export type Sentiment = { positive: number; neutral: number; negative: number };

// ---------- the formula ----------
//
//              positive + m·μ
//   Whistle = ───────────────────────── × 100
//             positive + negative + m
//
// 1. Neutral posts are left out. On social media they are mostly news ("trailer at 6pm", "tickets
//    booked"), not verdicts, so counting them as non-cheers marked films down for being talked about.
//    The question the Whistle answers: of the people who took a side, how many cheered?
// 2. Bayesian average. Every film starts from the catalog's typical cheer share μ, worth m posts. A
//    film with 20 opinionated posts sits near μ; one with 2,000 is almost entirely its own ratio. So
//    the more posts we read, the more the score is the film's own.

/** Posts that took a side: the evidence behind a Whistle. */
export const opinionated = (s: Sentiment) => s.positive + s.negative;

/** m: how many opinionated posts the catalog prior is worth. Past this, a film's own posts outweigh it. */
export const PRIOR_WEIGHT = 50;

// μ: the typical film's cheer share, each real film counted once (so blockbusters don't set it), worked
// out from the film files at build time. Sample films (invented numbers) and films with no opinionated
// posts are left out. Falls back to 0.7 before there are any real films.
const filmFiles = import.meta.glob<{ sample?: boolean; report?: { sentiment: Sentiment } | null }>(
  '../data/films/*.json',
  { eager: true, import: 'default' },
);
const ratios = Object.values(filmFiles)
  .filter((f) => !f.sample && f.report && opinionated(f.report.sentiment) > 0)
  .map((f) => f.report!.sentiment.positive / opinionated(f.report!.sentiment));
export const PRIOR_MEAN = ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : 0.7;

/** The Whistle as a 0-1 share, unrounded. */
export const whistleShare = (s: Sentiment, mean = PRIOR_MEAN) =>
  (s.positive + PRIOR_WEIGHT * mean) / (opinionated(s) + PRIOR_WEIGHT);

/** The Whistle, 0-100. See the formula above. */
export function whistleScore(s: Sentiment): number {
  return Math.round(whistleShare(s) * 100);
}

/** ± points around the Whistle (95% interval): about ±11 from 20 opinionated posts, ±2 from 1,000. */
export function whistleMargin(s: Sentiment): number {
  const p = whistleShare(s);
  return Math.round(196 * Math.sqrt((p * (1 - p)) / (opinionated(s) + PRIOR_WEIGHT)));
}

export function tierFor(score: number): Tier {
  return TIERS.find((t) => score >= t.min && score <= t.max) ?? TIERS[TIERS.length - 1];
}

export function sentimentShares(s: Sentiment) {
  const total = s.positive + s.neutral + s.negative || 1;
  return {
    positive: Math.round((s.positive / total) * 100),
    neutral: Math.round((s.neutral / total) * 100),
    negative: Math.round((s.negative / total) * 100),
  };
}

/** 3400 -> "3.4K", 30100000 -> "30.1M" */
export function compact(n: number): string {
  if (n >= 1e6) return `${+(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${+(n / 1e3).toFixed(1)}K`;
  return String(n);
}

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', ...opts });
}

export function daysBetween(start: string, end: string) {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000) + 1;
}
