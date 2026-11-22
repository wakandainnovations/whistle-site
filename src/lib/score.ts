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
//              positive + w·neutral + m·μ
//   Whistle = ─────────────────────────── × 100
//                   all posts + m
//
// 1. A neutral post counts as w of a cheer, ⅓ to ½ depending on how much talk there is (neutralWeight).
//    Neutral posts are partly news and promotion ("5 days to go"), partly lukewarm opinions, so they
//    neither count fully against a film (that marks it down for being talked about) nor get dropped (a
//    film whose talk is mostly neutral isn't a crowd-pleaser).
// 2. Bayesian average. Every film starts from the catalog's typical score μ, worth m posts. A film with
//    20 posts sits near μ; one with 2,000 is almost entirely its own. So the more posts we read, the
//    more the score is the film's own.

/** Every sentiment-scored post: the evidence behind a Whistle. */
export const totalPosts = (s: Sentiment) => s.positive + s.neutral + s.negative;

/**
 * How much a neutral post counts toward the cheers. It grows with how much talk there is: ⅓ up to
 * 1,000 posts, ½ from 4,000 posts, and in between it rises in a straight line (2,500 posts -> 5/12).
 * A film with little talk has to earn its Whistle with outright cheers.
 */
export const NEUTRAL_LOW = { posts: 1000, weight: 1 / 3 };
export const NEUTRAL_HIGH = { posts: 4000, weight: 1 / 2 };
export function neutralWeight(posts: number): number {
  const t = Math.min(1, Math.max(0, (posts - NEUTRAL_LOW.posts) / (NEUTRAL_HIGH.posts - NEUTRAL_LOW.posts)));
  return NEUTRAL_LOW.weight + t * (NEUTRAL_HIGH.weight - NEUTRAL_LOW.weight);
}

/** m: how many posts the catalog prior is worth. Past this, a film's own posts outweigh it. */
export const PRIOR_WEIGHT = 50;

const cheers = (s: Sentiment) => s.positive + neutralWeight(totalPosts(s)) * s.neutral;

// μ: the typical film's share, each real film counted once (so blockbusters don't set it), worked out
// from the film files at build time. Sample films (invented numbers) and films with no posts are left
// out. Falls back to 0.65 before there are any real films.
const filmFiles = import.meta.glob<{ sample?: boolean; report?: { sentiment: Sentiment } | null }>(
  '../data/films/*.json',
  { eager: true, import: 'default' },
);
const ratios = Object.values(filmFiles)
  .filter((f) => !f.sample && f.report && totalPosts(f.report.sentiment) > 0)
  .map((f) => cheers(f.report!.sentiment) / totalPosts(f.report!.sentiment));
export const PRIOR_MEAN = ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : 0.65;

/** The Whistle as a 0-1 share, unrounded. */
export const whistleShare = (s: Sentiment, mean = PRIOR_MEAN) =>
  (cheers(s) + PRIOR_WEIGHT * mean) / (totalPosts(s) + PRIOR_WEIGHT);

/** The Whistle, 0-100. See the formula above. */
export function whistleScore(s: Sentiment): number {
  return Math.round(whistleShare(s) * 100);
}

/** ± points around the Whistle (95% interval): about ±11 from 20 posts, ±2 from 1,000. */
export function whistleMargin(s: Sentiment): number {
  const p = whistleShare(s);
  return Math.round(196 * Math.sqrt((p * (1 - p)) / (totalPosts(s) + PRIOR_WEIGHT)));
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
