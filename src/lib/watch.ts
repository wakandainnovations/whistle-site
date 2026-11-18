// Streaming platforms and how they look on the site.
// The link goes to the film's TMDB "Where to watch" page for India, which links straight into each app.

export const PLATFORMS: Record<string, { color: string }> = {
  Netflix: { color: '#E50914' },
  'Prime Video': { color: '#1A98FF' },
  JioHotstar: { color: '#2B7BF6' },
  ZEE5: { color: '#8230C6' },
  SonyLIV: { color: '#F2A30F' },
  'Sun NXT': { color: '#F26B1D' },
  aha: { color: '#FF6A00' },
};

export const platformColor = (name: string) => PLATFORMS[name]?.color ?? '#9C8FA3';

export function watchUrl(tmdbId: number | null, title: string) {
  return tmdbId
    ? `https://www.themoviedb.org/movie/${tmdbId}/watch?locale=IN`
    : `https://www.justwatch.com/in/search?q=${encodeURIComponent(title)}`;
}
