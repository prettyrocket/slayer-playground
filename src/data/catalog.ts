import { useQuery } from '@tanstack/react-query';

import { fetchJson } from '@/api';
import { MASTER_KEYS, type MasterKey, type Monster, type MonstersFile } from '@/data/types';

/** A Slayer category, e.g. "Abyssal demons": the monsters that count for a task of it. */
export interface Category {
  slug: string;
  name: string;
  monsters: Monster[];
  /**
   * Masters who assign it, in MASTER_KEYS order. Guessed from the monsters' assignedBy
   * for now (see categoryMasters); the masters' own tables (#7) should replace it.
   */
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

/**
 * A monster's assignedBy covers every category it's in, so a monster in several
 * categories (e.g. Callisto: bears and bosses) would leak masters between them.
 * Trust only the category's single-category monsters, unless it has none with a master.
 */
function categoryMasters(members: Monster[]): MasterKey[] {
  const assignedBy = (monsters: Monster[]) =>
    MASTER_KEYS.filter((key) => monsters.some((m) => m.assignedBy.includes(key)));
  const masters = assignedBy(members.filter((m) => m.categories.length === 1));
  return masters.length > 0 ? masters : assignedBy(members);
}

function buildCatalog({ monsters }: MonstersFile): Catalog {
  const byName = new Map<string, Monster[]>();
  for (const monster of monsters) {
    for (const name of monster.categories) byName.set(name, [...(byName.get(name) ?? []), monster]);
  }

  const categories = [...byName]
    .map(([name, members]) => ({
      slug: categorySlug(name),
      name: name.charAt(0).toUpperCase() + name.slice(1),
      monsters: members.toSorted((a, b) => a.page.localeCompare(b.page)),
      masters: categoryMasters(members),
    }))
    .toSorted((a, b) => a.name.localeCompare(b.name));

  return { categories, monsters };
}

/**
 * Loads public/data/monsters.json and indexes it for navigation. A first slice
 * of the data layer (#10): the whole file is 2.4 MB, so #10 should give the nav
 * a slim index of its own.
 */
export function useCatalog() {
  return useQuery({
    queryKey: ['monsters'],
    queryFn: () => fetchJson<MonstersFile>('data/monsters.json'),
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
