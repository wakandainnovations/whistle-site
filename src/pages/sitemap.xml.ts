// /sitemap.xml: every page search engines should index. Films with sample data are left out (their
// pages are also noindex), and so are the badge SVGs.
import type { APIRoute } from 'astro';
import { getFilms } from '../lib/films';

const PAGES = ['/', '/films/', '/race/', '/how/', '/creators/', '/contact/', '/privacy/', '/terms/'];

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

export const GET: APIRoute = async ({ site }) => {
  const films = (await getFilms()).filter((f) => !f.data.sample);
  const built = new Date().toISOString().slice(0, 10);
  const urls = [
    ...PAGES.map((p) => ({ loc: new URL(p, site).href, lastmod: built })),
    ...films.map((f) => ({ loc: new URL(`/films/${f.id}/`, site).href, lastmod: f.data.syncedOn ?? f.data.watchCheckedOn ?? built })),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${esc(u.loc)}</loc><lastmod>${u.lastmod.slice(0, 10)}</lastmod></url>`).join('\n')}
</urlset>
`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
