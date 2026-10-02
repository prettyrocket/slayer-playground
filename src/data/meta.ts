import { useQuery } from '@tanstack/react-query';

import { fetchJson } from '@/api';
import type { MetaFile } from '@/data/types';

export const WIKI_URL = 'https://oldschool.runescape.wiki';
export const LICENSE_URL = 'https://creativecommons.org/licenses/by-nc-sa/3.0/';

/** A wiki page's URL from its title: "Nieve/Slayer assignments" -> .../w/Nieve/Slayer_assignments */
export function wikiUrl(title: string): string {
  return `${WIKI_URL}/w/${encodeURI(title.replaceAll(' ', '_'))}`;
}

/** Loads public/data/meta.json: when the data last changed, and the wiki pages it came from. */
export function useMeta() {
  return useQuery({
    queryKey: ['meta'],
    queryFn: () => fetchJson<MetaFile>('data/meta.json'),
    staleTime: Infinity, // a snapshot that only changes with a deploy
  });
}
