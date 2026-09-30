import type {
  Assignment,
  CategoriesFile,
  MasterKey,
  MastersFile,
  Monster,
  MonstersFile,
  SlayerCategory,
} from '@/data/types';

/** A monster with just what navigation reads; everything else empty. */
function monster(slug: string, page: string, categories: string[], assignedBy: MasterKey[]) {
  return {
    slug,
    page,
    slayerLevel: null,
    categories,
    assignedBy,
    taskOnly: false,
    members: true,
    hasDrops: false,
    superior: null,
    superiorOf: [],
    versions: [],
  } satisfies Monster;
}

/**
 * Served for data/monsters.json in tests (see setup.ts). The Sire is in two
 * categories, and its assignedBy lists Vannaka, who assigns only one of them.
 */
export const monstersFixture: MonstersFile = {
  monsters: [
    monster('abyssal-demon', 'Abyssal demon', ['abyssal demons'], ['vannaka', 'duradel']),
    monster('abyssal-sire', 'Abyssal Sire', ['abyssal demons', 'bosses'], ['vannaka', 'duradel']),
    monster('dust-devil', 'Dust devil', ['dust devils'], ['duradel']),
    monster('cow', 'Cow', ['cows'], ['turael']),
    monster('abyssal-sire-deadman', 'Abyssal Sire (Deadman)', ['bosses'], ['duradel']),
  ],
};

/** A categories.json entry with just what navigation reads. */
function category(
  name: string,
  monsters: string[],
  masters: MasterKey[],
  more: Partial<SlayerCategory> = {},
): SlayerCategory {
  return {
    category: name,
    aliases: [],
    slayerLevel: null,
    icon: null,
    page: null,
    monsters,
    masters,
    unlocks: [],
    extend: null,
    equipment: [],
    ...more,
  };
}

/**
 * Served for data/categories.json in tests. Duradel assigns three categories,
 * Vannaka only abyssal demons (though the Sire's assignedBy lists him), Mortimer
 * nothing here. The Deadman Sire counts for nothing, and Krystilia's wilderness
 * bosses are a category no monster page has.
 */
export const categoriesFixture: CategoriesFile = {
  categories: [
    category('abyssal demons', ['abyssal-demon', 'abyssal-sire'], ['vannaka', 'duradel'], {
      slayerLevel: 85,
      icon: 'icons/abyssal-demons.png',
    }),
    category('bosses', ['abyssal-sire'], ['duradel']),
    category('cows', ['cow'], ['turael']),
    category('dust devils', ['dust-devil'], ['duradel'], {
      aliases: ['dusties'],
      slayerLevel: 65,
    }),
    category('wilderness bosses', [], ['krystilia']),
  ],
};

/** A row of a master's table; everything the tests don't set is empty. */
function assignment(category: string, weight: number, more: Partial<Assignment> = {}): Assignment {
  return {
    category,
    weight,
    amount: [120, 170],
    extended: null,
    slayerLevel: null,
    combatLevel: null,
    requirements: null,
    unlocks: [],
    excludes: [],
    locations: [],
    ...more,
  };
}

/**
 * Served for data/masters.json in tests. Duradel's weights make round chances
 * (12 / 30 = 40%); Konar has locations; Mortimer offers choices, not chances.
 */
export const mastersFixture: MastersFile = {
  masters: [
    {
      key: 'vannaka',
      name: 'Vannaka',
      page: 'Vannaka',
      alternates: [],
      totalWeight: 5,
      assignments: [assignment('abyssal demons', 5, { amount: [40, 90] })],
    },
    {
      key: 'duradel',
      name: 'Duradel',
      page: 'Duradel/Slayer assignments',
      alternates: ['Kuradal'],
      totalWeight: 30,
      assignments: [
        assignment('abyssal demons', 12, { amount: [130, 200], extended: [200, 250] }),
        assignment('bosses', 12, { amount: [3, 35] }),
        assignment('dust devils', 6, { amount: [50, 50] }),
      ],
    },
    {
      key: 'konar',
      name: 'Konar quo Maten',
      page: 'Konar quo Maten',
      alternates: [],
      totalWeight: 9,
      assignments: [
        assignment('abyssal demons', 9, {
          locations: ['Catacombs of Kourend', 'Troll Stronghold (location)'],
        }),
      ],
    },
    {
      key: 'krystilia',
      name: 'Krystilia',
      page: 'Krystilia',
      alternates: [],
      totalWeight: 8,
      assignments: [assignment('wilderness bosses', 8, { amount: [3, 35] })],
    },
    {
      key: 'mortimer',
      name: 'Mortimer',
      page: 'Mortimer',
      alternates: [],
      totalWeight: 10,
      assignments: [assignment('abyssal demons', 10)],
    },
  ],
};
