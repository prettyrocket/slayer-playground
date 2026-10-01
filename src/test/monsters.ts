import type {
  Assignment,
  CategoriesFile,
  Drop,
  DropsFile,
  MasterKey,
  MastersFile,
  Monster,
  MonsterVersion,
  MonstersFile,
  SlayerCategory,
} from '@/data/types';

/** A version with a combat level; every other stat empty. */
const version = (combatLevel: number, more: Partial<MonsterVersion> = {}): MonsterVersion => ({
  version: null,
  isDefault: false,
  name: '',
  image: null,
  npcIds: [],
  examine: null,
  combatLevel,
  hitpoints: null,
  maxHit: [],
  attackStyles: [],
  attackSpeed: null,
  size: null,
  attributes: [],
  slayerLevel: null,
  slayerXp: null,
  levels: { attack: null, strength: null, defence: null, ranged: null, magic: null },
  offence: {
    attack: null,
    strength: null,
    magic: null,
    magicDamage: null,
    ranged: null,
    rangedStrength: null,
  },
  defence: {
    stab: null,
    slash: null,
    crush: null,
    magic: null,
    ranged: null,
    lightRanged: null,
    standardRanged: null,
    heavyRanged: null,
  },
  weakness: null,
  immunities: { poison: null, venom: null, cannon: null, thrall: null, burn: null, freeze: null },
  ...more,
});

/** A monster with just what navigation reads; everything else empty. */
function monster(
  slug: string,
  page: string,
  categories: string[],
  assignedBy: MasterKey[],
  more: Partial<Monster> = {},
): Monster {
  return {
    slug,
    page,
    slayerLevel: null,
    categories,
    assignedBy,
    taskOnly: false,
    members: true,
    hasDrops: false,
    icon: null,
    superior: null,
    superiorOf: [],
    versions: [],
    locations: [],
    ...more,
  };
}

/**
 * Served for data/monsters.json in tests (see setup.ts). The Sire is in two
 * categories, and its assignedBy lists Vannaka, who assigns only one of them.
 * The abyssal demon has a superior; the Sire's versions span two combat levels.
 */
export const monstersFixture: MonstersFile = {
  monsters: [
    monster('abyssal-demon', 'Abyssal demon', ['abyssal demons'], ['vannaka', 'duradel'], {
      slayerLevel: 85,
      icon: 'icons/monsters/abyssal-demon.png',
      superior: 'greater-abyssal-demon',
      locations: [
        {
          name: 'Catacombs of Kourend',
          page: 'Catacombs of Kourend',
          levels: [124],
          spawns: 13,
          multicombat: true,
          cannon: false,
          safespot: false,
        },
        {
          name: 'Abyssal Area',
          page: null,
          levels: [],
          spawns: null,
          multicombat: null,
          cannon: null,
          safespot: null,
        },
      ],
      hasDrops: true,
      versions: [
        version(124, {
          version: 'Standard',
          isDefault: true,
          hitpoints: 150,
          maxHit: ['8'],
          attackStyles: ['Stab'],
          attackSpeed: 4,
          size: 1,
          slayerXp: 150,
          weakness: { element: 'Fire', percent: 20 },
          levels: { attack: 97, strength: 67, defence: 135, ranged: 1, magic: 1 },
          defence: {
            stab: 20,
            slash: 20,
            crush: 20,
            magic: 0,
            ranged: null,
            lightRanged: 20,
            standardRanged: 20,
            heavyRanged: 20,
          },
          immunities: {
            poison: '0',
            venom: '0',
            cannon: false,
            thrall: true,
            burn: null,
            freeze: 33,
          },
        }),
        version(124, { version: 'Catacombs of Kourend', hitpoints: 150 }),
      ],
    }),
    monster('greater-abyssal-demon', 'Greater abyssal demon', ['abyssal demons'], [], {
      superiorOf: ['abyssal-demon'],
      versions: [version(342)],
    }),
    monster('abyssal-sire', 'Abyssal Sire', ['abyssal demons', 'bosses'], ['vannaka', 'duradel'], {
      slayerLevel: 85,
      versions: [
        version(350, {
          hitpoints: 425,
          slayerXp: 478,
          maxHit: ['40'],
          attackStyles: ['Magic', 'Crush', 'Slash'],
          levels: { attack: 180, strength: 136, defence: 250, ranged: 1, magic: 200 },
        }),
        version(116),
      ],
    }),
    monster('dust-devil', 'Dust devil', ['dust devils'], ['duradel']),
    monster('cow', 'Cow', ['cows'], ['turael']),
    // The sync empties the categories of monsters that can't be picked for a task.
    monster('abyssal-sire-deadman', 'Abyssal Sire (Deadman)', [], ['duradel']),
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
    category(
      'abyssal demons',
      ['abyssal-demon', 'abyssal-sire', 'greater-abyssal-demon'],
      ['vannaka', 'konar', 'duradel'],
      {
        slayerLevel: 85,
        icon: 'icons/abyssal-demons.png',
        page: 'Slayer task/Abyssal demons',
      },
    ),
    category('bosses', ['abyssal-sire'], ['duradel']),
    category('cows', ['cow'], ['turael']),
    category('dust devils', ['dust-devil'], ['duradel'], {
      aliases: ['dusties'],
      slayerLevel: 65,
      equipment: [
        { item: 'Facemask', use: 'Protecting against Dust devils', monsters: ['dust-devil'] },
      ],
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

const drop = (item: string, dropVersion: string, more: Partial<Drop> = {}): Drop => ({
  item,
  dropVersion,
  quantity: [1, 1],
  noted: false,
  rarity: '1/128',
  chance: 1 / 128,
  approx: false,
  rolls: 1,
  altRarity: null,
  value: null,
  type: 'combat',
  ...more,
});

/** Served for data/drops/abyssal-demon.json: a table per version. */
export const abyssalDemonDrops: DropsFile = {
  page: 'Abyssal demon',
  drops: [
    drop('Ancient shard', 'Catacombs of Kourend', { rarity: '1/233' }),
    drop('Pure essence', 'Standard', { quantity: [120, 180], noted: true, rarity: '1/10' }),
    drop('Coins', 'Standard', { quantity: null, rarity: 'Always' }),
    drop('Abyssal whip', 'Standard', { rarity: '1/512' }),
  ],
};
