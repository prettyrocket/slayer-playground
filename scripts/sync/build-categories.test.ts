import { describe, expect, it } from 'vitest';

import type { MasterKey, Monster } from '../../src/data/types.ts';
import { type BuildInput, buildCategories, resolveCategory } from './build-categories.ts';
import type { RawAssignment } from './masters.ts';
import { linkSuperiors } from './normalize.ts';
import type { RawUnlock } from './parsers.ts';

const monster = (page: string, categories: string[]): Monster => ({
  slug: page.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  page,
  slayerLevel: null,
  categories,
  assignedBy: [],
  taskOnly: false,
  members: true,
  hasDrops: false,
  icon: null,
  superior: null,
  superiorOf: [],
  versions: [],
  locations: [],
});

const row = (name: string, overrides: Partial<RawAssignment> = {}): RawAssignment => ({
  name,
  link: null,
  weight: 5,
  amount: [10, 20],
  extended: null,
  slayerLevel: null,
  combatLevel: null,
  requirements: null,
  alternatives: [],
  excludes: [],
  locations: [],
  wildernessLevels: null,
  ...overrides,
});

const unlock = (name: string, kind: RawUnlock['kind'], links: string[] = []): RawUnlock => ({
  name,
  cost: 100,
  kind,
  notes: '',
  links,
});

function build(
  assignments: Partial<Record<MasterKey, RawAssignment[]>>,
  extra: Partial<BuildInput> = {},
) {
  return buildCategories({
    monsters: [
      monster('Abyssal demon', ['abyssal demons']),
      monster('Abyssal Sire', ['abyssal demons', 'bosses']),
      monster('Abyssal demon (Deadman)', ['abyssal demons']),
      monster('Kalphite Queen', ['bosses', 'kalphite']),
      monster('Callisto', ['bears', 'bosses']),
      monster('Chaos Temple', ['nothing']),
    ],
    assignments: new Map(Object.entries(assignments) as [MasterKey, RawAssignment[]][]),
    taskPages: [],
    unlocks: [],
    equipment: [],
    ...extra,
  });
}

describe('resolveCategory', () => {
  const categories = new Set([
    'kalphite',
    'bosses',
    'dark beasts',
    'cave slimes',
    'mutated zygomites',
  ]);

  it.each([
    ['Kalphites', 'kalphite'],
    ['Boss', 'bosses'],
    ['Bosses', 'bosses'],
    ['Slayer task/Dark beast', 'dark beasts'],
    ['Cave slime', 'cave slimes'],
    ['Slayer task/Zygomites', 'mutated zygomites'],
    ['Wilderness bosses / demi-bosses', 'wilderness bosses'],
    ['Cows', null],
  ])('%s', (name, expected) => {
    expect(resolveCategory(name, categories)).toBe(expected);
  });
});

describe('buildCategories', () => {
  it("gives each master's rows their category, weights and total", () => {
    const { masters, warnings } = build({
      vannaka: [row('Abyssal Demons', { weight: 5 }), row('Kalphites', { weight: 7 })],
    });
    const vannaka = masters.find((m) => m.key === 'vannaka')!;
    expect(vannaka).toMatchObject({ name: 'Vannaka', page: 'Vannaka', totalWeight: 12 });
    expect(vannaka.assignments.map((a) => [a.category, a.weight])).toEqual([
      ['abyssal demons', 5],
      ['kalphite', 7],
    ]);
    expect(warnings.filter((w) => w.includes('Vannaka'))).toEqual([]);
  });

  it('lists a category by its monsters, leaving out other game modes', () => {
    const { categories } = build({
      duradel: [row('Abyssal demons')],
      nieve: [row('Abyssal demons')],
    });
    expect(categories.find((c) => c.category === 'abyssal demons')).toMatchObject({
      monsters: ['abyssal-demon', 'abyssal-sire'],
      masters: ['nieve', 'duradel'],
    });
  });

  it("builds a category no monster page has from the master's listed monsters", () => {
    const { categories } = build(
      {
        krystilia: [
          row('Wilderness bosses / demi-bosses', {
            alternatives: ['Callisto', 'Artio'],
            requirements:
              'Only assigned to players who have unlocked Like a boss via spending 200 points.',
          }),
        ],
      },
      { unlocks: [unlock('Like a Boss', 'unlock')] },
    );
    expect(categories.find((c) => c.category === 'wilderness bosses')).toMatchObject({
      monsters: ['callisto'],
      masters: ['krystilia'],
      unlocks: ['Like a Boss'],
    });
  });

  it('links unlocks, extends, guide pages and equipment', () => {
    const { categories, masters, warnings } = build(
      {
        konar: [
          row('Abyssal demons', {
            requirements: '85 Slayer, unlocked the Made up ability via spending 1 point',
            locations: ['Catacombs of Kourend', 'Chaos Temple'],
          }),
        ],
      },
      {
        taskPages: ['Slayer task/Abyssal demons', 'Slayer task/Dragons'],
        unlocks: [unlock('Augment my Abbies', 'extend', ['Abyssal demon'])],
        equipment: [
          { item: 'Nose peg', use: 'Protecting against Abyssal demons', links: ['Abyssal demon'] },
        ],
      },
    );
    expect(categories.find((c) => c.category === 'abyssal demons')).toMatchObject({
      page: 'Slayer task/Abyssal demons',
      extend: 'Augment my Abbies',
      unlocks: ['Made up'],
      equipment: [{ item: 'Nose peg', monsters: ['abyssal-demon'] }],
    });
    // A location cell that links a monster page keeps only the locations.
    expect(masters.find((m) => m.key === 'konar')!.assignments[0].locations).toEqual([
      'Catacombs of Kourend',
    ]);
    expect(warnings).toContain('Konar quo Maten: unknown unlock "Made up" for abyssal demons');
    // Overview pages aren't warned about.
    expect(warnings.some((w) => w.includes('Dragons'))).toBe(false);
  });

  it("keeps a master's exclusions, and checks extends against the tables", () => {
    const { masters, warnings } = build(
      {
        krystilia: [
          row('Abyssal demons', {
            excludes: ['Abyssal Sire', 'Not a monster'],
            extended: [200, 250],
          }),
        ],
        nieve: [row('Abyssal demons', { extended: [200, 260] })],
      },
      {
        unlocks: [
          {
            ...unlock('Augment my Abbies', 'extend', ['Abyssal demon']),
            notes: 'Number of abyssal demons assigned is increased to 200-250.',
          },
        ],
      },
    );
    expect(masters.find((m) => m.key === 'krystilia')!.assignments[0].excludes).toEqual([
      'abyssal-sire',
    ]);
    expect(warnings).toContain(
      'Augment my Abbies extends abyssal demons to 200-250; tables that differ: Nieve',
    );
  });

  it('applies equipment to linked monsters, or to the category a link names', () => {
    const { categories, warnings } = build(
      { vannaka: [row('Kalphites')] },
      {
        equipment: [
          // "Kalphite" is no monster page here, but names the category.
          { item: 'Spray', use: 'Finishing off Kalphites', links: ['Kalphite'] },
          { item: 'Boots', use: 'Protecting from the floor of the Dungeon', links: ['Dungeon'] },
          { item: 'Gloves', use: 'Protecting against Nobody', links: ['Nobody'] },
        ],
      },
    );
    expect(categories.find((c) => c.category === 'kalphite')!.equipment).toEqual([
      { item: 'Spray', use: 'Finishing off Kalphites', monsters: ['kalphite-queen'] },
    ]);
    // Places are expected to match no monster; anything else is reported.
    expect(warnings).toContain('Gloves: no monster for "Protecting against Nobody"');
    expect(warnings.some((w) => w.startsWith('Boots'))).toBe(false);
  });

  it('applies equipment for a linked monster to its kind and their superiors', () => {
    const monsters = [
      monster('Aberrant spectre', ['aberrant spectres']),
      monster('Deviant spectre', ['aberrant spectres']),
      monster('Abhorrent spectre', ['aberrant spectres']),
      monster('Repugnant spectre', ['aberrant spectres']),
      monster('Gargoyle', ['gargoyles']),
      monster('Marble gargoyle', ['gargoyles']),
      monster('Dusk', ['gargoyles', 'bosses']),
    ];
    linkSuperiors(
      monsters,
      new Map([
        ['Aberrant spectre', 'Abhorrent spectre'],
        ['Deviant spectre', 'Repugnant spectre'],
        ['Gargoyle', 'Marble gargoyle'],
      ]),
    );
    const { categories } = build(
      { vannaka: [row('Aberrant spectres'), row('Gargoyles')] },
      {
        monsters,
        equipment: [
          {
            item: 'Nose peg',
            use: 'Protecting against Aberrant spectres',
            links: ['Aberrant spectre'],
          },
          { item: 'Rock hammer', use: 'Finishing off Gargoyles', links: ['Gargoyle'] },
        ],
      },
    );
    const uses = (category: string) =>
      categories.find((c) => c.category === category)!.equipment.map((e) => e.monsters);
    // Deviant spectres too, and both superiors.
    expect(uses('aberrant spectres')).toEqual([
      ['aberrant-spectre', 'abhorrent-spectre', 'deviant-spectre', 'repugnant-spectre'],
    ]);
    // Not Dusk: "gargoyle" isn't in its name.
    expect(uses('gargoyles')).toEqual([['gargoyle', 'marble-gargoyle']]);
  });

  it("leaves out a monster of the kind that doesn't need the item", () => {
    const { categories } = build(
      { vannaka: [row('Lizards')] },
      {
        monsters: [
          monster('Desert Lizard', ['lizards']),
          monster('Small Lizard', ['lizards']),
          monster('Sulphur Lizard', ['lizards']),
        ],
        equipment: [{ item: 'Ice cooler', use: 'Finishing off Lizards', links: ['Desert Lizard'] }],
      },
    );
    expect(categories.find((c) => c.category === 'lizards')!.equipment[0].monsters).toEqual([
      'desert-lizard',
      'small-lizard',
    ]);
  });

  it('keeps other names as aliases, and the lowest Slayer level any master needs', () => {
    const { categories } = build(
      {
        vannaka: [
          row('Kalphites', { slayerLevel: 20 }),
          row('Abyssal demons', { slayerLevel: 85 }),
        ],
        duradel: [row('Kalphite', { slayerLevel: 10 }), row('Abyssal Demons', { slayerLevel: 85 })],
        turael: [row('Kalphite')],
      },
      { taskPages: ['Slayer task/Abyssal demons'] },
    );
    const find = (name: string) => categories.find((c) => c.category === name);
    expect(find('kalphite')).toMatchObject({ aliases: ['kalphites'], slayerLevel: null });
    expect(find('abyssal demons')).toMatchObject({ aliases: [], slayerLevel: 85 });
    // Unassigned: no level.
    expect(find('bears')).toMatchObject({ slayerLevel: null });
  });

  it('warns about rows and categories it cannot match', () => {
    const { categories, warnings } = build({ turael: [row('Cows')] });
    expect(warnings).toContain('Turael: no category for "Cows"');
    expect(warnings).toContain('No master assigns the category "nothing"');
    // Still listed, so the app can show every category from this file.
    expect(categories.find((c) => c.category === 'nothing')).toMatchObject({
      monsters: ['chaos-temple'],
      masters: [],
    });
  });
});

describe('linkSuperiors', () => {
  it('links both ways, matching titles loosely, and shares categories', () => {
    const monsters = [
      monster('Rockslug', ['rockslugs']),
      // The wiki gives this one no category; it gets its base's.
      monster('Giant rockslug', []),
      monster('Cockatrice', ['cockatrice']),
      monster('Moonlight Cockatrice', ['cockatrice']),
      monster('Cockathrice', ['cockatrice']),
    ];
    const warnings = linkSuperiors(
      monsters,
      new Map([
        ['Rock slug', 'Giant rockslug'],
        ['Cockatrice', 'Cockathrice'],
        ['Moonlight Cockatrice', 'Cockathrice'],
        ['Nope', 'Cockathrice'],
      ]),
    );
    expect(monsters.map((m) => [m.slug, m.superior, m.superiorOf])).toEqual([
      ['rockslug', 'giant-rockslug', []],
      ['giant-rockslug', null, ['rockslug']],
      ['cockatrice', 'cockathrice', []],
      ['moonlight-cockatrice', 'cockathrice', []],
      ['cockathrice', null, ['cockatrice', 'moonlight-cockatrice']],
    ]);
    expect(warnings).toEqual(['Superior Cockathrice of Nope: not a Slayer monster page']);
    expect(monsters[1].categories).toEqual(['rockslugs']);
  });
});
