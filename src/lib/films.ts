// The films the website shows. Every page reads films through getFilms(), never getCollection('films'),
// so one rule decides what's on the site (hasEnoughTalk in ./now): a film the collector tracks needs more
// than 1,000 collected posts; one it doesn't track needs more than 100 sentiment-scored posts. Released or
// upcoming. A film below it has no page, badge, card, race spot or homepage slot until a later sync takes
// it over the line. Scored posts also decide whether a Whistle % is promoted or banded (scoreSolid).
import { getCollection, type CollectionEntry } from 'astro:content';
import { hasEnoughTalk } from './now';

export type Film = CollectionEntry<'films'>;

export const isShown = (f: Film) => hasEnoughTalk(f);

export async function getFilms(): Promise<Film[]> {
  return getCollection('films', isShown);
}
