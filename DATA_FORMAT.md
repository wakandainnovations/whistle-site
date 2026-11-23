# Film data format

Each scored film is one JSON file in `src/data/films/`. The file name is the page address:
`src/data/films/karuppu.json` becomes `/films/karuppu`. Scored films also get a badge at `/badge/<name>.svg`.
Use lowercase words and hyphens, e.g. `kantara-chapter-1.json`.

The build checks every file against the schema in `src/content.config.ts` and stops with a clear error if a field is missing or has the wrong type.

The Whistle Score itself is **not** in the file. The site works it out from the sentiment counts, so the formula lives in one place (`src/lib/score.ts`): (positive + w·neutral) ÷ all posts, averaged toward the typical film's share by 50 posts' worth, so films with few posts sit near the middle. A neutral post counts as w of a cheer: ⅓ up to 1,000 posts, rising evenly to ½ at 4,000 posts.

Files with an `auraId` are written by `npm run sync` (`scripts/sync-aura.mjs`) from AuraService; edit the curated fields only (title, aka, trailer, backdrop, tmdbId, featured, watch), the rest is overwritten on the next sync.

## Fields

### About the film (every film)

| Field | Type | What it is |
|---|---|---|
| `sample` | true / false | `true` means the report numbers are made up for the prototype. The site tags these films "Sample". Never launch a film with `sample: true` |
| `title` | text | Film title as shown on the site |
| `titleConfirmed` | true / false | `false` shows "Title to confirm" on the poster |
| `language` | text | Main language, e.g. `"Tamil"` |
| `industry` | `"south"`, `"hindi"` or `"hollywood"` | Which homepage tab it appears under |
| `year` | number | Release year |
| `releaseDate` | `"YYYY-MM-DD"` or `null` | Release date |
| `featured` | true / false | Shown in the homepage hero. Set it on one scored film only |
| `poster` | image URL or `null` | Portrait poster. TMDB: `https://image.tmdb.org/t/p/w500/<file>.jpg` |
| `backdrop` | image URL or `null` | Wide still for the film page and the "Now on Whistle" row. TMDB: `https://image.tmdb.org/t/p/w1280/<file>.jpg` |
| `trailer` | `{ "youtubeId": "...", "channel": "...", "kind": "trailer" }` or `null` | Official trailer. `youtubeId` is the part after `watch?v=`. `kind` is `trailer`, `teaser` or `showcase`. Use the studio's or music label's own channel |
| `director` | text or `null` | |
| `cast` | list of names | Lead cast, up to four |
| `genres` | list of text | |
| `runtime` | text or `null` | e.g. `"2h 32m"` |
| `tmdbId` | number or `null` | The film's TMDB id. Also used for the "Watch on" links |
| `watch` | list of platform names | Where it streams in India, e.g. `["Netflix", "Prime Video"]`. Check the film's TMDB "Where to watch" page (India). Names with a set colour: Netflix, Prime Video, JioHotstar, ZEE5, SonyLIV, Sun NXT, aha |
| `watchPlaceholder` | true / false | `true` = `watch` is placeholder data (AuraService has no streaming API yet). The page says so |
| `buzz` | object or null | From the Aura collector (Tracked Releases): `collected` (posts gathered so far, sentiment-scored or not), `trackFrom` / `trackUntil` (the scan window, 7 days either side of release), `popularity` (TMDB). Drives "Most talked about". Set by the sync |
| `watchCheckedOn` | `"YYYY-MM-DD"` or `null` | When `watch` was last checked. Shown on the film page |
| `report` | object or `null` | The Whistle data below. `null` lists the film with "Score coming soon" |

A film needs both `backdrop` and `trailer` to appear in the homepage's "Now on Whistle" row.

### The report (scored films only)

| Field | Type | What it is | Framehouse dashboard source |
|---|---|---|---|
| `report.tracking.start`, `.end` | `"YYYY-MM-DD"` | First and last day of data collection | Date range |
| `report.sentiment.positive` / `neutral` / `negative` | whole numbers | Post counts by tone | Sentiment distribution |
| `report.netSentiment` | number or `null` | Positive ÷ negative, e.g. `1.6`. `null` when there are no negative posts | Net sentiment score |
| `report.awareness.level` | text | e.g. `"High"` | Awareness |
| `report.awareness.views` | whole number | Total views, e.g. `30100000` | Awareness (views) |
| `report.reach` | whole number | Unique people posting | Reach |
| `report.mentions.total` | whole number | Total mentions in the window | Total mentions |
| `report.mentions.daily` | list of numbers | One value per day from `tracking.start`. Trailing days can be left off and count as zero | Total mentions chart |
| `report.regions` | list of `["Name", percent]` | Top regions, share of posts with a known location | Top regions by buzz |
| `report.audience.where` / `who` / `postType` / `topics` | lists of `["Name", percent]` | Where they are, who is posting, what they post, what they talk about | Audience report |
| `report.aspects` | list of `{label, posts, score, mood}` | How the crowd felt about each aspect (story, acting, songs...): post count, average sentiment 0-100, majority mood. Optional | Summary: what viewers liked and complained about |

Percentages are whole numbers from 0 to 100. Put the largest first; the first row is highlighted.

## Example

Real Framehouse data: `src/data/films/gd-naidu.json`. Made-up sample stats: any other file, e.g. `src/data/films/karuppu.json`. A film with `"report": null` shows "Score coming soon".

## Before a film goes live, check

- `netSentiment` should equal `positive ÷ negative` (to two decimals). If they disagree, the site will show two numbers that don't match.
- `mentions.total` and the sentiment counts: if they count different things (e.g. mentions vs all posts and comments), tell the site team so the labels say so.
- The tracking window should cover 30 days before release to 30 days after.

## Sample films

`scripts/generate-samples.mjs` writes the sample films with made-up buzz stats (seeded, so re-running gives the same numbers). Film facts, posters, trailers and streaming platforms in that script are real; only the `report` numbers are invented. Delete a sample file, or replace its `report` with real Framehouse numbers and set `sample` to `false`, before going live.
