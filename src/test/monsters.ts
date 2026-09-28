import type {
  Assignment,
  MasterKey,
  MastersFile,
  Monster,
  MonstersFile,
  SlayerMaster,
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
  ],
};

/** A master whose table lists `categories`, with every other field empty. */
function master(key: MasterKey, categories: string[]): SlayerMaster {
  const assignment = (category: string): Assignment => ({
    category,
    weight: 1,
    amount: [10, 20],
    extended: null,
    slayerLevel: null,
    combatLevel: null,
    requirements: null,
    unlocks: [],
    locations: [],
  });
  return {
    key,
    name: key,
    page: key,
    alternates: [],
    totalWeight: categories.length,
    assignments: categories.map(assignment),
  };
}

/**
 * Served for data/masters.json in tests. Duradel assigns three categories,
 * Vannaka only abyssal demons, and Mortimer nothing here.
 */
export const mastersFixture: MastersFile = {
  masters: [
    master('turael', ['cows']),
    master('vannaka', ['abyssal demons']),
    master('duradel', ['abyssal demons', 'bosses', 'dust devils']),
  ],
};
