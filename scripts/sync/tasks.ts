import path from 'node:path';

import type { MasterKey, MastersFile, Monster, TasksFile } from '../../src/data/types.ts';
import type { WikiClient } from '../lib/wiki-client.ts';
import { buildTasks } from './build-tasks.ts';
import { MASTER_PAGES, type RawAssignment, parseMasterTable } from './masters.ts';
import { writeJson } from './monsters.ts';
import { parseEquipment, parseRewards } from './parsers.ts';
import { EQUIPMENT_PAGE, REWARDS_PAGE, fetchTaskPageTitles } from './sources.ts';

/**
 * Writes public/data/masters.json and public/data/tasks.json from the master
 * pages, Slayer Rewards and Slayer equipment (one batched request), plus the
 * list of Slayer task/ pages. Returns the pages whose content it used and whether a file changed.
 */
export async function syncTasks(
  client: WikiClient,
  dataDir: string,
  monsters: Monster[],
): Promise<{ sources: string[]; changed: boolean }> {
  const taskPages = await fetchTaskPageTitles(client);
  const pages = [...MASTER_PAGES.map((m) => m.page), REWARDS_PAGE, EQUIPMENT_PAGE];
  const text = await client.wikitext(pages);
  const read = (page: string) => {
    const wikitext = text.get(page);
    if (!wikitext) throw new Error(`Missing page ${page}`);
    return wikitext;
  };

  const assignments = new Map<MasterKey, RawAssignment[]>(
    MASTER_PAGES.map(({ key, page }) => [key, parseMasterTable(read(page), page)]),
  );
  const { masters, tasks, unlocks, warnings } = buildTasks({
    monsters,
    assignments,
    taskPages,
    unlocks: parseRewards(read(REWARDS_PAGE)),
    equipment: parseEquipment(read(EQUIPMENT_PAGE)),
  });
  for (const warning of warnings) console.warn(`  ! ${warning}`);

  const mastersFile: MastersFile = { masters };
  const tasksFile: TasksFile = { tasks, unlocks };
  const changed = [
    await writeJson(path.join(dataDir, 'masters.json'), mastersFile),
    await writeJson(path.join(dataDir, 'tasks.json'), tasksFile),
  ].some(Boolean);

  const rows = masters.reduce((n, m) => n + m.assignments.length, 0);
  console.log(
    `  ${masters.length} masters (${rows} assignments), ${tasks.length} tasks ` +
      `(${tasks.filter((t) => t.page).length} with a guide page), ${unlocks.length} unlocks`,
  );
  return { sources: pages, changed };
}
