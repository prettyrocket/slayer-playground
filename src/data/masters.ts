import { useQuery } from '@tanstack/react-query';

import { fetchJson } from '@/api';
import { MASTER_KEYS, type MasterKey, type MastersFile } from '@/data/types';

export interface Master {
  key: MasterKey;
  name: string;
}

// masters.json has these names too (and alternate masters, which we don't
// show: some are quest spoilers), but navigation reads them synchronously; they
// move there with the data layer (#10).
const MASTER_NAMES: Record<MasterKey, string> = {
  turael: 'Turael',
  spria: 'Spria',
  mazchna: 'Mazchna',
  vannaka: 'Vannaka',
  chaeldar: 'Chaeldar',
  konar: 'Konar quo Maten',
  nieve: 'Nieve',
  duradel: 'Duradel',
  krystilia: 'Krystilia',
  mortimer: 'Mortimer',
};

/** Every Slayer master, in MASTER_KEYS order (roughly lowest to highest level). */
export function getMasters(): Master[] {
  return MASTER_KEYS.map((key) => ({ key, name: MASTER_NAMES[key] }));
}

export function getMaster(key: string | null | undefined): Master | undefined {
  return getMasters().find((master) => master.key === key);
}

/** A master's chathead under public/data, synced by sync-data. */
export function masterIcon(key: MasterKey): string {
  return `icons/masters/${key}.png`;
}

/** Loads public/data/masters.json: each master's assignment table. */
export function useMastersFile() {
  return useQuery({
    queryKey: ['masters'],
    queryFn: () => fetchJson<MastersFile>('data/masters.json'),
    staleTime: Infinity, // a snapshot that only changes with a deploy
  });
}
