import { describe, expect, it } from 'vitest';

import type { MasterKey, Monster } from '../../src/data/types.ts';
import { type BuildInput, buildTasks, resolveCategory } from './build-tasks.ts';
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
  superior: null,
  superiorOf: [],
  versions: [],
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
  return buildTasks({
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

describe('buildTasks', () => {
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

  it('lists a category task by its monsters, leaving out other game modes', () => {
    const { tasks } = build({ duradel: [row('Abyssal demons')], nieve: [row('Abyssal demons')] });
    expect(tasks.find((t) => t.category === 'abyssal demons')).toMatchObject({
      monsters: ['abyssal-demon', 'abyssal-sire'],
      masters: ['nieve', 'duradel'],
    });
  });

  it("builds a task that isn't a category from the master's listed monsters", () => {
    const { tasks } = build(
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
    expect(tasks.find((t) => t.category === 'wilderness bosses')).toMatchObject({
      monsters: ['callisto'],
      masters: ['krystilia'],
      unlocks: ['Like a Boss'],
    });
  });

  it('links unlocks, extends, guide pages and equipment', () => {
    const { tasks, masters, warnings } = build(
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
    expect(tasks[0]).toMatchObject({
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

  it('warns about rows and categories it cannot match', () => {
    const { warnings } = build({ turael: [row('Cows')] });
    expect(warnings).toContain('Turael: no category for "Cows"');
    expect(warnings).toContain('No master assigns the category "nothing"');
  });
});

describe('linkSuperiors', () => {
  it('links both ways, matching titles loosely', () => {
    const monsters = [
      monster('Rockslug', ['rockslugs']),
      monster('Giant rockslug', ['rockslugs']),
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
  });
});
