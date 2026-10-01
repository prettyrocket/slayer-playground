import type { MonsterLocation } from '@/data/types';

const yesNo = (value: boolean | null) => (value === null ? '—' : value ? 'Yes' : 'No');

/** What tells one place from another: how many spawn there, and whether it's multi, cannonable or safespottable. */
export const LOCATION_COLUMNS: { label: string; cell: (l: MonsterLocation) => string | number }[] =
  [
    { label: 'Spawns', cell: (l) => l.spawns ?? '—' },
    { label: 'Multi', cell: (l) => yesNo(l.multicombat) },
    { label: 'Cannon', cell: (l) => yesNo(l.cannon) },
    { label: 'Safespot', cell: (l) => yesNo(l.safespot) },
  ];
