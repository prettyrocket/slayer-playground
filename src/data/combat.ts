import type { Category } from '@/data/catalog';
import type { Monster } from '@/data/types';

/** Slayer equipment the categories' lists tie to this monster, e.g. ["Earmuffs"]. */
export function neededItems(categories: Category[], monster: Monster): string[] {
  return [
    ...new Set(
      categories.flatMap((c) =>
        c.equipment.filter((e) => e.monsters.includes(monster.slug)).map((e) => e.item),
      ),
    ),
  ];
}
