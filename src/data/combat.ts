import type { Category } from '@/data/catalog';
import type { Monster, MonsterVersion } from '@/data/types';

// Attack styles folded into what you'd pray against; anything else (Dragonfire) as written.
const PRAYER: Record<string, string> = {
  stab: 'Melee',
  slash: 'Melee',
  crush: 'Melee',
  melee: 'Melee',
  magic: 'Magic',
  ranged: 'Ranged',
};

/** "Stab", "Slash", "Magic" -> "Melee, Magic": the protection prayers that matter. */
export function protectFrom(version: MonsterVersion | undefined): string | null {
  const styles = (version?.attackStyles ?? []).map((s) => PRAYER[s.toLowerCase()] ?? s);
  return [...new Set(styles)].join(', ') || null;
}

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
