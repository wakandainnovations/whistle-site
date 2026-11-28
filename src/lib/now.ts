// What the homepage leads with: films in theatres now or releasing soon, ranked by traction and by how
// positive the talk is. Used by the homepage carousel and the "Featured" spot in the Films menu.
import type { CollectionEntry } from 'astro:content';
import { whistleScore } from './score';

type Film = CollectionEntry<'films'>;

const DAY = 864e5;
export const IN_THEATRES_DAYS = 30; // a film counts as "in theatres" for this long after release
export const COMING_SOON_DAYS = 30; // and as "coming soon" this long before it
// A film the collector tracks is on the site (and in the Whistle Race) with more collected posts than this
// (talkOf). See hasEnoughTalk.
export const MIN_COLLECTED_SHOWN = 1000;
// A Whistle % is promoted or banded only with more sentiment-scored posts than this (scoreSolid). It is
// also the bar for being on the site at all for a film the collector doesn't track (no buzz).
export const MIN_POSTS_SHOWN = 100;
export const TALKED_SOON_DAYS = 7;
export const RECENT_DAYS = 60; // the homepage leads with films released in the last two months // "Most talked about" also takes films releasing within a week

const posts = (f: Film) => {
  const s = f.data.report?.sentiment;
  return s ? s.positive + s.neutral + s.negative : 0;
};

/** Days from today to release: negative = already out. null without a release date. */
export function daysToRelease(f: Film, today = Date.now()): number | null {
  if (!f.data.releaseDate) return null;
  const day = Date.UTC(new Date(today).getUTCFullYear(), new Date(today).getUTCMonth(), new Date(today).getUTCDate());
  return Math.round((Date.parse(`${f.data.releaseDate}T00:00:00Z`) - day) / DAY);
}

export function isNowOrSoon(f: Film, today = Date.now()) {
  const d = daysToRelease(f, today);
  return d !== null && d >= -IN_THEATRES_DAYS && d <= COMING_SOON_DAYS;
}

/**
 * Traction × positivity: the Whistle (positive %) weighted by the log of how many posts there were, so
 * a loved film with real buzz beats both a loved film nobody talks about and a loud film people dislike.
 * (72% from 39 posts ≈ 115, 24% from 272 posts ≈ 58.)
 */
export function nowRank(f: Film) {
  const r = f.data.report;
  return r ? whistleScore(r.sentiment) * Math.log10(1 + posts(f)) : 0;
}

/** "In theatres · day 5", "Out tomorrow", "Out in 10 days" */
export function runLabel(f: Film, today = Date.now()) {
  const d = daysToRelease(f, today);
  if (d === null) return '';
  if (d > 1) return `Out in ${d} days`;
  if (d === 1) return 'Out tomorrow';
  if (d === 0) return 'Out today';
  return d >= -IN_THEATRES_DAYS ? `In theatres · day ${-d + 1}` : '';
}

/**
 * Up to `n` films in theatres or coming soon, best first. Films with real AuraService data come
 * before sample films (made-up numbers), which only fill slots left over. If there still aren't `n`,
 * the best-ranked other films (any date) fill the rest, so the carousel is never short.
 */
export function nowShowing(films: Film[], n = 6, today = Date.now()): Film[] {
  const eligible = films.filter((f) => f.data.report && f.data.poster && scoreSolid(f));
  const byRank = (a: Film, b: Film) => nowRank(b) - nowRank(a);
  const current = eligible.filter((f) => isNowOrSoon(f, today));
  const picks = [
    ...current.filter((f) => !f.data.sample).sort(byRank),
    ...current.filter((f) => f.data.sample).sort(byRank),
  ];
  const rest = eligible.filter((f) => !picks.includes(f));
  picks.push(...rest.filter((f) => !f.data.sample).sort(byRank), ...rest.filter((f) => f.data.sample).sort(byRank));
  return picks.slice(0, n);
}

/** Released in the last RECENT_DAYS days (today counts). */
export function isRecent(f: Film, today = Date.now()) {
  const d = daysToRelease(f, today);
  return d !== null && d <= 0 && d > -RECENT_DAYS;
}

/**
 * The homepage's films: released in the last RECENT_DAYS days with a solid score (scoreSolid), highest
 * Whistle first. Real AuraService films come before sample films. With `fill`, if there still aren't `n`,
 * the most recently released older films with a solid score top it up, so a slot is never empty.
 */
export function recentByScore(films: Film[], n = Infinity, { fill = false, today = Date.now() } = {}): Film[] {
  const eligible = films.filter((f) => f.data.report && f.data.poster && scoreSolid(f));
  const score = (f: Film) => whistleScore(f.data.report!.sentiment);
  const byScore = (a: Film, b: Film) => score(b) - score(a);
  const recent = eligible.filter((f) => isRecent(f, today));
  const picks = [...recent.filter((f) => !f.data.sample).sort(byScore), ...recent.filter((f) => f.data.sample).sort(byScore)];
  if (fill && picks.length < n) {
    const released = eligible.filter((f) => !picks.includes(f) && (daysToRelease(f, today) ?? 1) <= 0);
    const newest = (a: Film, b: Film) => (b.data.releaseDate ?? '').localeCompare(a.data.releaseDate ?? '');
    picks.push(...released.filter((f) => !f.data.sample).sort(newest), ...released.filter((f) => f.data.sample).sort(newest));
  }
  return picks.slice(0, n);
}

/**
 * How many posts people have made about a film: everything the Aura collector gathered (Tracked
 * Releases), scored for sentiment yet or not; the scored count when the collector doesn't track it.
 */
export function talkOf(f: Film) {
  return Math.max(f.data.buzz?.collected ?? 0, posts(f));
}

/**
 * "Most talked about": real AuraService films in theatres (released in the last IN_THEATRES_DAYS) or
 * releasing within TALKED_SOON_DAYS, with the most posts first and more trailer/clip views breaking ties.
 * Sample films (made-up numbers) never appear. If no real film is in that window, the most-posted real
 * films of any date stand in so the list isn't empty.
 */
export function mostTalked(films: Film[], n = 5, today = Date.now()): Film[] {
  const real = films.filter((f) => !f.data.sample && f.data.auraId !== null && f.data.poster && talkOf(f) > 0);
  const byTalk = (a: Film, b: Film) =>
    talkOf(b) - talkOf(a) || (b.data.report?.awareness.views ?? 0) - (a.data.report?.awareness.views ?? 0);
  const inWindow = real.filter((f) => {
    const d = daysToRelease(f, today);
    return d !== null && d >= -IN_THEATRES_DAYS && d <= TALKED_SOON_DAYS;
  });
  return (inWindow.length ? inWindow : real).sort(byTalk).slice(0, n);
}

/**
 * Enough talk to be on the site: a film the collector tracks (buzz set) needs more than
 * MIN_COLLECTED_SHOWN posts by its count (talkOf); one it doesn't track is judged on its sentiment-scored
 * posts instead (all of them, neutral included), more than MIN_POSTS_SHOWN. Applies to upcoming films too.
 * Either way a film needs at least one sentiment-scored post: one whose collected posts were all judged
 * irrelevant (e.g. Black Gold, whose name is mostly oil and pepper-futures talk) has no Whistle to show.
 */
export function hasEnoughTalk(f: Film) {
  if (posts(f) === 0) return false;
  return f.data.buzz ? talkOf(f) > MIN_COLLECTED_SHOWN : posts(f) > MIN_POSTS_SHOWN;
}

/** In the Whistle Race: a real AuraService film with a release date and enough talk (hasEnoughTalk). */
export function inRace(f: Film) {
  return !f.data.sample && f.data.auraId !== null && !!f.data.releaseDate && hasEnoughTalk(f);
}

/**
 * A film's Whistle % can be promoted (carousel, "Top scores" ticker, Picks, the Race teaser's leaders)
 * only when more than MIN_POSTS_SHOWN sentiment-scored posts are behind it. A film with plenty of
 * collected posts but few scored ones (100% from 3 posts) stays on the site, just not up front.
 */
export function scoreSolid(f: Film) {
  return !!f.data.report && posts(f) > MIN_POSTS_SHOWN;
}
