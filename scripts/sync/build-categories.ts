import {
  type Assignment,
  MASTER_KEYS,
  type MasterKey,
  type Monster,
  type SlayerCategory,
  type SlayerMaster,
  type Unlock,
} from '../../src/data/types.ts';
import { MASTER_PAGES, type RawAssignment } from './masters.ts';
import { pageKey } from './normalize.ts';
import { type RawEquipment, type RawUnlock, requiredUnlocks } from './parsers.ts';

/** Names (master rows, guide pages) that don't match a category as written, mapped to one. */
const NAME_ALIASES: Record<string, string> = {
  // Krystilia: a list of bosses rather than a category; its monsters come from her table.
  'wilderness bosses / demi-bosses': 'wilderness bosses',
  zygomites: 'mutated zygomites',
};

/** Guide pages that cover several categories rather than one. */
const OVERVIEW_PAGES = new Set(['Slayer task/Dragons', 'Slayer task/Giants']);

/**
 * Copies of monsters that can't be killed on a task: other game modes and
 * minigames, and pages the wiki marks unused. Quest and location copies can be,
 * so they stay.
 */
const NOT_ON_TASK = /\((deadman|pvm arena|nightmare zone|echo|unused)\)$/i;

/**
 * The category a name refers to: "Kalphites" -> "kalphite", "Boss" -> "bosses",
 * "Slayer task/Dark beast" -> "dark beasts". Masters and pages spell names with
 * other cases and plurals than the monsters' categories. Null when nothing matches.
 */
export function resolveCategory(name: string, categories: Set<string>): string | null {
  const base = name
    .replace(/^slayer task\//i, '')
    .trim()
    .toLowerCase();
  const alias = NAME_ALIASES[base];
  if (alias) return alias;
  const candidates = [
    base,
    `${base}s`,
    `${base}es`,
    base.replace(/e?s$/, ''),
    base.replace(/s$/, ''),
  ];
  return candidates.find((c) => categories.has(c)) ?? null;
}

export interface BuildInput {
  monsters: Monster[];
  assignments: Map<MasterKey, RawAssignment[]>;
  /** Titles of the wiki's Slayer task/ pages. */
  taskPages: string[];
  unlocks: RawUnlock[];
  equipment: RawEquipment[];
}

export interface BuildResult {
  masters: SlayerMaster[];
  categories: SlayerCategory[];
  unlocks: Unlock[];
  /** Things that didn't match, for the sync log. */
  warnings: string[];
}

export function buildCategories(input: BuildInput): BuildResult {
  const warnings: string[] = [];
  // Categories as the monster pages give them.
  const known = new Set(input.monsters.flatMap((m) => m.categories));
  const slugByPage = new Map(input.monsters.map((m) => [pageKey(m.page), m.slug]));
  const onTask = input.monsters.filter((m) => !NOT_ON_TASK.test(m.page));

  const masters: SlayerMaster[] = [];
  // Category -> monster pages a master lists for it, for ones no monster page has.
  const listed = new Map<string, string[]>();
  for (const { key, name, page, alternates } of MASTER_PAGES) {
    const rows = input.assignments.get(key) ?? [];
    const assignments: Assignment[] = [];
    for (const row of rows) {
      const category =
        resolveCategory(row.name, known) ?? (row.link ? resolveCategory(row.link, known) : null);
      if (!category) {
        warnings.push(`${name}: no category for "${row.name}"`);
        continue;
      }
      if (!known.has(category)) {
        listed.set(category, [...(listed.get(category) ?? []), ...row.alternatives]);
      }
      const unlocks = row.requirements ? requiredUnlocks(row.requirements, input.unlocks) : [];
      for (const unlock of unlocks) {
        if (!input.unlocks.some((u) => u.name === unlock)) {
          warnings.push(`${name}: unknown unlock "${unlock}" for ${category}`);
        }
      }
      assignments.push({
        category,
        weight: row.weight,
        amount: row.amount,
        extended: row.extended,
        slayerLevel: row.slayerLevel,
        combatLevel: row.combatLevel,
        requirements: row.requirements,
        unlocks,
        excludes: row.excludes
          .map((page) => slugByPage.get(pageKey(page)))
          .filter((slug): slug is string => slug !== undefined)
          .sort(),
        // Some location cells link a monster too.
        locations: row.locations.filter((l) => !slugByPage.has(pageKey(l))),
      });
    }
    assignments.sort((a, b) => byCodeUnit(a.category, b.category));
    masters.push({
      key,
      name,
      page,
      alternates,
      totalWeight: assignments.reduce((sum, a) => sum + a.weight, 0),
      assignments,
    });
  }

  const pageByCategory = new Map<string, string>();
  for (const page of input.taskPages) {
    if (OVERVIEW_PAGES.has(page)) continue;
    const category = resolveCategory(page, known);
    if (category) pageByCategory.set(category, page);
    else warnings.push(`No category for ${page}`);
  }

  const extendByCategory = new Map<string, string>();
  for (const unlock of input.unlocks.filter((u) => u.kind === 'extend')) {
    const category = unlock.links
      .map((link) => resolveCategory(link, known))
      .find((c) => c !== null);
    if (!category) {
      warnings.push(`No category for the extend "${unlock.name}"`);
      continue;
    }
    extendByCategory.set(category, unlock.name);
    // The note gives the extended amount too; say when a master's table disagrees.
    const note = unlock.notes.replace(/,/g, '').match(/increased to (\d+)-(\d+)/);
    const disagree = masters.filter((m) =>
      m.assignments.some(
        (a) =>
          a.category === category &&
          note &&
          a.extended &&
          (a.extended[0] !== Number(note[1]) || a.extended[1] !== Number(note[2])),
      ),
    );
    if (note && disagree.length > 0) {
      warnings.push(
        `${unlock.name} extends ${category} to ${note[1]}-${note[2]}; tables that differ: ` +
          disagree.map((m) => m.name).join(', '),
      );
    }
  }

  // Each equipment use applies to the monsters it links, or to a category it
  // names ("Mutated Zygomite" redirects to Zygomite, in "mutated zygomites").
  const equipment = input.equipment.map((e) => {
    const slugs = e.links.flatMap((link) => {
      const slug = slugByPage.get(pageKey(link));
      if (slug) return [slug];
      const category = resolveCategory(link, known);
      return category
        ? onTask.filter((m) => m.categories.includes(category)).map((m) => m.slug)
        : [];
    });
    // Uses about a place, like boots for the Karuulm dungeon floor, name no monster.
    if (slugs.length === 0 && !/\b(floor|dungeon)\b/i.test(e.use)) {
      warnings.push(`${e.item}: no monster for "${e.use}"`);
    }
    return { item: e.item, use: e.use, slugs: new Set(slugs) };
  });

  const assigned = new Set(masters.flatMap((m) => m.assignments.map((a) => a.category)));
  const categories: SlayerCategory[] = [...new Set([...known, ...assigned])]
    .sort(byCodeUnit)
    .map((category) => {
      const monsters = known.has(category)
        ? onTask.filter((m) => m.categories.includes(category)).map((m) => m.slug)
        : (listed.get(category) ?? [])
            .map((page) => slugByPage.get(pageKey(page)))
            .filter((slug) => slug !== undefined);
      const byMaster = masters.flatMap((m) =>
        m.assignments.filter((a) => a.category === category).map((a) => ({ key: m.key, a })),
      );
      return {
        category,
        page: pageByCategory.get(category) ?? null,
        monsters: [...new Set(monsters)].sort(byCodeUnit),
        masters: MASTER_KEYS.filter((key) => byMaster.some((b) => b.key === key)),
        unlocks: [...new Set(byMaster.flatMap((b) => b.a.unlocks))].sort(byCodeUnit),
        extend: extendByCategory.get(category) ?? null,
        equipment: equipment.flatMap(({ item, use, slugs }) => {
          const hits = [...new Set(monsters)].filter((slug) => slugs.has(slug)).sort(byCodeUnit);
          return hits.length > 0 ? [{ item, use, monsters: hits }] : [];
        }),
      };
    });

  for (const category of known) {
    if (!assigned.has(category)) warnings.push(`No master assigns the category "${category}"`);
  }

  const unlocks: Unlock[] = input.unlocks.map(({ name, cost, kind, notes }) => ({
    name,
    cost,
    kind,
    notes,
  }));
  return { masters, categories, unlocks, warnings };
}

/** Plain code-unit order, the same on every machine (localeCompare depends on the locale). */
function byCodeUnit(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
