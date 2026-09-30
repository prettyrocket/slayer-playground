import { useQuery } from '@tanstack/react-query';

import { fetchJson } from '@/api';
import type { DropsFile, Monster } from '@/data/types';

/** Loads public/data/drops/<slug>.json for a monster that has drops; idle otherwise. */
export function useDrops(monster: Monster | undefined) {
  return useQuery({
    queryKey: ['drops', monster?.slug],
    queryFn: () => fetchJson<DropsFile>(`data/drops/${monster!.slug}.json`),
    enabled: !!monster?.hasDrops,
    staleTime: Infinity, // a snapshot that only changes with a deploy
  });
}
