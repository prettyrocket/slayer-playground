import { describe, expect, it } from 'vitest';

import { placesOf } from '@/data/locations';
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

  it('takes the first answer any monster has for multi, cannon and safespot', () => {
    const [place] = placesOf([
      monster('A', [at('Cave', { cannon: null })]),
      monster('B', [at('Cave', { cannon: false })]),
    ]);
    expect(place.cannon).toBe(false);
    expect(place.spawns).toBeNull();
  });
});
