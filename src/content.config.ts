import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// One JSON file per film in src/data/films. The file name becomes the page address:
// src/data/films/karuppu.json -> /films/karuppu
// A film with "report": null is listed with its poster and trailer and shows "Score coming soon".
// The full field guide for whoever exports the data is in DATA_FORMAT.md.

const share = z.tuple([z.string(), z.number().min(0).max(100)]);

const report = z.object({
  tracking: z.object({ start: z.string(), end: z.string() }),
  sentiment: z.object({
    positive: z.number().int().min(0),
    neutral: z.number().int().min(0),
    negative: z.number().int().min(0),
  }),
  // Positive ÷ negative (AuraService's Net Sentiment Score). null when nobody complained.
  netSentiment: z.number().nullable(),
  awareness: z.object({ level: z.string(), views: z.number().int().min(0) }),
  reach: z.number().int().min(0),
  mentions: z.object({
    total: z.number().int().min(0),
    // One number per day starting at tracking.start. Missing trailing days count as zero.
    daily: z.array(z.number().min(0)),
  }),
  regions: z.array(share),
  audience: z.object({
    where: z.array(share),
    who: z.array(share),
    postType: z.array(share),
    topics: z.array(share),
  }),
  // How the crowd felt about each aspect (story, acting, songs...): posts about it, their average
  // sentiment score (0-100) and the majority mood. Most-discussed first.
  aspects: z.array(z.object({
    label: z.string(),
    posts: z.number().int().min(0),
    score: z.number().min(0).max(100),
    mood: z.enum(['positive', 'neutral', 'negative']),
  })).default([]),
});

const films = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/data/films' }),
  schema: z.object({
    // true = the report numbers are invented for the prototype. Never launch a film with sample: true.
    sample: z.boolean().default(false),
    // Set by scripts/sync-aura.mjs: the movie's AuraService entity id and name. null for films not in AuraService.
    auraId: z.number().int().nullable().default(null),
    auraName: z.string().nullable().default(null),
    syncedOn: z.string().nullable().default(null),
    // From the Aura collector (Tracked Releases): posts collected so far, scored or not, and the window it
    // scans (7 days either side of release). null for films the collector doesn't track.
    buzz: z.object({
      collected: z.number().int().min(0),
      trackFrom: z.string().nullable(),
      trackUntil: z.string().nullable(),
      popularity: z.number().nullable(),
    }).nullable().default(null),
    title: z.string(),
    // Other names people search for, e.g. ["GD Naidu"]
    aka: z.array(z.string()).default([]),
    titleConfirmed: z.boolean().default(true),
    language: z.string(),
    industry: z.enum(['south', 'hindi', 'hollywood']),
    year: z.number().int(),
    releaseDate: z.string().nullable().default(null),
    featured: z.boolean().default(false),

    poster: z.string().nullable().default(null),
    backdrop: z.string().nullable().default(null),
    trailer: z.object({ youtubeId: z.string(), channel: z.string(), kind: z.enum(['trailer', 'teaser', 'showcase']).default('trailer') }).nullable().default(null),
    director: z.string().nullable().default(null),
    cast: z.array(z.string()).default([]),
    genres: z.array(z.string()).default([]),
    runtime: z.string().nullable().default(null),
    tmdbId: z.number().int().nullable().default(null),
    // Streaming platforms in India, e.g. ["Netflix", "Prime Video"], and the date they were checked
    watch: z.array(z.string()).default([]),
    watchCheckedOn: z.string().nullable().default(null),
    // true = `watch` is placeholder data (AuraService has no streaming API yet). The film page says so.
    watchPlaceholder: z.boolean().default(false),

    report: report.nullable().default(null),
  }),
});

export const collections = { films };

export type FilmReport = z.infer<typeof report>;
