import { describe, expect, it } from 'vitest';

import { areaName, isListed, lowestLevel, placesOf, regionsOf } from '@/data/locations';
import type { Monster, MonsterLocation } from '@/data/types';

const at = (name: string, more: Partial<MonsterLocation> = {}): MonsterLocation => ({
  name,
  page: name,
  levels: [],
  spawns: null,
  multicombat: null,
  cannon: null,
  safespot: null,
  ...more,
});

const monster = (page: string, locations: MonsterLocation[]) => ({ page, locations }) as Monster;

describe('placesOf', () => {
  it('groups places across monsters, most spawns first', () => {
    const demon = monster('Black demon', [
      at('Taverley Dungeon', { spawns: 24 }),
      at('Catacombs of Kourend', { spawns: 4, multicombat: true }),
    ]);
    const skotizo = monster('Skotizo', [at('catacombs of Kourend', { spawns: 1 })]);
    const places = placesOf([demon, skotizo]);

    expect(places.map((p) => [p.name, p.spawns])).toEqual([
      ['Taverley Dungeon', 24],
      // Same place, whatever the case; spawns add up.
      ['Catacombs of Kourend', 5],
    ]);
    expect(places[1].multicombat).toBe(true);
    expect(places[1].monsters.map((m) => m.monster.page)).toEqual(['Black demon', 'Skotizo']);
  });

  it('groups places sharing a wiki page into a region, naming each within it', () => {
    const places = placesOf([
      monster('Abyssal demon', [
        at('Slayer Tower (floor 2)', { page: 'Slayer Tower', spawns: 14 }),
        at('Slayer Tower (basement)', { page: 'Slayer Tower', spawns: 14 }),
        at('Catacombs of Kourend', { spawns: 13 }),
      ]),
      monster('Greater demon', [
        at('Brimhaven Dungeon upper level', { page: 'Brimhaven Dungeon' }),
      ]),
    ]);
    const regions = regionsOf(places);
    expect(regions.map((r) => [r.name, r.spawns, r.areas.length])).toEqual([
      ['Slayer Tower', 28, 2],
      ['Catacombs of Kourend', 13, 1],
      ['Brimhaven Dungeon', null, 1],
    ]);
    expect(regions[0].areas.map((a) => areaName(regions[0], a))).toEqual(['Basement', 'Floor 2']);
    expect(areaName(regions[2], regions[2].areas[0])).toBe('Upper level');
    expect(areaName(regions[1], regions[1].areas[0])).toBe('Catacombs of Kourend');
  });

  it("matches a master's listed places by name or page", () => {
    const [tower, catacombs] = placesOf([
      monster('A', [
        at('Slayer Tower (basement)', { page: 'Slayer Tower', spawns: 2 }),
        at('Catacombs of Kourend', { spawns: 1 }),
      ]),
    ]);
    expect(isListed(tower, ['Slayer Tower (location)'])).toBe(true);
    expect(isListed(catacombs, ['catacombs of kourend'])).toBe(true);
    expect(isListed(catacombs, ['Slayer Tower'])).toBe(false);
  });

  it('gives the lowest level at a place', () => {
    const [place] = placesOf([
      monster('A', [at('Cave', { levels: [92, 104] })]),
      monster('B', [at('Cave', { levels: [88] })]),
    ]);
    expect(lowestLevel(place)).toBe(88);
  });

  it('takes the first answer any monster has for multi, cannon and safespot', () => {
    const [place] = placesOf([
      monster('A', [at('Cave', { cannon: null })]),
      monster('B', [at('Cave', { cannon: false })]),
    ]);
    expect(place.cannon).toBe(false);
    expect(place.spawns).toBeNull();
  });
});
