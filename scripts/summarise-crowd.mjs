// Writes the "what the crowd said" summary for each scored film by sampling its positive and negative
// posts from the Aura database and asking aura-llm to summarise them for a moviegoer.
//
// Output: src/data/crowd-summaries.json, { "<slug>": { text, posts, on } }. A film is re-summarised only
// when its post count has grown by SUMMARY_REFRESH_PCT (default 15%) or the summary is SUMMARY_MAX_AGE_DAYS
// (default 3) old, so running this every 10 minutes after the sync is cheap.
//
//   AURA_DB=aura                              psql database holding `mentions` (default aura)
//   AURA_LLM_URL=http://localhost:1025/api/chat
//   SUMMARY_FORCE=1                           re-summarise every film
//   SUMMARY_ONLY=slug1,slug2                  only these films
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const FILMS_DIR = path.join(ROOT, 'src/data/films');
const OUT = path.join(ROOT, 'src/data/crowd-summaries.json');
const DB = process.env.AURA_DB || 'aura';
const LLM_URL = process.env.AURA_LLM_URL || 'http://localhost:1025/api/chat';
const REFRESH = Number(process.env.SUMMARY_REFRESH_PCT || 15) / 100;
const MAX_AGE_DAYS = Number(process.env.SUMMARY_MAX_AGE_DAYS || 3);
const FORCE = process.env.SUMMARY_FORCE === '1';
const ONLY = process.env.SUMMARY_ONLY?.split(',').map((s) => s.trim()).filter(Boolean);
const PER_SIDE = 40; // posts sampled from each side (positive, negative)
const PARALLEL = 4;
const today = new Date().toISOString().slice(0, 10);

/** Random sample of one film's posts with one sentiment, skipping posts that are only tags and handles. */
async function samplePosts(entityId, sentiment, limit) {
  const sql = `
    select coalesce(json_agg(t), '[]') from (
      select left(regexp_replace(m.content, '\\s+', ' ', 'g'), 400) as text, m.review_aspect_category as aspect
      from mentions m join mention_entities e on e.mention_id = m.id
      where e.managed_entity_id = ${Number(entityId)} and m.sentiment = '${sentiment}'
        and length(regexp_replace(m.content, '([@#]\\S+|https?://\\S+|\\s)', '', 'g')) >= 20
      order by random() limit ${Number(limit)}
    ) t`;
  const { stdout } = await run('psql', ['-d', DB, '-Atc', sql], { maxBuffer: 16 << 20 });
  return JSON.parse(stdout.trim() || '[]');
}

async function countPosts(entityId) {
  const { stdout } = await run('psql', ['-d', DB, '-Atc',
    `select sentiment, count(*) from mentions m join mention_entities e on e.mention_id = m.id
     where e.managed_entity_id = ${Number(entityId)} group by 1`]);
  const c = { POSITIVE: 0, NEGATIVE: 0, NEUTRAL: 0 };
  for (const line of stdout.trim().split('\n').filter(Boolean)) { const [k, v] = line.split('|'); c[k] = Number(v); }
  return c;
}

function prompt(film, counts, pos, neg) {
  const upcoming = film.releaseDate && film.releaseDate > today;
  const lean = counts.NEGATIVE > counts.POSITIVE * 1.2 ? 'mostly negative'
    : counts.POSITIVE > counts.NEGATIVE * 1.2 ? 'mostly positive' : 'divided';
  const fmt = (posts) => posts.map((p, i) => `${i + 1}. ${p.text}`).join('\n');
  return `You are writing a short crowd summary for a movie-review website, for someone deciding whether to watch "${film.title}" (${film.language}, ${film.genres.join(', ') || 'film'}${film.cast.length ? `, starring ${film.cast.slice(0, 3).join(', ')}` : ''}${film.director ? `, directed by ${film.director}` : ''}).
${upcoming ? `The film releases on ${film.releaseDate}; these posts are pre-release reactions to its trailer, songs and promos.` : 'These are social media posts from people after release.'}
Overall the reaction was ${lean}. Posts may be in Tamil, Telugu, Malayalam, Kannada, Hindi or English, or transliterated; read them all.

POSITIVE POSTS:
${fmt(pos) || '(none)'}

NEGATIVE POSTS:
${fmt(neg) || '(none)'}

Write 2 to 3 plain-English sentences that:
- start with the majority view${lean === 'mostly negative' ? ' (what people did NOT like, and why)' : lean === 'mostly positive' ? ' (what people liked)' : ''}, then briefly give the other side;
- name specific things: performances (by actor name if posts name them), story, music, direction, pacing, climax, visuals;
- mention anything that stood out (a scene, cameo, performance) or a warning, if posts mention them.
Do not end with a recommendation or verdict of your own (no "it is recommended", "a must-watch", "worth watching", "skip it"); the site adds its own.
Do not quote posts, give numbers, percentages or ratios, mention social media, promotions, fans or hashtags, or invent anything the posts don't say. Silently ignore posts unrelated to this film. Never comment on the posts themselves (how many there were, that some were unrelated, or that one side had none); if one side has nothing relevant, just leave it out. Reply with only the summary.`;
}

async function summarise(text) {
  const res = await fetch(LLM_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: text }),
    signal: AbortSignal.timeout(180_000),
  });
  const body = (await res.text()).trim();
  // aura-llm answers HTTP 200 with "Error from Ollama: ..." when the model fails
  if (!res.ok || /^error/i.test(body) || body.length < 40) throw new Error(`aura-llm: ${body.slice(0, 120) || res.status}`);
  return body.replace(/^["“]|["”]$/g, '').replace(/\s+/g, ' ').trim();
}

async function main() {
  let store = {};
  try { store = JSON.parse(await readFile(OUT, 'utf8')); } catch {}

  const films = [];
  for (const f of (await readdir(FILMS_DIR)).filter((f) => f.endsWith('.json'))) {
    const slug = f.slice(0, -5);
    const film = JSON.parse(await readFile(path.join(FILMS_DIR, f), 'utf8'));
    if (film.sample || !film.report || !film.auraId) continue;
    if (ONLY && !ONLY.includes(slug)) continue;
    films.push({ slug, film });
  }

  let done = 0, skipped = 0, failed = 0;
  const queue = [...films];
  await Promise.all(Array.from({ length: PARALLEL }, async () => {
    for (let job; (job = queue.shift());) {
      const { slug, film } = job;
      try {
        const counts = await countPosts(film.auraId);
        const posts = counts.POSITIVE + counts.NEGATIVE;
        const prev = store[slug];
        const ageDays = prev ? (Date.parse(today) - Date.parse(prev.on)) / 864e5 : Infinity;
        if (!FORCE && prev && posts < prev.posts * (1 + REFRESH) && ageDays < MAX_AGE_DAYS) { skipped++; continue; }
        if (posts < 10) { skipped++; continue; }
        // sample in proportion to each side, so a mostly negative film shows the model mostly complaints
        const share = counts.POSITIVE / posts;
        const nPos = Math.max(8, Math.round(PER_SIDE * 2 * share)), nNeg = Math.max(8, Math.round(PER_SIDE * 2 * (1 - share)));
        const [pos, neg] = await Promise.all([samplePosts(film.auraId, 'POSITIVE', nPos), samplePosts(film.auraId, 'NEGATIVE', nNeg)]);
        const text = await summarise(prompt(film, counts, pos, neg));
        store[slug] = { text, posts, on: today };
        done++;
        console.log(`  ${slug.padEnd(34)} ${text}`);
      } catch (e) {
        failed++;
        console.warn(`  ${slug.padEnd(34)} kept the old summary (${e.message})`);
      }
    }
  }));

  const sorted = Object.fromEntries(Object.entries(store).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(OUT, JSON.stringify(sorted, null, 2) + '\n');
  console.log(`Crowd summaries: ${done} written, ${skipped} up to date, ${failed} failed.`);
}

main().catch((e) => { console.error(`summaries failed: ${e.message}`); process.exit(1); });
