// Buzz: a film's share (0-100) of one day's talk among the films of its language on the site.
// If three Tamil films had 20, 30 and 50 posts on a day, their buzz that day is 20, 30 and 50.
// Only films of the same language count toward the total. A day whose total is below the language's
// cutoff (minPosts) counts as 0, so a quiet day where one film had the only post doesn't show as 100.
// The site shows buzz instead of raw post counts.
import type { Film } from './films';

const DAY = 864e5;
const dayNum = (iso: string) => Math.round(Date.parse(`${iso}T00:00:00Z`) / DAY);

// language -> day number -> total posts that day across that language's films
const cache = new WeakMap<Film[], Map<string, Map<number, number>>>();

function totals(films: Film[]) {
  let byLang = cache.get(films);
  if (byLang) return byLang;
  byLang = new Map();
  for (const f of films) {
    const r = f.data.report;
    if (!r) continue;
    let days = byLang.get(f.data.language);
    if (!days) byLang.set(f.data.language, (days = new Map()));
    const start = dayNum(r.tracking.start);
    r.mentions.daily.forEach((n, i) => { if (n > 0) days!.set(start + i, (days!.get(start + i) ?? 0) + n); });
  }
  cache.set(films, byLang);
  return byLang;
}

// The cutoff: half the language's median daily total over the last CUTOFF_DAYS days (zero days included),
// never below CUTOFF_FLOOR. Recalculated at every build, so it follows each language as it gets busier.
export const CUTOFF_DAYS = 30;
export const CUTOFF_SHARE = 0.5;
export const CUTOFF_FLOOR = 10;

function cutoff(days: Map<number, number>, today = Date.now()) {
  const end = Math.floor(today / DAY);
  const recent = Array.from({ length: CUTOFF_DAYS }, (_, i) => days.get(end - i) ?? 0).sort((a, b) => a - b);
  const mid = recent.length / 2;
  const median = recent.length % 2 ? recent[Math.floor(mid)] : (recent[mid - 1] + recent[mid]) / 2;
  return Math.max(CUTOFF_FLOOR, Math.round(CUTOFF_SHARE * median));
}

/** Each language's minimum posts per day (all its films together) for a day's buzz to count. */
export function minPosts(films: Film[], today = Date.now()): Record<string, number> {
  return Object.fromEntries([...totals(films)].map(([lang, days]) => [lang, cutoff(days, today)]));
}

/**
 * The film's daily buzz, one value per day of its mentions.daily (same start date, same length).
 * `films` is every film on the site; only those in the film's language are counted.
 */
export function dailyBuzz(film: Film, films: Film[]): number[] {
  const r = film.data.report;
  if (!r) return [];
  const days = totals(films).get(film.data.language);
  const min = days ? cutoff(days) : Infinity;
  const start = dayNum(r.tracking.start);
  return r.mentions.daily.map((n, i) => {
    const all = days?.get(start + i) ?? 0;
    return all >= min ? Math.round((1000 * n) / all) / 10 : 0;
  });
}
