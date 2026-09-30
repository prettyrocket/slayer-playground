import type {
  CategoriesFile,
  MasterKey,
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
    {
      ...monster('abyssal-demon', 'Abyssal demon', ['abyssal demons'], ['vannaka', 'duradel']),
      superior: 'greater-abyssal-demon',
    },
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
    category('bosses', ['abyssal-sire'], ['duradel'], { unlocks: ['Like a Boss'] }),
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
