import { useQuery } from '@tanstack/react-query';

import { fetchJson } from '@/api';
import type { UnlocksFile } from '@/data/types';

/** Loads public/data/unlocks.json: the Slayer Rewards unlocks and extends, with costs. */
export function useUnlocks() {
  return useQuery({
    queryKey: ['unlocks'],
    queryFn: () => fetchJson<UnlocksFile>('data/unlocks.json'),
    staleTime: Infinity, // a snapshot that only changes with a deploy
  });
}
