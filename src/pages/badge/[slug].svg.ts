// The creator badge, one static SVG per film: /badge/gd-naidu.svg
import type { APIRoute, GetStaticPaths } from 'astro';
import { getFilms } from '../../lib/films';
import type { CollectionEntry } from 'astro:content';
import { whistleScore, tierFor, scoreLabel } from '../../lib/score';

export const getStaticPaths: GetStaticPaths = async () => {
  const films = await getFilms();
  // Only scored films get a badge
  return films.filter((film) => film.data.report).map((film) => ({ params: { slug: film.id }, props: { film } }));
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export const GET: APIRoute = ({ props }) => {
  const { film } = props as { film: CollectionEntry<'films'> };
  const score = whistleScore(film.data.report!.sentiment);
  const t = tierFor(score);
  // Whistle mark with the band's sound waves, drawn on the gold square
  const arcs = [
    'M30 26a7 7 0 0 1 0 10', 'M34 22.5a12 12 0 0 1 0 17', 'M38 19a17 17 0 0 1 0 24',
  ].slice(0, t.waves).map((d) => `<path d="${d}" stroke="#1A0F1F" stroke-width="2.6" fill="none" stroke-linecap="round"/>`).join('');
  // Plain system fonts: a badge is shown on other sites, where our web fonts don't load.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="64" viewBox="0 0 220 64" role="img" aria-label="${esc(scoreLabel(score))}, ${esc(t.name)}">
  <rect width="220" height="64" rx="12" fill="#120B16"/>
  <rect x="8" y="8" width="48" height="48" rx="9" fill="#F6A821"/>
  <circle cx="22" cy="31" r="6" fill="#1A0F1F"/>${arcs}
  <text x="68" y="33" font-family="Arial Narrow, Arial, sans-serif" font-weight="700" font-size="22" fill="#F7EFF4">${score}%<tspan font-size="13" letter-spacing="1.5" fill="#F8B840" dx="6">WHISTLE</tspan></text>
  <text x="68" y="50" font-family="Arial, sans-serif" font-size="11.5" fill="#B4A3B9">${esc(t.name)}</text>
</svg>`;
  return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml' } });
};
