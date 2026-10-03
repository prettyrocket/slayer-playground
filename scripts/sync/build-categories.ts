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

/** Monsters of a linked monster's kind that don't need its equipment, by item. */
const NOT_NEEDED: Record<string, string[]> = {
  // "Additionally, sulphur lizards do not require ice coolers to finish off."
  // "Unlike desert lizards, grimy lizards do not require ice coolers to finish off"
  'Ice cooler': ['Sulphur Lizard', 'Grimy Lizard'],
  // Its page says nothing of explosives; sea mogres aren't lured out of the water.
  'Fishing explosive': ['Mogre (sea)'],
};

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

  const masters: SlayerMaster[] = [];
  // Category -> monster pages a master lists for it, for ones no monster page has.
  const listed = new Map<string, string[]>();
  // Category -> the names masters and guide pages call it ("Kalphites", "Boss").
  const names = new Map<string, Set<string>>();
  const addName = (category: string, text: string) =>
    names.set(category, (names.get(category) ?? new Set()).add(text.trim().toLowerCase()));
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
      addName(category, row.name);
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
    if (category) {
      pageByCategory.set(category, page);
      addName(category, page.replace(/^slayer task\//i, ''));
    } else {
      warnings.push(`No category for ${page}`);
    }
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

  // Each equipment use applies to the monsters it links and their kin, or to a
  // category it names ("Mutated Zygomite" redirects to Zygomite, in "mutated zygomites").
  /**
   * A linked monster, the monsters in its categories named for the same kind
   * ("Aberrant spectre" -> Deviant spectre; "Basilisk" -> Basilisk Knight, but
   * "Gargoyle" not Dusk), and their superiors: the equipment page links only
   * the namesake ("Protecting against [[Aberrant spectre]]s").
   */
  const withKin = (slug: string): string[] => {
    const linked = input.monsters.find((m) => m.slug === slug)!;
    const kind = linked.page.toLowerCase().split(' ').at(-1)!;
    const named = new RegExp(`\\b${kind.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
    const kin = input.monsters.filter(
      (m) =>
        m.slug === slug ||
        (m.superiorOf.length === 0 &&
          m.categories.some((c) => linked.categories.includes(c)) &&
          named.test(m.page.toLowerCase())),
    );
    const slugs = new Set(kin.map((m) => m.slug));
    for (const m of input.monsters)
      if (m.superiorOf.some((base) => slugs.has(base))) slugs.add(m.slug);
    return [...slugs];
  };
  const equipment = input.equipment.map((e) => {
    const slugs = e.links.flatMap((link) => {
      const slug = slugByPage.get(pageKey(link));
      if (slug) return withKin(slug);
      const category = resolveCategory(link, known);
      return category
        ? input.monsters.filter((m) => m.categories.includes(category)).map((m) => m.slug)
        : [];
    });
    // Uses about a place, like boots for the Karuulm dungeon floor, name no monster.
    if (slugs.length === 0 && !/\b(floor|dungeon)\b/i.test(e.use)) {
      warnings.push(`${e.item}: no monster for "${e.use}"`);
    }
    const exempt = new Set((NOT_NEEDED[e.item] ?? []).map((page) => slugByPage.get(pageKey(page))));
    return { item: e.item, use: e.use, slugs: new Set(slugs.filter((s) => !exempt.has(s))) };
  });

  const assigned = new Set(masters.flatMap((m) => m.assignments.map((a) => a.category)));
  const categories: SlayerCategory[] = [...new Set([...known, ...assigned])]
    .sort(byCodeUnit)
    .map((category) => {
      const monsters = known.has(category)
        ? input.monsters.filter((m) => m.categories.includes(category)).map((m) => m.slug)
        : (listed.get(category) ?? [])
            .map((page) => slugByPage.get(pageKey(page)))
            .filter((slug) => slug !== undefined);
      const byMaster = masters.flatMap((m) =>
        m.assignments.filter((a) => a.category === category).map((a) => ({ key: m.key, a })),
      );
      const levels = byMaster.map((b) => b.a.slayerLevel);
      return {
        category,
        aliases: [...(names.get(category) ?? [])].filter((n) => n !== category).sort(byCodeUnit),
        // A master with no Slayer level for it assigns it at any level.
        slayerLevel:
          levels.length === 0 || levels.includes(null)
            ? null
            : Math.min(...levels.filter((l): l is number => l !== null)),
        // Filled in by the icons step.
        icon: null,
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

  // Icons are downloaded later (syncUnlockIcons), which sets `icon`.
  const unlocks: Unlock[] = input.unlocks.map(({ name, cost, kind, notes }) => ({
    name,
    cost,
    kind,
    notes,
    icon: null,
  }));
  return { masters, categories, unlocks, warnings };
}

/** Plain code-unit order, the same on every machine (localeCompare depends on the locale). */
function byCodeUnit(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
