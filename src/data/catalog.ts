import { useQuery } from '@tanstack/react-query';

import { fetchJson } from '@/api';
import {
  MASTER_KEYS,
  type MasterKey,
  type MastersFile,
  type Monster,
  type MonstersFile,
} from '@/data/types';

/** A Slayer category, e.g. "Abyssal demons": the monsters that count for a task of it. */
export interface Category {
  slug: string;
  name: string;
  monsters: Monster[];
  /** Masters with it in their assignment table, in MASTER_KEYS order. */
  masters: MasterKey[];
}

/** What navigation needs: every category and monster, by name. */
export interface Catalog {
  categories: Category[];
  monsters: Monster[];
}

/** A category's URL slug from its wiki name, e.g. abyssal demons -> abyssal-demons. */
export function categorySlug(name: string): string {
  return name.replaceAll(' ', '-');
}

function buildCatalog([{ monsters }, { masters }]: [MonstersFile, MastersFile]): Catalog {
  const byName = new Map<string, Monster[]>();
  for (const monster of monsters) {
    for (const name of monster.categories) byName.set(name, [...(byName.get(name) ?? []), monster]);
  }
  // From the masters' own tables: a monster's assignedBy covers every category
  // it's in, so it can't say who assigns one category.
  const assigns = (key: MasterKey, category: string) =>
    masters.some((m) => m.key === key && m.assignments.some((a) => a.category === category));

  const categories = [...byName]
    .map(([name, members]) => ({
      slug: categorySlug(name),
      name: name.charAt(0).toUpperCase() + name.slice(1),
      monsters: members.toSorted((a, b) => a.page.localeCompare(b.page)),
      masters: MASTER_KEYS.filter((key) => assigns(key, name)),
    }))
    .toSorted((a, b) => a.name.localeCompare(b.name));

  return { categories, monsters };
}

/**
 * Loads public/data/monsters.json and masters.json and indexes them for
 * navigation. A first slice of the data layer (#10): monsters.json is 2.4 MB,
 * so #10 should give the nav a slim index of its own.
 */
export function useCatalog() {
  return useQuery({
    queryKey: ['catalog'],
    queryFn: () =>
      Promise.all([
        fetchJson<MonstersFile>('data/monsters.json'),
        fetchJson<MastersFile>('data/masters.json'),
      ]),
    select: buildCatalog,
    staleTime: Infinity, // a snapshot that only changes with a deploy
  });
}

export function findCategory(catalog: Catalog | undefined, slug: string | null | undefined) {
  return catalog?.categories.find((category) => category.slug === slug);
}

export function findMonster(catalog: Catalog | undefined, slug: string | null | undefined) {
  return catalog?.monsters.find((monster) => monster.slug === slug);
}
