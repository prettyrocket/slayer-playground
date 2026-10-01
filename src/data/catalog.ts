import { useQuery } from '@tanstack/react-query';

import { fetchJson } from '@/api';
import type {
  CategoriesFile,
  CategoryEquipment,
  MasterKey,
  Monster,
  MonstersFile,
} from '@/data/types';

/** A Slayer category, e.g. "Abyssal demons": the monsters that count for a task of it. */
export interface Category {
  slug: string;
  name: string;
  monsters: Monster[];
  /** Masters with it in their assignment table, in MASTER_KEYS order. */
  masters: MasterKey[];
  /** Other names for it, lowercased, e.g. ["kalphites"]. */
  aliases: string[];
  /** The lowest Slayer level any master needs to assign it; null for none. */
  slayerLevel: number | null;
  /** Picture path under public/data, e.g. "icons/cows.png"; null for none. */
  icon: string | null;
  /** Slayer equipment its monsters need, e.g. earmuffs for banshees. */
  equipment: CategoryEquipment[];
  /** The wiki's guide page, e.g. "Slayer task/Abyssal demons"; null when there is none. */
  page: string | null;
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

function buildCatalog([{ monsters }, { categories }]: [MonstersFile, CategoriesFile]): Catalog {
  const bySlug = new Map(monsters.map((m) => [m.slug, m]));
  return {
    // From categories.json: which monsters count (no Deadman or minigame copies),
    // which masters assign it, and categories no monster page has, like
    // Krystilia's wilderness bosses.
    categories: categories
      .map(
        ({ category, monsters: slugs, masters, aliases, slayerLevel, icon, equipment, page }) => ({
          slug: categorySlug(category),
          name: category.charAt(0).toUpperCase() + category.slice(1),
          monsters: slugs
            .map((slug) => bySlug.get(slug))
            .filter((m): m is Monster => m !== undefined)
            .toSorted((a, b) => a.page.localeCompare(b.page)),
          masters,
          aliases,
          slayerLevel,
          icon,
          equipment,
          page,
        }),
      )
      .toSorted((a, b) => a.name.localeCompare(b.name)),
    monsters,
  };
}

/**
 * Loads public/data/monsters.json and categories.json and indexes them for
 * navigation. A first slice of the data layer (#10): monsters.json is 2.4 MB,
 * so #10 should give the nav a slim index of its own.
 */
export function useCatalog() {
  return useQuery({
    queryKey: ['catalog'],
    queryFn: () =>
      Promise.all([
        fetchJson<MonstersFile>('data/monsters.json'),
        fetchJson<CategoriesFile>('data/categories.json'),
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
