import { describe, expect, it } from 'vitest';

import type { Monster, SlayerCategory } from '../../src/data/types.ts';
import { chooseIcons } from './icons.ts';

const monster = (page: string, categories: string[], more: Partial<Monster> = {}): Monster => ({
  slug: page.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  page,
  slayerLevel: null,
  categories,
  assignedBy: [],
  taskOnly: false,
  members: true,
  hasDrops: true,
  icon: null,
  superior: null,
  superiorOf: [],
  versions: [{ image: `${page}.png` } as Monster['versions'][number]],
  locations: [],
  ...more,
});

const category = (name: string, monsters: Monster[], unlocks: string[] = []): SlayerCategory => ({
  category: name,
  aliases: [],
  slayerLevel: null,
  icon: null,
  page: null,
  monsters: monsters.map((m) => m.slug),
  masters: [],
  unlocks,
  extend: null,
  equipment: [],
});

describe('chooseIcons', () => {
  it('prefers the in-game Slayer icon, by category or by a single-category monster', () => {
    const jelly = monster('Jelly', ['jellies']);
    const demon = monster('Abyssal demon', ['abyssal demons']);
    const icons = chooseIcons(
      [category('abyssal demons', [demon]), category('jellies', [jelly])],
      [demon, jelly],
      [
        'File:Abyssal demon icon.png',
        'File:Abyssal demon icon (Christmas).png',
        'File:Jelly icon.png',
        'File:Slayer icon.png',
      ],
    );
    expect(Object.fromEntries(icons)).toEqual({
      'abyssal demons': 'File:Abyssal demon icon.png',
      jellies: 'File:Jelly icon.png',
    });
  });

  it("uses the picture of a category's required unlock", () => {
    const vorkath = monster('Vorkath', ['bosses']);
    const icons = chooseIcons(
      [category('bosses', [vorkath], ['Like a Boss'])],
      [vorkath],
      ['File:Like a boss.png'],
    );
    expect(icons.get('bosses')).toBe('File:Like a boss.png');
  });

  it('falls back to the most typical monster: namesake, then named after it, then real', () => {
    const wolves = [
      monster('Big Wolf', ['wolves']),
      monster('Wolf (level 11)', ['wolves']),
      monster('Wolfie', ['wolves']),
    ];
    const bears = [
      monster('Artio', ['bears', 'bosses']),
      monster('Grizzly bear', ['bears']),
      monster('Bear Cub', ['bears']),
    ];
    const trolls = [
      monster('Dad', ['trolls'], { hasDrops: false }),
      monster('Mountain goblin', ['trolls']),
      monster('Rock (Troll)', ['trolls'], { versions: [{ image: null } as never] }),
    ];
    const categories = [
      category('wolves', wolves),
      category('bears', bears),
      category('trolls', trolls),
    ];
    const icons = chooseIcons(categories, [...wolves, ...bears, ...trolls], []);
    expect(Object.fromEntries(icons)).toEqual({
      wolves: 'File:Wolf (level 11).png', // its namesake, despite the longer name
      bears: 'File:Bear Cub.png', // named after it; not the boss, and the plainest
      trolls: 'File:Mountain goblin.png', // a real monster over a minigame copy; one with an image
    });
  });

  it('skips superiors and categories with no picture at all', () => {
    const superior = monster('Greater abyssal demon', ['abyssal demons'], { superiorOf: ['x'] });
    const icons = chooseIcons(
      [category('abyssal demons', [superior]), category('empty', [])],
      [superior],
      [],
    );
    expect(icons.size).toBe(0);
  });
});
