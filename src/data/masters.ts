import { MASTER_KEYS, type MasterKey } from '@/data/types';

export interface Master {
  key: MasterKey;
  name: string;
}

// masters.json has these names (and alternates like Steve), but navigation
// reads them synchronously; they move there with the data layer (#10).
const MASTER_NAMES: Record<MasterKey, string> = {
  turael: 'Turael',
  spria: 'Spria',
  mazchna: 'Mazchna',
  vannaka: 'Vannaka',
  chaeldar: 'Chaeldar',
  konar: 'Konar quo Maten',
  nieve: 'Nieve / Steve',
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
