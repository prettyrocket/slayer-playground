import type { Monster, MonsterLocation } from '@/data/types';

export const yesNo = (value: boolean | null) => (value === null ? '—' : value ? 'Yes' : 'No');

/** What tells one place from another: how many spawn there, and whether it's multi, cannonable or safespottable. */
export const LOCATION_COLUMNS: { label: string; cell: (l: MonsterLocation) => string | number }[] =
  [
    { label: 'Spawns', cell: (l) => l.spawns ?? '—' },
    { label: 'Multi', cell: (l) => yesNo(l.multicombat) },
    { label: 'Cannon', cell: (l) => yesNo(l.cannon) },
    { label: 'Safespot', cell: (l) => yesNo(l.safespot) },
  ];

/** A place where some of a category's monsters spawn, with them. */
export interface Place {
  name: string;
  page: string | null;
  /** All its monsters' spawns; null when the wiki gives none. */
  spawns: number | null;
  /** The first answer any of its monsters has (they come from the same task-page row). */
  multicombat: boolean | null;
  cannon: boolean | null;
  safespot: boolean | null;
  /** Most spawns first. */
  monsters: { monster: Monster; location: MonsterLocation }[];
}

const bySpawns = (a: number | null, b: number | null) => (b ?? 0) - (a ?? 0);

/** The places `monsters` spawn, grouped by name across monsters, most spawns first. */
export function placesOf(monsters: Monster[]): Place[] {
  const byName = new Map<string, Place>();
  for (const monster of monsters) {
    for (const location of monster.locations) {
      const key = location.name.toLowerCase();
      const place = byName.get(key) ?? {
        name: location.name,
        page: location.page,
        spawns: null,
        multicombat: null,
        cannon: null,
        safespot: null,
        monsters: [],
      };
      byName.set(key, place);
      if (location.spawns !== null) place.spawns = (place.spawns ?? 0) + location.spawns;
      place.multicombat ??= location.multicombat;
      place.cannon ??= location.cannon;
      place.safespot ??= location.safespot;
      place.monsters.push({ monster, location });
    }
  }
  const places = [...byName.values()];
  for (const place of places) {
    place.monsters.sort(
      (a, b) =>
        bySpawns(a.location.spawns, b.location.spawns) ||
        a.monster.page.localeCompare(b.monster.page),
    );
  }
  return places.sort((a, b) => bySpawns(a.spawns, b.spawns) || a.name.localeCompare(b.name));
}
