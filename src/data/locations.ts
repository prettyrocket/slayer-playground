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

/** A place's lowest monster level, or null when the wiki gives none. */
export function lowestLevel(place: Place): number | null {
  const levels = place.monsters.flatMap((m) => m.location.levels);
  return levels.length ? Math.min(...levels) : null;
}

/**
 * Places that share a wiki page, like the floors of the Slayer Tower: `areas`
 * are its places, most spawns first. Most regions have one area.
 */
export interface Region {
  name: string;
  page: string | null;
  spawns: number | null;
  areas: Place[];
}

/** `places` grouped by the wiki page they link, in the order of their first place. */
export function regionsOf(places: Place[]): Region[] {
  const byPage = new Map<string, Region>();
  for (const place of places) {
    const key = (place.page ?? place.name).toLowerCase();
    const region = byPage.get(key) ?? {
      name: place.page ?? place.name,
      page: place.page,
      spawns: null,
      areas: [],
    };
    byPage.set(key, region);
    region.areas.push(place);
    if (place.spawns !== null) region.spawns = (region.spawns ?? 0) + place.spawns;
  }
  return [...byPage.values()];
}

/**
 * A place's name within its region: "Slayer Tower (floor 2)" -> "Floor 2",
 * "Brimhaven Dungeon upper level" -> "Upper level". The whole name when it
 * doesn't start with the region's.
 */
export function areaName(region: Region, place: Place): string {
  const lower = place.name.toLowerCase();
  const prefix = region.name.toLowerCase();
  if (!lower.startsWith(prefix) || lower === prefix) return place.name;
  const rest = place.name
    .slice(prefix.length)
    .replace(/^[\s,:-]*\(?|\)?\s*$/g, '')
    .trim();
  return rest ? rest[0].toUpperCase() + rest.slice(1) : place.name;
}

/** "Troll Stronghold (location)" -> "troll stronghold": how masters' tables name places. */
const placeKey = (page: string) => page.replace(/ \(location\)$/, '').toLowerCase();

/** Whether a master's listed places (`Assignment.locations`) include this one. */
export function isListed(place: Place, listed: string[]): boolean {
  const keys = new Set(listed.map(placeKey));
  return keys.has(place.name.toLowerCase()) || (!!place.page && keys.has(placeKey(place.page)));
}
