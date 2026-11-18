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

type Sentiment = { positive: number; neutral: number; negative: number };

/** The Whistle: the share of all posts that are positive (AuraService's positive sentiment %), rounded. */
export function whistleScore(s: Sentiment): number {
  const total = s.positive + s.neutral + s.negative;
  return total === 0 ? 0 : Math.round((s.positive / total) * 100);
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
