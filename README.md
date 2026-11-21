# Whistle

The public film index from Framehouse. Every scored film gets a page with its Whistle Score and the social metrics behind it, plus a badge creators can embed.

Built with [Astro](https://docs.astro.build). It is a static site: `npm run build` produces plain HTML, CSS and SVG files in `dist/` that can be hosted anywhere.

## Run it

Needs Node 22 or newer.

```bash
npm install
npm run dev        # http://localhost:4321, reloads as you edit
npm run build      # writes the finished site to dist/
npm run preview    # serves dist/ to check the build
```

## Pull films from AuraService

Every movie in the aura database is pulled from AuraService (the same backend as aura-radix) by a sync script:

```bash
# .env (never committed): an AuraService admin login, so every owner's movies can be read
AURA_USERNAME=...
AURA_PASSWORD=...
# AURA_BASE_URL=http://localhost:8080   (default)

npm run sync                      # all movies -> src/data/films/*.json, posters -> public/posters/
npm run sync -- --only gd-naidu   # one film
npm run build
```

To sync automatically every hour (at :15) on macOS, run `scripts/install-sync-schedule.sh` once (`--uninstall` removes it). It installs a launchd job that runs `scripts/sync-scheduled.sh` and logs to `~/Library/Logs/whistle-sync.log`; the dev server picks up the new files, and `WHISTLE_BUILD=1` in the job also rebuilds `dist/`. Keep the repo outside `~/Documents`, `~/Desktop` and `~/Downloads`: macOS blocks background jobs from reading those folders.

The header of `scripts/sync-aura.mjs` lists which AuraService endpoint feeds each part of the film page. The Whistle is the share of cheers among posts that took a side, (positive + 50·μ) ÷ (positive + negative + 50), where μ is the typical real film's share; neutral posts are left out (see `src/lib/score.ts`). Hand-curated fields (title, aka, trailer, backdrop, tmdbId, featured, checked streaming platforms) survive a re-sync. AuraService has no streaming data yet, so released films get placeholder platforms (`watchPlaceholder: true`, labelled on the page); swap `placeholderStreaming()` for the API when it exists. "Most talked about" on the homepage lists real films in theatres (released in the last 30 days) or out within a week, by posts the collector has gathered (`buzz.collected`, the number on the Tracked Releases admin page), with trailer/clip views breaking ties; see `mostTalked()` in `src/lib/now.ts`. The site only shows films with enough talk (`hasEnoughTalk()`), upcoming ones included: more than 1,000 collected posts for a film the collector tracks (`MIN_COLLECTED_SHOWN`), more than 100 sentiment-scored posts for one it doesn't; a Whistle % is banded or promoted only with more than 100 opinionated (positive + negative) posts (`MIN_POSTS_SHOWN`, see `scoreSolid()`): every page reads films through `getFilms()` in `src/lib/films.ts`, never `getCollection('films')` directly.

## Add a film

1. Add a JSON file to `src/data/films/` (format in [DATA_FORMAT.md](DATA_FORMAT.md)).
2. Add its poster, still, trailer and streaming platforms (see DATA_FORMAT.md).
3. Run `npm run build`. The film's page, its homepage card and its badge are generated from the file.

## Where things live

| Path | What it is |
|---|---|
| `src/site.config.ts` | Brand name, company name, homepage wording, language filters |
| `src/lib/watch.ts` | Streaming platform colours and the where-to-watch link |
| `scripts/sync-aura.mjs` | Pulls every aura movie from AuraService (`npm run sync`) |
| `scripts/generate-samples.mjs` | Writes the sample films (made-up stats) |
| `src/lib/score.ts` | The Whistle formula, how a score is said ("62% Whistle") and the four bands (Full Whistle, Whistle-worthy, Half Whistle, No Whistle) |
| `src/content.config.ts` | The film data schema; the build checks every film file against it |
| `src/data/films/` | One JSON file per film |
| `src/pages/index.astro` | Homepage |
| `src/pages/films/index.astro` | All films, with search and filters (presettable by URL: `?lang=`, `?band=`, `?platform=`, `?sort=`, `?q=`) |
| `src/pages/how.astro` | How it's scored |
| `src/pages/race.astro` | The Whistle Race: every AuraService film on one release timeline (long gaps collapse into a break) and the hourly leaderboard |
| `src/pages/privacy.astro`, `src/pages/terms.astro` | Legal pages (shared layout in `src/layouts/Legal.astro`) |
| `src/pages/creators.astro` | Badge builder for creators (`?film=` picks the film) |
| `src/layouts/Layout.astro` | Header with the hover menus, and the footer |
| `src/pages/films/[slug].astro` | Film page template |
| `src/pages/badge/[slug].svg.ts` | Creator badge, one SVG per film |
| `src/components/` | Dial, bars, mentions chart, sentiment donut, poster, film card |
| `src/styles/global.css` | Colours, type and layout. Colour tokens are at the top |

Astro components are HTML with a JavaScript block at the top, close to JSX. You can also drop React components in later (`npx astro add react`) if that is easier, since the Framehouse front end is React.

## Hosting

Any static host works. Point it at this folder with build command `npm run build` and output folder `dist`:

- Cloudflare Pages, Netlify or Vercel: connect the Git repo, free at this size.
- AWS: upload `dist/` to an S3 bucket behind CloudFront.

Before launch, set the real domain in `astro.config.mjs` (`site`). Share links and badge codes are built from it.

## Before launch

- Replace `whistle.example` with the real domain.
- Set `previewNote` in `src/site.config.ts` to `''` to remove the preview banner.
- Confirm the company name in `src/site.config.ts`.
- Remove every film with `"sample": true`, or swap in its real Framehouse numbers. `grep -l '"sample": true' src/data/films/*.json` lists them.
- Re-check streaming platforms (`watch`): availability changes often.
- Fill in `legal` in `src/site.config.ts` (legal entity, address, Grievance Officer, courts city) and set `draft: false`. Empty values show as highlighted placeholders on `/privacy` and `/terms`. Have a lawyer review both pages.
- Connect the hourly feed for The Whistle Race (`src/pages/race.astro`, `hourly()`: current and previous-hour score per film) and the film-page live counter (`src/components/LiveCounter.astro`, `feed`). Both are simulated until then.
- Contact form (`/contact`): messages go to `legal.contactEmail`, which is never printed on the page. Until `legal.formEndpoint` is set to a form service (Formspree, Web3Forms...), "Send" opens the visitor's email app with the message filled in. If you add a form service, name it in the Privacy Policy.
- Update `src/pages/privacy.astro` if you add analytics, sign-ups or Whistle Pro.
