// Score history for the Whistle Race: what each film's Whistle was before its latest change, and how
// many posts it gained in the last 24 hours. Kept in src/data/score-history.json.
//
// Only a production build (`npm run build`, run by scripts/sync-scheduled.sh after each sync) writes the
// file, so the dev server never moves the history. An "update" is a build in which a film's Whistle
// changed: its previous score is then kept as `prev`, so the race shows the last real move up or down.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// from the project root: builds run there (npm run build), and import.meta.url points into dist/ once bundled
const FILE = join(process.cwd(), 'src/data/score-history.json');
const DAY = 864e5;

type Entry = {
  score: number; // the Whistle at the latest build
  at: string; // when it last changed (ISO)
  prev: number | null; // the Whistle before that change; null until it has changed once
  posts: [string, number][]; // [time, total posts] at each build in the last 24 hours, oldest first
};
type History = { builtAt: string | null; films: Record<string, Entry> };

export type Change = { prev: number | null; changedAt: string; postsDay: number };

function load(): History {
  if (!existsSync(FILE)) return { builtAt: null, films: {} };
  try {
    return JSON.parse(readFileSync(FILE, 'utf8'));
  } catch {
    return { builtAt: null, films: {} };
  }
}

/** Records this build's scores (production builds only) and returns each film's change and posts in the last 24 hours. */
export function scoreChanges(films: { id: string; score: number; posts: number }[]): { changes: Record<string, Change>; builtAt: string } {
  const h = load();
  const now = new Date();
  const iso = now.toISOString();
  const write = import.meta.env.PROD;
  const changes: Record<string, Change> = {};

  for (const f of films) {
    let e = h.films[f.id];
    if (write) {
      if (!e) e = { score: f.score, at: iso, prev: null, posts: [] };
      else if (e.score !== f.score) e = { ...e, prev: e.score, score: f.score, at: iso };
      e.posts = [...e.posts.filter(([t]) => now.getTime() - Date.parse(t) < DAY), [iso, f.posts]];
      h.films[f.id] = e;
    }
    // posts gained since the oldest build in the last 24 hours (0 until there are two builds)
    const first = e?.posts[0]?.[1] ?? f.posts;
    changes[f.id] = {
      prev: e && e.score === f.score ? e.prev : (e?.score ?? null),
      changedAt: e?.at ?? iso,
      postsDay: Math.max(0, f.posts - first),
    };
  }

  if (write) {
    h.builtAt = iso;
    writeFileSync(FILE, JSON.stringify(h, null, 1) + '\n');
  }
  return { changes, builtAt: h.builtAt ?? iso };
}
