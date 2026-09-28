import type { MasterKey, Monster, MonstersFile } from '@/data/types';

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
    versions: [],
  } satisfies Monster;
}

/**
 * Served for data/monsters.json in tests (see setup.ts). The Sire is in two
 * categories, Mortimer assigns nothing, and Vannaka assigns only some.
 */
export const monstersFixture: MonstersFile = {
  monsters: [
    monster('abyssal-demon', 'Abyssal demon', ['abyssal demons'], ['vannaka', 'duradel']),
    monster('abyssal-sire', 'Abyssal Sire', ['abyssal demons', 'bosses'], ['vannaka', 'duradel']),
    monster('dust-devil', 'Dust devil', ['dust devils'], ['duradel']),
    monster('cow', 'Cow', ['cows'], ['turael']),
  ],
};
