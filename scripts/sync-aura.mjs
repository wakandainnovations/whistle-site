// Pulls every movie in the aura database from AuraService and writes one film file per movie to
// src/data/films/, plus its poster to public/posters/. Run it before `npm run build`:
//
//   npm run sync                    # every movie
//   npm run sync -- --only gd-naidu # one film (by page address)
//
// Needs AuraService running and an admin login (admins can read every owner's movies). Put these in
// .env (never committed):
//
//   AURA_USERNAME=...
//   AURA_PASSWORD=...
//   AURA_BASE_URL=http://localhost:8080   (optional, this is the default)
//
// What comes from where (the same endpoints aura-radix's New UI panels use):
//   Whistle %                    /dashboard/{id}/platform-mentions  positive / neutral / negative counts; the site
//                                works out the score from them (src/lib/score.ts)
//   "5x more cheers"             /dashboard/{id}/stats/avg          netSentimentScore (positive ÷ negative)
//   Trailer and clip views       /dashboard/{id}/awareness
//   Different people posted      /dashboard/{id}/reach-direct
//   When people were talking     /dashboard/sentiment-over-time-range, the past year, one total per day
//   Loudest day                  the busiest day in that same year of daily totals
//   Out of every 100 posts       /dashboard/{id}/platform-mentions  positive / neutral / negative counts
//   What got people talking      /dashboard/{id}/review-aspect-breakdown   ("Mention Drivers", Volume)
//   Where the noise came from    /dashboard/{id}/audience-pulse            ("Top Regions by Buzz")
//   Who was talking              /dashboard/{id}/content-intent-breakdown  ("Top Drivers")
//   Kind of account (details)    /dashboard/{id}/author-type-breakdown
//   Poster                       /entities/movie/{id}/image
//
// Fields a person curated by hand in an existing film file (title, aka, trailer, backdrop, tmdbId,
// featured, real streaming platforms) are kept. Everything AuraService knows is overwritten.

import { readFile, writeFile, readdir, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILMS_DIR = path.join(ROOT, 'src/data/films');
const POSTERS_DIR = path.join(ROOT, 'public/posters');
const BASE = (process.env.AURA_BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
const LOOKBACK_DAYS = 365; // the loudest day is the busiest day within this window
// sentiment-over-time-range only answers per day for ranges up to 90 days apart (weekly beyond that),
// so the year is fetched in chunks of this many days
const DAILY_CHUNK_DAYS = 91;
const CONCURRENCY = 4;

const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;

// ---------- small helpers ----------

const slugify = (name) =>
  name.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
// A movie's page address. A name with no Latin letters or digits (e.g. one in Malayalam script) slugifies
// to "", which would write a hidden src/data/films/.json that the site never loads, so it gets
// film-<entity id> instead. Give it an English name in AuraService for a readable address.
const movieSlug = (movie) => slugify(movie.name ?? '') || `film-${movie.id}`;

// What a poster file really is, from its first bytes. AuraService has served non-images (a macOS
// .DS_Store) from the image endpoint, so the content-type header alone isn't trusted.
function imageExt(buf) {
  const b = (i) => buf[i], str = (i, n) => buf.subarray(i, i + n).toString('latin1');
  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return 'jpg';
  if (str(1, 3) === 'PNG') return 'png';
  if (str(0, 4) === 'GIF8') return 'gif';
  if (str(0, 4) === 'RIFF' && str(8, 4) === 'WEBP') return 'webp';
  if (str(4, 4) === 'ftyp' && /^avi[fs]$/.test(str(8, 4))) return 'avif';
  return null;
}

const isoDay = (d) => d.toISOString().slice(0, 10);
const addDays = (iso, n) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return isoDay(d); };
const today = isoDay(new Date());

const titleCase = (s) => String(s ?? '').replace(/_/g, ' ').trim().replace(/\b\w/g, (c) => c.toUpperCase());
const sentenceCase = (s) => { const t = String(s ?? '').replace(/_/g, ' ').trim(); return t.charAt(0).toUpperCase() + t.slice(1); };
const pct = (n) => Math.max(0, Math.min(100, Math.round(n)));

function formatRuntime(minutes) {
  if (!minutes || minutes <= 0) return null;
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return h > 0 ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`;
}

// AuraService industry -> homepage tab
const INDUSTRY = { kollywood: 'south', tollywood: 'south', mollywood: 'south', sandalwood: 'south', bollywood: 'hindi', hollywood: 'hollywood' };
const LANGUAGE_INDUSTRY = { hindi: 'hindi', english: 'hollywood' };
const industryFor = (m) =>
  INDUSTRY[(m.industry ?? '').toLowerCase()] ?? LANGUAGE_INDUSTRY[(m.language ?? '').toLowerCase()] ?? 'south';

// Review-aspect categories ("Mention Drivers"), same labels as aura-radix's useMentionsData
const ASPECT_LABELS = {
  music_songs: 'Music / songs', direction: 'Direction', acting_cast_performance: 'Acting / cast performance',
  story: 'Story', screenplay: 'Screenplay', lead_pair: 'Lead pair', runtime: 'Runtime', first_half: 'First half',
  second_half: 'Second half', climax: 'Climax', vfx: 'VFX', other: 'General discussion',
};
// `other` is the classifier's catch-all, not a real driver: only shown when it is most of the talk
const OTHER_DOMINANT_THRESHOLD = 50;

// Content intents ("Top Drivers"), labelled like the existing film files
const INTENT_LABELS = {
  organic_opinion: 'Organic opinion', fan_amplified_promo: 'Fan amplified promo', official_promo: 'Official promo',
  news_press_coverage: 'News press coverage', trade_box_office_update: 'Trade box office update',
  ticket_merch_marketplace: 'Ticket merch marketplace',
};

// Region values come back snake_case ("tamil_nadu"); any international bucket reads as one place
const regionLabel = (r) => (/international|diaspora|overseas|abroad|outside/i.test(r) ? 'International' : titleCase(r));

// ---------- streaming platforms (placeholder) ----------
// AuraService has no streaming data yet. Until it does, released films get a made-up but stable pick of
// platforms that carry films in that language, and the film page labels it as placeholder.
// TODO: replace with the AuraService streaming API once it exists.
const PLATFORMS_BY_LANGUAGE = {
  Tamil: ['Prime Video', 'Netflix', 'Sun NXT', 'JioHotstar', 'ZEE5'],
  Telugu: ['aha', 'Prime Video', 'Netflix', 'JioHotstar', 'ZEE5'],
  Kannada: ['ZEE5', 'Prime Video', 'Sun NXT', 'JioHotstar'],
  Malayalam: ['JioHotstar', 'Prime Video', 'Netflix', 'ZEE5'],
  Hindi: ['Netflix', 'Prime Video', 'JioHotstar', 'ZEE5', 'SonyLIV'],
  English: ['Netflix', 'Prime Video', 'JioHotstar'],
};
function placeholderStreaming(slug, language, releaseDate) {
  // films still in theatres (or not out yet) aren't streaming
  if (!releaseDate || addDays(releaseDate, 28) > today) return [];
  const list = PLATFORMS_BY_LANGUAGE[language] ?? PLATFORMS_BY_LANGUAGE.English;
  let h = 0;
  for (const c of slug) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const first = list[h % list.length];
  const second = list[(h >>> 8) % list.length];
  return h % 3 === 0 && second !== first ? [first, second] : [first];
}

// ---------- AuraService client ----------

let token = null;

async function login() {
  const username = process.env.AURA_USERNAME, password = process.env.AURA_PASSWORD;
  if (!username || !password) {
    throw new Error('Set AURA_USERNAME and AURA_PASSWORD in .env (an AuraService admin login).');
  }
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }),
  }).catch((e) => { throw new Error(`Can't reach AuraService at ${BASE} (${e.cause?.code ?? e.message}). Is it running?`); });
  if (!res.ok) throw new Error(`AuraService login failed: HTTP ${res.status}`);
  const body = await res.json();
  if (!body.jwtToken) throw new Error('AuraService login answered without a jwtToken');
  token = body.jwtToken;
}

async function request(pathAndQuery, { raw = false } = {}) {
  const res = await fetch(`${BASE}/api${pathAndQuery}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} for ${pathAndQuery}`);
    err.status = res.status;
    throw err;
  }
  return raw ? res : res.json();
}

/** A failing endpoint leaves that one panel empty rather than failing the whole film. */
async function optional(label, pathAndQuery, warnings) {
  try {
    return await request(pathAndQuery);
  } catch (e) {
    warnings.push(`${label}: ${e.message}`);
    return null;
  }
}

async function pool(items, size, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); }
  }));
  return out;
}

// ---------- shaping AuraService answers into the film file ----------

// Posts the collector gathered for a film: its rows in x_posts, instagram_posts, reddit_posts and
// youtube_comments (Tracked Releases' per-table counts), leaving out youtube_videos. Falls back to the
// release's total when the per-table counts are missing.
const POST_TABLES = ['x', 'instagram', 'reddit', 'youtubeComments'];
function collectedPosts(release) {
  const c = release.collected;
  if (!c || typeof c !== 'object') return release.collectedTotal ?? 0;
  return POST_TABLES.reduce((sum, k) => sum + (Number(c[k]) || 0), 0);
}

function sentimentCounts(platformMentions) {
  const s = { positive: 0, neutral: 0, negative: 0 };
  for (const counts of Object.values(platformMentions ?? {})) {
    s.positive += counts?.POSITIVE ?? 0;
    s.neutral += counts?.NEUTRAL ?? 0;
    s.negative += counts?.NEGATIVE ?? 0;
  }
  return s;
}

const num = (v) => (typeof v === 'number' ? v : typeof v?.total === 'number' ? v.total : 0);

/** The past year of mentions, one total per day, fetched in daily-sized chunks. null if any chunk fails. */
async function fetchDaily(id, start, end, warnings) {
  const chunks = [];
  for (let from = start; from <= end; from = addDays(from, DAILY_CHUNK_DAYS)) {
    const to = addDays(from, DAILY_CHUNK_DAYS - 1) < end ? addDays(from, DAILY_CHUNK_DAYS - 1) : end;
    chunks.push([from, to]);
  }
  const answers = await Promise.all(chunks.map(([from, to]) =>
    optional('mentions over time', `/dashboard/sentiment-over-time-range?startDate=${from}&endDate=${to}&entityIds=${id}`, warnings)));
  if (answers.some((a) => a === null)) return null;
  return answers.flatMap((a) => a?.entities?.[0]?.sentiments ?? []);
}

/** One total per day, trimmed to the days that had any talk. */
function dailyMentions(items) {
  const byDay = new Map();
  for (const item of items ?? []) {
    const day = String(item?.date ?? '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue; // skip anything not bucketed per day
    const total = item.total != null ? num(item.total) : num(item.positive) + num(item.neutral) + num(item.negative);
    byDay.set(day, (byDay.get(day) ?? 0) + total);
  }
  const days = [...byDay.entries()].filter(([, v]) => v > 0).map(([d]) => d).sort();
  if (days.length === 0) return null;
  const start = days[0], end = days[days.length - 1];
  const daily = [];
  for (let d = start; d <= end; d = addDays(d, 1)) daily.push(byDay.get(d) ?? 0);
  // a one-day series can't be drawn as a line: give it a quiet day either side
  if (daily.length === 1) return { start: addDays(start, -1), end: addDays(end, 1), daily: [0, daily[0], 0] };
  return { start, end, daily };
}

function regions(pulse) {
  const known = (pulse?.regions ?? []).filter((r) => r.region && r.region.toLowerCase() !== 'unknown');
  const knownTotal = known.reduce((s, r) => s + (r.sharePct ?? 0), 0);
  // merge rows that land on the same label (e.g. several international buckets)
  const merged = new Map();
  for (const r of known) {
    const label = regionLabel(r.region);
    merged.set(label, (merged.get(label) ?? 0) + (knownTotal > 0 ? (r.sharePct / knownTotal) * 100 : 0));
  }
  const top = [...merged.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => [k, pct(v)]);
  const all = new Map();
  for (const r of pulse?.regions ?? []) {
    if (!r.region) continue;
    const label = r.region.toLowerCase() === 'unknown' ? 'Unknown' : regionLabel(r.region);
    all.set(label, (all.get(label) ?? 0) + (r.sharePct ?? 0));
  }
  const where = [...all.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, pct(v)]).filter(([, v]) => v > 0);
  return { top: top.filter(([, v]) => v > 0), where };
}

function topics(aspectBreakdown) {
  const aspects = aspectBreakdown?.aspects ?? [];
  const other = aspects.find((a) => a.category === 'other');
  const otherDominates = (other?.sharePct ?? 0) > OTHER_DOMINANT_THRESHOLD;
  return aspects
    .filter((a) => a.category && (a.category !== 'other' || otherDominates))
    .sort((a, b) => (b.sharePct ?? 0) - (a.sharePct ?? 0))
    .slice(0, 6)
    .map((a) => [ASPECT_LABELS[a.category] ?? sentenceCase(a.category), pct(a.sharePct ?? 0)])
    .filter(([, v]) => v > 0);
}

const intents = (b) =>
  (b?.intents ?? []).filter((i) => i.contentIntent).sort((a, b) => b.sharePct - a.sharePct).slice(0, 6)
    .map((i) => [INTENT_LABELS[i.contentIntent] ?? sentenceCase(i.contentIntent), pct(i.sharePct)])
    .filter(([, v]) => v > 0);

// "general" and "unknown" are the classifier failing to decide, not a kind of account
const authorTypes = (b) =>
  (b?.authorTypes ?? []).filter((a) => a.authorType && !['general', 'unknown'].includes(a.authorType)).sort((a, b) => b.sharePct - a.sharePct).slice(0, 6)
    .map((a) => [sentenceCase(a.authorType), pct(a.sharePct)])
    .filter(([, v]) => v > 0);

async function savePoster(id, slug, warnings) {
  try {
    const res = await request(`/entities/movie/${id}/image`, { raw: true });
    const buf = Buffer.from(await res.arrayBuffer());
    const ext = imageExt(buf);
    if (!ext) {
      warnings.push(`poster: AuraService returned something that isn't an image (${res.headers.get('content-type') ?? 'no type'}, ${buf.length} bytes); upload a new one`);
      return null;
    }
    const file = `${slug}.${ext}`;
    // drop an older copy saved with a different extension
    for (const f of await readdir(POSTERS_DIR)) if (f.startsWith(`${slug}.`) && f !== file) await rm(path.join(POSTERS_DIR, f));
    await writeFile(path.join(POSTERS_DIR, file), buf);
    return `/posters/${file}`;
  } catch (e) {
    if (e.status !== 404) warnings.push(`poster: ${e.message}`);
    return null;
  }
}

async function readExisting(slug) {
  try { return JSON.parse(await readFile(path.join(FILMS_DIR, `${slug}.json`), 'utf8')); } catch { return null; }
}

// ---------- one film ----------

async function syncFilm({ movie, slug, stats, release }) {
  const id = movie.id;
  const warnings = [];
  const end = today, start = addDays(today, -(LOOKBACK_DAYS - 1));

  const [detail, platform, awareness, reach, overTime, aspects, pulse, intentB, authorB, poster] = await Promise.all([
    optional('details', `/entities/movie/${id}`, warnings),
    optional('sentiment', `/dashboard/${id}/platform-mentions`, warnings),
    optional('awareness', `/dashboard/${id}/awareness`, warnings),
    optional('reach', `/dashboard/${id}/reach-direct`, warnings),
    fetchDaily(id, start, end, warnings),
    optional('mention drivers', `/dashboard/${id}/review-aspect-breakdown`, warnings),
    optional('regions', `/dashboard/${id}/audience-pulse`, warnings),
    optional('top drivers', `/dashboard/${id}/content-intent-breakdown`, warnings),
    optional('author types', `/dashboard/${id}/author-type-breakdown`, warnings),
    savePoster(id, slug, warnings),
  ]);

  const m = { ...movie, ...(detail ?? {}) };
  const existing = await readExisting(slug);
  const releaseDate = m.releaseDate ?? existing?.releaseDate ?? null;
  const language = m.language ?? existing?.language ?? 'Tamil';

  const sentiment = sentimentCounts(platform);
  const posts = sentiment.positive + sentiment.neutral + sentiment.negative;
  const series = dailyMentions(overTime);

  let report = null;
  if (posts > 0) {
    const { top, where } = regions(pulse);
    // positive ÷ negative, straight from AuraService's Net Sentiment Score when it has one
    const net = sentiment.negative > 0
      ? +(stats?.netSentimentScore || sentiment.positive / sentiment.negative).toFixed(2)
      : null;
    const tracking = series ?? { start: addDays(today, -89), end: today, daily: [] };
    report = {
      tracking: { start: tracking.start, end: tracking.end },
      sentiment,
      netSentiment: net,
      awareness: { level: awareness?.awarenessLevel ?? 'Unknown', views: awareness?.totalViews ?? 0 },
      reach: reach?.uniqueUsers ?? 0,
      mentions: { total: tracking.daily.reduce((s, v) => s + v, 0), daily: tracking.daily },
      regions: top,
      audience: { where, who: authorTypes(authorB), postType: intents(intentB), topics: topics(aspects) },
    };
  }

  // Real platforms someone checked by hand win over the placeholder
  const hasRealWatch = existing?.watch?.length > 0 && !existing.watchPlaceholder;
  const watch = hasRealWatch ? existing.watch : placeholderStreaming(slug, language, releaseDate);

  // A title someone set by hand (e.g. "G.D.N" for GD Naidu) is kept and the aura name becomes an alias;
  // a file this script created follows the name in AuraService.
  const curatedTitle = existing?.title && existing.title !== existing.auraName ? existing.title : null;
  const title = curatedTitle ?? m.name;
  const aka = [...new Set([...(existing?.aka ?? []), ...(title !== m.name ? [m.name] : [])])].filter((a) => a !== title);
  const genres = Array.isArray(m.genre) ? m.genre : String(m.genre ?? '').split(',').map((g) => g.trim()).filter(Boolean);

  const film = {
    sample: false,
    auraId: id,
    auraName: m.name,
    title,
    aka,
    titleConfirmed: existing?.titleConfirmed ?? true,
    language,
    industry: industryFor(m),
    year: releaseDate ? Number(releaseDate.slice(0, 4)) : existing?.year ?? new Date().getUTCFullYear(),
    releaseDate,
    featured: existing?.featured ?? false,
    poster: poster ?? existing?.poster ?? null,
    backdrop: existing?.backdrop ?? null,
    trailer: existing?.trailer ?? null,
    director: m.director || existing?.director || null,
    cast: m.actors?.length ? m.actors.slice(0, 4) : existing?.cast ?? [],
    genres: genres.length ? genres : existing?.genres ?? [],
    runtime: formatRuntime(m.runtime) ?? existing?.runtime ?? null,
    tmdbId: existing?.tmdbId ?? null,
    watch,
    watchCheckedOn: hasRealWatch ? existing.watchCheckedOn ?? null : null,
    watchPlaceholder: !hasRealWatch && watch.length > 0,
    syncedOn: today,
    // What the collector has gathered for this film (Tracked Releases admin page): every post collected,
    // scored for sentiment yet or not, summed over x_posts, instagram_posts, reddit_posts and
    // youtube_comments (not youtube_videos). It is the post count the site shows. Drives "Most talked
    // about". null for films the collector doesn't track.
    buzz: release ? {
      collected: collectedPosts(release),
      trackFrom: release.trackFrom ?? null,
      trackUntil: release.trackUntil ?? null,
      popularity: release.popularity ?? null,
    } : null,
    report,
  };

  await writeFile(path.join(FILMS_DIR, `${slug}.json`), `${JSON.stringify(film, null, 2)}\n`);
  // For the log only: positive ÷ all posts. The Whistle itself is worked out by the site (src/lib/score.ts)
  const score = posts ? Math.round((sentiment.positive / posts) * 100) : null;
  return { slug, title: film.title, posts, score, warnings, poster: !!poster };
}

// ---------- main ----------

async function main() {
  await login();
  await mkdir(POSTERS_DIR, { recursive: true });

  const movies = await request('/entities/movie');
  console.log(`AuraService has ${movies.length} movies.`);

  // The same film can be tracked by more than one owner (e.g. "Balan The Boy" and "Balan: The Boy").
  // Keep the copy with the most mentions.
  const withStats = await pool(movies, 8, async (movie) => ({
    movie,
    slug: movieSlug(movie),
    stats: await request(`/dashboard/${movie.id}/stats/avg`).catch(() => null),
  }));
  const bySlug = new Map();
  for (const x of withStats) {
    const prev = bySlug.get(x.slug);
    if (!prev || (x.stats?.totalMentions ?? 0) > (prev.stats?.totalMentions ?? 0)) bySlug.set(x.slug, x);
  }
  // The collector's tracked releases, for collected-post counts. Matched by entity id, then by name
  // (the copy kept above may belong to a different owner than the one the release was added for).
  const releases = await request('/admin/tracked-releases?scope=all').catch((e) => {
    console.log(`  ! tracked releases: ${e.message} (no collected-post counts this run)`);
    return [];
  });
  const releaseById = new Map(), releaseByName = new Map();
  for (const r of releases) {
    for (const e of r.platformEntities ?? []) releaseById.set(e.entityId, r);
    releaseByName.set(String(r.entityName).toLowerCase(), r);
  }
  for (const x of bySlug.values()) {
    x.release = releaseById.get(x.movie.id) ?? releaseByName.get(String(x.movie.name).toLowerCase()) ?? null;
  }
  let targets = [...bySlug.values()];
  if (only) {
    targets = targets.filter((t) => t.slug === only);
    if (!targets.length) throw new Error(`No AuraService movie maps to "${only}"`);
  }

  const results = await pool(targets, CONCURRENCY, async (t) => {
    const r = await syncFilm(t);
    const score = r.score === null ? 'score coming soon' : `${r.score}% positive from ${r.posts} posts`;
    console.log(`  ${r.slug.padEnd(34)} ${score}${r.poster ? '' : ' · no poster'}`);
    r.warnings.forEach((w) => console.log(`      ! ${w}`));
    return r;
  });

  const scored = results.filter((r) => r.score !== null).length;
  console.log(`\nWrote ${results.length} films (${scored} scored, ${results.length - scored} coming soon) to src/data/films/.`);
}

main().catch((e) => {
  console.error(`\nsync failed: ${e.message}`);
  process.exit(1);
});
