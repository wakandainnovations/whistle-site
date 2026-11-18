// Plain-English versions of the Framehouse report labels, for the public film page.
// The data files keep Framehouse's own labels; only what people read changes here.

const LABELS: Record<string, string> = {
  // who is posting
  'General public': 'Regular moviegoers',
  'Media press': 'News and media',
  'Verified celebrity': 'Celebrities',
  'Verified celebrity influencer': 'Celebrities and influencers',
  'Official studio': 'The film’s own team',
  'Fan page': 'Fan pages',
  'Bot spam': 'Bots (filtered out)',
  // what they talk about
  General: 'The film overall',
  'Box office commercial': 'Box office',
  'Cast performance': 'The acting',
  'Direction technical craft': 'Direction and craft',
  'Politics personal life': 'Off-screen gossip',
  'Official promo': 'Promos and posters',
  Story: 'The story',
  Music: 'The music',
  // what they talk about: AuraService's Mention Drivers (review aspects)
  'General discussion': 'The film overall',
  'Music / songs': 'The songs and music',
  Direction: 'The direction',
  'Acting / cast performance': 'The acting',
  Screenplay: 'The screenplay',
  'Lead pair': 'The lead pair',
  Runtime: 'The length',
  'First half': 'The first half',
  'Second half': 'The second half',
  Climax: 'The climax',
  VFX: 'The VFX',
  // places
  'Andhra Telangana': 'Andhra Pradesh and Telangana',
  'Hindi Belt North India': 'North India',
  'Diaspora International': 'Outside India',
  International: 'Outside India',
  'Delhi NCR': 'Delhi NCR',
};

export const plain = (label: string) => LABELS[label] ?? label;

// "Who was talking": AuraService's Top Drivers (what kind of post it was), said as who posted it
const DRIVERS: Record<string, string> = {
  'Organic opinion': 'Moviegoers giving their own take',
  'Fan amplified promo': 'Fans spreading the promos',
  'Official promo': 'The film’s own team',
  'News press coverage': 'News and media',
  'Trade box office update': 'Box-office trackers',
  'Ticket merch marketplace': 'Ticket and merch sellers',
  'Ticket merch': 'Ticket and merch sellers',
};
export const plainDriver = (label: string) => DRIVERS[label] ?? label;

/** 62 -> "6 in 10" */
export function inTen(score: number) {
  return `${Math.round(score / 10)} in 10`;
}

/** Framehouse awareness level -> how big the buzz was, in words */
export function buzzWord(level: string) {
  const l = level.toLowerCase();
  if (l.includes('very')) return 'Massive';
  if (l.includes('high')) return 'Big';
  if (l.includes('medium')) return 'Decent';
  return 'Quiet';
}

/** Net sentiment (positive ÷ negative) -> "5.2×" and which way it leans. null = nobody complained. */
export function cheersPerBoo(net: number | null): { value: string; label: string } {
  if (net === null) return { value: 'All', label: 'cheers, not one complaint' };
  if (net === 0) return { value: '0', label: 'cheers so far, only complaints' };
  const x = net >= 1 ? net : 1 / net;
  const value = `${x >= 10 ? Math.round(x) : +x.toFixed(1)}×`;
  return { value, label: net >= 1 ? 'more cheers than complaints' : 'more complaints than cheers' };
}
