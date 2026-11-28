// The plain-English summary at the top of a film page: what people actually said. It is written by
// aura-llm from a sample of the film's posts
// (scripts/summarise-crowd.mjs -> src/data/crowd-summaries.json); without one, it falls back to the
// per-aspect moods, leading with whichever side the crowd was on.
import type { FilmReport } from '../content.config';
import { plain } from './plain';
import summaries from '../data/crowd-summaries.json';

const crowd = summaries as Record<string, { text: string; posts: number; on: string }>;

// An aspect needs this many posts before we say anything about it
const MIN_POSTS = 5;

// Shorter names than the page labels, so a sentence listing three of them still reads easily
const SHORT: Record<string, string> = { 'Music / songs': 'the music', 'Acting / cast performance': 'the acting', Runtime: 'the length' };
const lower = (label: string) => SHORT[label] ?? plain(label).replace(/^The /, 'the ');

/** ["the story", "the acting", "the songs"] -> "the story, the acting and the songs" */
function list(items: string[]) {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

function fromAspects(r: FilmReport, negative: boolean, upcoming: boolean): string[] {
  const solid = (r.aspects ?? []).filter((a) => a.posts >= MIN_POSTS);
  const liked = solid.filter((a) => a.mood === 'positive').slice(0, 3).map((a) => lower(a.label));
  const disliked = solid.filter((a) => a.mood === 'negative').slice(0, 3).map((a) => lower(a.label));
  const praise = liked.length ? `${upcoming ? 'Early posts were warm about' : 'People liked'} ${list(liked)}` : '';
  const gripe = disliked.length ? `${upcoming ? 'early posts were unhappy with' : 'people complained most about'} ${list(disliked)}` : '';
  // lead with the side the crowd was on; the other side is the footnote
  if (negative) {
    if (gripe) return [`${gripe.charAt(0).toUpperCase()}${gripe.slice(1)}${liked.length ? `, though a few liked ${list(liked)}` : ''}.`];
    return [];
  }
  if (praise) return [`${praise}${disliked.length ? `, while some complained about ${list(disliked)}` : ''}.`];
  return gripe ? [`${gripe.charAt(0).toUpperCase()}${gripe.slice(1)}.`] : [];
}

// No opening "The crowd leaned positive, and most of the talk came from <region>." sentence: the score box
// already shows the leaning, and the summary should only say what people said.

export function filmSummary(slug: string, r: FilmReport, score: number, upcoming: boolean): string {
  const said = crowd[slug]?.text;
  return (said ? [said] : fromAspects(r, score < 40, upcoming)).join(' ');
}
