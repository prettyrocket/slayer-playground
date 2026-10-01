import { readdir, rm } from 'node:fs/promises';
import path from 'node:path';

import type { DropsFile, Monster, MonstersFile } from '../../src/data/types.ts';
import type { WikiClient } from '../lib/wiki-client.ts';
import { writeJson } from './files.ts';
import { syncMonsterIcons } from './icons.ts';
import { addLocations } from './locations.ts';
import { buildDrops, buildMonsters, linkSuperiors } from './normalize.ts';
import { parseSuperiors } from './parsers.ts';
import { fetchDrops, fetchMonsters, fetchPageCategories, fetchTaskOnlyPages } from './sources.ts';
import { applyViability } from './viability.ts';

/**
 * Writes public/data/monsters.json and public/data/drops/<slug>.json, and
 * returns the monsters for the steps after it. `superiorsPage` is the
 * wikitext of Superior slayer monster; `taskPages` the titles of the Slayer
 * task/ pages, whose locations tables add multicombat, cannon and safespots.
 */
export async function syncMonsters(
  client: WikiClient,
  dataDir: string,
  superiorsPage: string,
  taskPages: string[],
): Promise<Monster[]> {
  const rows = await fetchMonsters(client);
  const taskOnly = await fetchTaskOnlyPages(client);
  const dropRows = await fetchDrops(client);

  const slayerPages = new Set(buildMonsters(rows, taskOnly, new Set()).map((m) => m.page));
  const drops = buildDrops(dropRows, slayerPages);
  const monsters = buildMonsters(rows, taskOnly, new Set(drops.keys()));
  for (const warning of linkSuperiors(monsters, parseSuperiors(superiorsPage))) {
    console.warn(`  ! ${warning}`);
  }
  // Every monster page's wikitext (about 14 requests) and the task pages' (2).
  const monsterText = await client.wikitext(monsters.map((m) => m.page));
  const taskText = await client.wikitext(taskPages);
  for (const warning of addLocations(monsters, monsterText, taskText)) {
    console.warn(`  ! ${warning}`);
  }
  // Wiki categories (about 14 requests) tell quest fights, minigames and removed content apart.
  const pageCategories = await fetchPageCategories(
    client,
    monsters.map((m) => m.page),
  );
  for (const line of applyViability(monsters, pageCategories)) console.log(`  ${line}`);

  for (const warning of await syncMonsterIcons(client, dataDir, monsters)) {
    console.warn(`  ! ${warning}`);
  }

  const file: MonstersFile = { monsters };
  await writeJson(path.join(dataDir, 'monsters.json'), file);

  const dropsDir = path.join(dataDir, 'drops');
  const written = new Set<string>();
  for (const monster of monsters) {
    const list = drops.get(monster.page);
    if (!list) continue;
    const dropsFile: DropsFile = { page: monster.page, drops: list };
    const name = `${monster.slug}.json`;
    written.add(name);
    await writeJson(path.join(dropsDir, name), dropsFile);
  }
  // Remove files for monsters that are gone from the wiki or lost their drops.
  for (const name of await readdir(dropsDir).catch(() => [])) {
    if (!written.has(name)) await rm(path.join(dropsDir, name));
  }

  const versions = monsters.reduce((n, m) => n + m.versions.length, 0);
  const dropCount = [...drops.values()].reduce((n, d) => n + d.length, 0);
  const superiors = monsters.filter((m) => m.superior).length;
  const placed = monsters.filter((m) => m.locations.length > 0);
  const places = placed.flatMap((m) => m.locations);
  console.log(
    `  ${monsters.length} monsters (${versions} versions, ${monsters.filter((m) => m.taskOnly).length} task-only, ` +
      `${superiors} with a superior), ${dropCount} drops for ${drops.size} of them, ` +
      `${places.length} locations for ${placed.length} of them ` +
      `(${places.filter((l) => l.cannon !== null).length} matched to a task page)`,
  );
  return monsters;
}
