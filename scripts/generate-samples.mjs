// Writes the SAMPLE films in src/data/films/ with made-up buzz stats.
// Film facts (title, credits, posters) come from TMDB; trailers are official YouTube uploads;
// streaming platforms are TMDB's India watch providers (JustWatch data), checked 2026-11-16.
// Every number in "report" is invented for the prototype and every file is marked "sample": true.
//
// Run: node scripts/generate-samples.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const TMDB = JSON.parse(readFileSync(new URL('./tmdb-films.json', import.meta.url)));
const byQuery = Object.fromEntries(TMDB.map((r) => [r[0], r]));
const CHECKED = '2026-11-16';

// slug, TMDB query key, language, industry, target score, opinion posts (K), views (M), trailer, watch platforms
const FILMS = [
  ['jailer', 'Jailer', 'Tamil', 'south', 74, 48, 142, ['Y5BeWdODPqo', 'Sun TV', 'showcase'], ['Prime Video', 'Sun NXT']],
  ['leo', 'Leo', 'Tamil', 'south', 63, 61, 168, ['Po3jStA673E', 'Sun TV'], ['Netflix']],
  ['vikram', 'Vikram', 'Tamil', 'south', 86, 39, 110, ['OKBMCL-frPU', 'Sony Music South'], ['JioHotstar']],
  ['amaran', 'Amaran', 'Tamil', 'south', 88, 27, 64, ['hylIXfZeB4c', 'Saregama Tamil'], ['Netflix']],
  ['rrr', 'RRR', 'Telugu', 'south', 85, 72, 196, ['NgBoMJy386M', 'DVV Entertainment'], ['Netflix', 'ZEE5']],
  ['pushpa-2', 'Pushpa 2: The Rule', 'Telugu', 'south', 69, 84, 214, ['g3JUbgOHgdw', 'Mythri Movie Makers'], ['Netflix']],
  ['kalki-2898-ad', 'Kalki 2898 AD', 'Telugu', 'south', 71, 58, 151, ['y1-w1kUGuz8', 'Vyjayanthi Network'], ['Netflix', 'Prime Video']],
  ['hanu-man', 'Hanu-Man', 'Telugu', 'south', 80, 22, 47, ['Oqvly3MvlXA', 'PrimeShow Entertainment'], ['ZEE5', 'JioHotstar']],
  ['manjummel-boys', 'Manjummel Boys', 'Malayalam', 'south', 91, 24, 52, ['id848Ww1YLo', 'Think Music India'], ['JioHotstar']],
  ['aavesham', 'Aavesham', 'Malayalam', 'south', 84, 19, 41, ['L0yEMl8PXnw', 'Anwar Rasheed Entertainment', 'teaser'], ['Prime Video', 'JioHotstar']],
  ['premalu', 'Premalu', 'Malayalam', 'south', 89, 16, 33, ['rR_2ti4l3nM', 'Bhavana Studios'], ['aha']],
  ['2018', '2018', 'Malayalam', 'south', 82, 12, 26, ['Af3cjNPhM4o', 'Think Music India'], ['SonyLIV']],
  ['kantara', 'Kantara', 'Kannada', 'south', 90, 31, 78, ['8mrVmf239GU', 'Hombale Films'], ['Netflix', 'Prime Video']],
  ['kgf-chapter-2', 'K.G.F: Chapter 2', 'Kannada', 'south', 78, 66, 187, ['jQsE85cI384', 'Hombale Films'], ['Prime Video']],
  ['777-charlie', '777 Charlie', 'Kannada', 'south', 83, 14, 36, ['REqFOV2A7sI', 'Paramvah Studios'], ['Prime Video', 'JioHotstar']],
  ['stree-2', 'Stree 2', 'Hindi', 'hindi', 76, 54, 133, ['KVnheXywIbY', 'Maddock Films'], ['Prime Video']],
  ['jawan', 'Jawan', 'Hindi', 'hindi', 72, 69, 176, ['COv52Qyctws', 'Red Chillies Entertainment'], ['Netflix']],
  ['animal', 'Animal', 'Hindi', 'hindi', 54, 77, 189, ['8FkLRUJj-o0', 'T-Series'], ['Netflix']],
  ['12th-fail', '12th Fail', 'Hindi', 'hindi', 93, 21, 49, ['KjbtuqENvVE', 'Zee Studios'], ['JioHotstar']],
  ['oppenheimer', 'Oppenheimer', 'English', 'hollywood', 87, 46, 121, ['bK6ldnjE3Y0', 'Universal Pictures'], ['JioHotstar']],
  ['dune-part-two', 'Dune: Part Two', 'English', 'hollywood', 85, 33, 88, ['U2Qp5pL3ovA', 'Warner Bros.'], ['Netflix']],
  ['barbie', 'Barbie', 'English', 'hollywood', 66, 52, 139, ['pBk4NYhWNMM', 'Warner Bros.'], ['Prime Video']],
  ['spider-man-across-the-spider-verse', 'Spider-Man: Across the Spider-Verse', 'English', 'hollywood', 92, 29, 71, ['cqGjhVJWtEg', 'Sony Pictures Entertainment'], ['SonyLIV']],
  // Films the crowd turned on. Real films that were poorly received; the numbers are still made up.
  // Trailers only where TMDB lists an official upload (null otherwise); streaming checked on TMDB India.
  ['adipurush', 'Adipurush', 'Hindi', 'hindi', 31, 88, 232, null, ['Netflix', 'Prime Video']],
  ['kanguva', 'Kanguva', 'Tamil', 'south', 38, 63, 151, null, ['Prime Video']],
  ['indian-2', 'Indian 2', 'Tamil', 'south', 27, 57, 139, ['Vt4R3-zXksY', 'Netflix India'], ['Netflix']],
  ['game-changer', 'Game Changer', 'Telugu', 'south', 44, 49, 128, null, ['Prime Video', 'ZEE5']],
  ['agent', 'Agent', 'Telugu', 'south', 23, 14, 33, null, ['SonyLIV']],
  ['bade-miyan-chote-miyan', 'Bade Miyan Chote Miyan', 'Hindi', 'hindi', 34, 31, 86, null, ['Netflix']],
  ['madame-web', 'Madame Web', 'English', 'hollywood', 22, 18, 52, ['s_76M4c4LTo', 'Sony Pictures Entertainment'], []],
  ['joker-folie-a-deux', 'Joker: Folie à Deux', 'English', 'hollywood', 36, 27, 75, ['_OKAwz2MsJs', 'Warner Bros.'], ['Netflix']],
  ['martin', 'Martin', 'Kannada', 'south', 29, 22, 58, null, ['Prime Video']],
  ['bandra', 'Bandra', 'Malayalam', 'south', 33, 8, 17, ['IGTRpElZlh8', 'ZEE5 Malayalam'], ['ZEE5']],
];

// The two films added earlier keep their hand-checked facts; they get sample stats too.
const EXTRA = {
  karuppu: { score: 58, postsK: 34, viewsM: 92, release: '2026-05-14', watch: ['Prime Video'] },
  parasakthi: { score: 67, postsK: 41, viewsM: 104, release: '2026-01-10', watch: ['ZEE5'] },
};

// ---------- seeded randomness so re-running gives the same numbers ----------
function rng(seedText) {
  let h = 2166136261;
  for (const c of seedText) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296;
}
const between = (r, a, b) => a + (b - a) * r();
const toIso = (dmy) => { const [d, m, y] = dmy.split('/'); return `${y}-${m}-${d}`; };
const addDays = (iso, n) => { const t = new Date(`${iso}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };

// Split 100 across labels following base weights, with jitter; largest first.
function shares(r, base, jitter = 0.35) {
  const raw = base.map(([name, w]) => [name, w * between(r, 1 - jitter, 1 + jitter)]);
  const sum = raw.reduce((s, x) => s + x[1], 0);
  const rounded = raw.map(([n, w]) => [n, Math.round((w / sum) * 100)]);
  const diff = 100 - rounded.reduce((s, x) => s + x[1], 0);
  rounded.sort((a, b) => b[1] - a[1]);
  rounded[0][1] += diff;
  return rounded;
}

const REGIONS = {
  Tamil: [['Tamil Nadu', 64], ['Kerala', 9], ['Andhra Telangana', 8], ['Karnataka', 7], ['International', 12]],
  Telugu: [['Andhra Telangana', 66], ['Karnataka', 8], ['Tamil Nadu', 6], ['Hindi Belt North India', 9], ['International', 11]],
  Malayalam: [['Kerala', 61], ['International', 18], ['Tamil Nadu', 9], ['Karnataka', 8], ['Andhra Telangana', 4]],
  Kannada: [['Karnataka', 63], ['Andhra Telangana', 10], ['Hindi Belt North India', 12], ['Tamil Nadu', 6], ['International', 9]],
  Hindi: [['Hindi Belt North India', 48], ['Maharashtra', 19], ['International', 13], ['Gujarat', 8], ['South India', 12]],
  English: [['Maharashtra', 24], ['Karnataka', 21], ['Delhi NCR', 19], ['Tamil Nadu', 12], ['Andhra Telangana', 11], ['Kerala', 6]],
};
const WHO = [['General public', 44], ['Media press', 22], ['Verified celebrity', 12], ['Fan page', 13], ['Official studio', 5], ['Bot spam', 4]];
const POST = [['Organic opinion', 45], ['Fan amplified promo', 22], ['Official promo', 14], ['News press coverage', 12], ['Trade box office update', 5], ['Ticket merch', 2]];
const TOPICS = [['Cast performance', 26], ['Box office commercial', 18], ['Music', 14], ['Direction technical craft', 14], ['Story', 16], ['Official promo', 7], ['Politics personal life', 5]];

function makeReport(slug, language, release, score, postsK, viewsM, asOf = null) {
  const r = rng(slug);
  const sided = Math.round(postsK * 1000 * between(r, 0.95, 1.05));
  const positive = Math.round((sided * score) / 100);
  const negative = sided - positive;
  const neutral = Math.round(sided * between(r, 0.05, 0.14));
  const views = Math.round(viewsM * 1e6 * between(r, 0.97, 1.03) / 1e5) * 1e5;
  const reach = Math.round(((positive + negative + neutral) * between(r, 1.6, 2.4)) / 100) * 100;

  // 61 days: 30 before release, release day, 30 after.
  // Trailer spike around day 9, build-up, release peak, then word of mouth that lasts longer for better films.
  const peak = Math.round(between(r, 0.035, 0.05) * sided);
  const daily = Array.from({ length: 61 }, (_, i) => {
    const d = i - 30;
    const trailer = 0.45 * Math.exp(-((i - 9) ** 2) / 3);
    const build = d < 0 ? 0.12 + 0.5 * Math.exp(d / 6) : 0;
    const decay = d >= 0 ? Math.exp(-d / (3 + score / 12)) : 0;
    const wom = d > 2 ? 0.18 * (score / 100) * Math.exp(-((d - 9) ** 2) / 40) : 0;
    const noise = between(r, 0.85, 1.15);
    return Math.max(0, Math.round(peak * (trailer + build + decay + wom) * noise));
  });
  // A film still in its window is only counted up to today
  let sofar = daily;
  let end = addDays(release, 30);
  let scale = 1;
  if (asOf && asOf < end) {
    const days = Math.max(1, Math.round((Date.parse(asOf) - Date.parse(addDays(release, -30))) / 864e5) + 1);
    sofar = daily.slice(0, days);
    end = asOf;
    scale = sofar.reduce((s, v) => s + v, 0) / daily.reduce((s, v) => s + v, 0);
  }
  const total = sofar.reduce((s, v) => s + v, 0);
  const regions = shares(r, REGIONS[language], 0.2).slice(0, 4);
  const unknown = Math.round(between(r, 18, 30));
  const where = shares(r, [...REGIONS[language], ['Unknown', unknown * 1.4]], 0.15);

  return {
    tracking: { start: addDays(release, -30), end },
    sentiment: { positive: Math.round(positive * scale), neutral: Math.round(neutral * scale), negative: Math.round(negative * scale) },
    netSentiment: Math.round((positive / negative) * 100) / 100,
    awareness: { level: views * scale >= 150e6 ? 'Very high' : views * scale >= 60e6 ? 'High' : 'Medium', views: Math.round(views * scale / 1e5) * 1e5 },
    reach: Math.round(reach * scale / 100) * 100,
    mentions: { total, daily: sofar },
    regions,
    audience: {
      where: where.slice(0, 6),
      who: shares(r, WHO),
      postType: shares(r, POST),
      topics: shares(r, TOPICS).slice(0, 6),
    },
  };
}

const dir = new URL('../src/data/films/', import.meta.url);

for (const [slug, q, language, industry, score, postsK, viewsM, trailer, watch] of FILMS) {
  const [, tmdbId, title, release, runtime, genres, director, cast, poster, backdrop] = byQuery[q];
  const releaseDate = toIso(release);
  const film = {
    sample: true,
    title,
    titleConfirmed: true,
    language,
    industry,
    year: +releaseDate.slice(0, 4),
    releaseDate,
    featured: false,
    poster: `https://image.tmdb.org/t/p/w500/${poster}`,
    backdrop: `https://image.tmdb.org/t/p/w1280/${backdrop}`,
    trailer: trailer ? { youtubeId: trailer[0], channel: trailer[1], kind: trailer[2] ?? 'trailer' } : null,
    director,
    cast,
    genres: genres.replace(/, and |, | and /g, '|').split('|'),
    runtime,
    tmdbId,
    watch,
    watchCheckedOn: CHECKED,
    report: makeReport(slug, language, releaseDate, score, postsK, viewsM),
  };
  writeFileSync(new URL(`${slug}.json`, dir), JSON.stringify(film, null, 2) + '\n');
}

for (const [slug, x] of Object.entries(EXTRA)) {
  const file = new URL(`${slug}.json`, dir);
  const film = JSON.parse(readFileSync(file));
  film.sample = true;
  film.watch = x.watch;
  film.watchCheckedOn = CHECKED;
  film.trailer = { kind: 'trailer', ...film.trailer };
  film.report = makeReport(slug, film.language, x.release, x.score, x.postsK, x.viewsM);
  writeFileSync(file, JSON.stringify(film, null, 2) + '\n');
}

// ---------- films in the Whistle Race window (released or releasing around today) ----------
// Real films from TMDB's India "In theatres" and "Coming soon" lists, checked 2026-11-16.
// Released ones are in theatres (no streaming yet); upcoming ones carry their pre-release buzz so far.
const RACE_TMDB = Object.fromEntries(JSON.parse(readFileSync(new URL('./tmdb-race.json', import.meta.url))).map((r) => [r[0], r]));
const TODAY = '2026-11-16';
// slug, TMDB title, industry, target score, opinion posts (K), views (M)
const RACE = [
  ['jailer-2', 'Jailer 2', 'south', 71, 58, 160],
  ['ranabaali', 'Ranabaali', 'south', 78, 44, 118],
  ['street-fighter', 'Street Fighter', 'hollywood', 52, 18, 41],
  ['prahaar', 'Prahaar: The Untold Story of Ujjwal Nikam', 'hindi', 81, 16, 34],
  ['clayface', 'Clayface', 'hollywood', 64, 12, 29],
  ['ramayana-rise-of-a-legend', 'Ramayana: Rise of a Legend', 'hindi', 83, 92, 240],
  ['mookuthi-amman-2', 'Mookuthi Amman 2', 'south', 57, 21, 48],
  ['disco', 'Disco', 'south', 74, 9, 17],
  ['wildwood', 'Wildwood', 'hollywood', 88, 8, 19],
  ['itllu-arjuna', 'Itllu Arjuna', 'south', 61, 7, 14],
  ['v-shantaram', 'V. Shantaram', 'hindi', 69, 6, 12],
  ['hail-mary', 'Hail Mary', 'south', 76, 7, 13],
  ['haindava', 'Haindava', 'south', 59, 9, 22],
  ['paper-tiger', 'Paper Tiger', 'hollywood', 72, 6, 15],
  ['yeh-prem-mol-liya', 'Yeh Prem Mol Liya', 'hindi', 66, 19, 52],
  ['train', 'Train', 'south', 80, 14, 31],
  ['vrushakarma', 'Vrushakarma', 'south', 63, 11, 27],
  ['eetha', 'Eetha', 'hindi', 70, 10, 24],
];
for (const [slug, q, industry, score, postsK, viewsM] of RACE) {
  const [, tmdbId, title, release, runtime, genres, director, cast, poster, backdrop, language] = RACE_TMDB[q];
  const releaseDate = toIso(release);
  const film = {
    sample: true,
    title,
    titleConfirmed: true,
    language,
    industry,
    year: +releaseDate.slice(0, 4),
    releaseDate,
    featured: false,
    poster: `https://image.tmdb.org/t/p/w500/${poster}`,
    backdrop: backdrop ? `https://image.tmdb.org/t/p/w1280/${backdrop}` : null,
    trailer: null,
    director,
    cast,
    genres: genres.replace(/, and |, | and /g, '|').split('|'),
    runtime,
    tmdbId,
    watch: [],
    watchCheckedOn: CHECKED,
    report: makeReport(slug, language, releaseDate, score, postsK, viewsM, TODAY),
  };
  writeFileSync(new URL(`${slug}.json`, dir), JSON.stringify(film, null, 2) + '\n');
}

console.log(`Wrote ${FILMS.length + RACE.length} new sample films and updated ${Object.keys(EXTRA).length}.`);
