import {
  type Assignment,
  MASTER_KEYS,
  type MasterKey,
  type Monster,
  type SlayerMaster,
  type Task,
  type TaskEquipment,
  type Unlock,
} from '../../src/data/types.ts';
import { MASTER_PAGES, type RawAssignment } from './masters.ts';
import { pageKey } from './normalize.ts';
import { type RawEquipment, type RawUnlock, requiredUnlocks } from './parsers.ts';

/** Names (master rows, task pages) that aren't a Slayer category, mapped to their task key. */
const TASK_ALIASES: Record<string, string> = {
  // Krystilia: a list of bosses rather than a category; its monsters come from her table.
  'wilderness bosses / demi-bosses': 'wilderness bosses',
  zygomites: 'mutated zygomites',
};

/** Guide pages that cover several categories rather than one task. */
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
  const alias = TASK_ALIASES[base];
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
  tasks: Task[];
  unlocks: Unlock[];
  /** Things that didn't match, for the sync log. */
  warnings: string[];
}

export function buildTasks(input: BuildInput): BuildResult {
  const warnings: string[] = [];
  const categories = new Set(input.monsters.flatMap((m) => m.categories));
  const slugByPage = new Map(input.monsters.map((m) => [pageKey(m.page), m.slug]));
  const onTask = input.monsters.filter((m) => !NOT_ON_TASK.test(m.page));

  const masters: SlayerMaster[] = [];
  // Task key -> monster pages the masters list for it, for tasks that aren't categories.
  const listed = new Map<string, string[]>();
  for (const { key, name, page, alternates } of MASTER_PAGES) {
    const rows = input.assignments.get(key) ?? [];
    const assignments: Assignment[] = [];
    for (const row of rows) {
      const category =
        resolveCategory(row.name, categories) ??
        (row.link ? resolveCategory(row.link, categories) : null);
      if (!category) {
        warnings.push(`${name}: no category for "${row.name}"`);
        continue;
      }
      if (!categories.has(category)) {
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
        // Some location cells link a monster too ("Chaos Temple (Zombie pirates)").
        locations: row.locations.filter((l) => !slugByPage.has(pageKey(l))),
      });
    }
    assignments.sort((a, b) => a.category.localeCompare(b.category));
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
    const category = resolveCategory(page, categories);
    if (category) pageByCategory.set(category, page);
    else warnings.push(`No category for ${page}`);
  }

  const extendByCategory = new Map<string, string>();
  for (const unlock of input.unlocks.filter((u) => u.kind === 'extend')) {
    const category = unlock.links
      .map((link) => resolveCategory(link, categories))
      .find((c) => c !== null);
    if (category) extendByCategory.set(category, unlock.name);
    else warnings.push(`No task for the extend "${unlock.name}"`);
  }

  const taskKeys = [
    ...new Set(masters.flatMap((m) => m.assignments.map((a) => a.category))),
  ].sort();
  const tasks: Task[] = taskKeys.map((category) => {
    const monsters = categories.has(category)
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
      monsters: [...new Set(monsters)].sort(),
      masters: MASTER_KEYS.filter((key) => byMaster.some((b) => b.key === key)),
      unlocks: [...new Set(byMaster.flatMap((b) => b.a.unlocks))].sort(),
      extend: extendByCategory.get(category) ?? null,
      equipment: taskEquipment(input.equipment, new Set(monsters), slugByPage),
    };
  });

  for (const category of categories) {
    if (!taskKeys.includes(category)) warnings.push(`No master assigns the category "${category}"`);
  }

  const unlocks: Unlock[] = input.unlocks.map(({ name, cost, kind, notes }) => ({
    name,
    cost,
    kind,
    notes,
  }));
  return { masters, tasks, unlocks, warnings };
}

/** Equipment whose use links one of the task's monsters. */
function taskEquipment(
  equipment: RawEquipment[],
  monsters: Set<string>,
  slugByPage: Map<string, string>,
): TaskEquipment[] {
  const out: TaskEquipment[] = [];
  for (const { item, use, links } of equipment) {
    const hits = links
      .map((link) => slugByPage.get(pageKey(link)))
      .filter((slug): slug is string => slug !== undefined && monsters.has(slug));
    if (hits.length > 0) out.push({ item, use, monsters: [...new Set(hits)].sort() });
  }
  return out;
}
