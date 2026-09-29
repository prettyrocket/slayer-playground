import path from 'node:path';

import type {
  CategoriesFile,
  MasterKey,
  MastersFile,
  Monster,
  UnlocksFile,
} from '../../src/data/types.ts';
import type { WikiClient } from '../lib/wiki-client.ts';
import { buildCategories } from './build-categories.ts';
import { MASTER_PAGES, type RawAssignment, parseMasterTable } from './masters.ts';
import { writeJson } from './monsters.ts';
import { parseEquipment, parseRewards } from './parsers.ts';
import { EQUIPMENT_PAGE, REWARDS_PAGE, fetchTaskPageTitles } from './sources.ts';

/**
 * Writes public/data/masters.json, categories.json and unlocks.json from the
 * master pages, Slayer Rewards and Slayer equipment (`page` reads fetched
 * wikitext), plus the list of Slayer task/ pages (one request).
 */
export async function syncCategories(
  client: WikiClient,
  dataDir: string,
  monsters: Monster[],
  page: (title: string) => string,
): Promise<void> {
  const taskPages = await fetchTaskPageTitles(client);
  const warnings: string[] = [];
  const assignments = new Map<MasterKey, RawAssignment[]>(
    MASTER_PAGES.map(({ key, page: title }) => [
      key,
      parseMasterTable(page(title), title, (w) => warnings.push(w)),
    ]),
  );
  const built = buildCategories({
    monsters,
    assignments,
    taskPages,
    unlocks: parseRewards(page(REWARDS_PAGE)),
    equipment: parseEquipment(page(EQUIPMENT_PAGE)),
  });
  const { masters, categories, unlocks } = built;
  for (const warning of [...warnings, ...built.warnings]) console.warn(`  ! ${warning}`);

  const mastersFile: MastersFile = { masters };
  const categoriesFile: CategoriesFile = { categories };
  const unlocksFile: UnlocksFile = { unlocks };
  await writeJson(path.join(dataDir, 'masters.json'), mastersFile);
  await writeJson(path.join(dataDir, 'categories.json'), categoriesFile);
  await writeJson(path.join(dataDir, 'unlocks.json'), unlocksFile);

  const rows = masters.reduce((n, m) => n + m.assignments.length, 0);
  console.log(
    `  ${masters.length} masters (${rows} assignments), ${categories.length} categories ` +
      `(${categories.filter((c) => c.page).length} with a guide page), ${unlocks.length} unlocks`,
  );
}
