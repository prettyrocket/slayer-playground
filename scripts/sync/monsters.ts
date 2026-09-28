import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { DropsFile, Monster, MonstersFile } from '../../src/data/types.ts';
import type { WikiClient } from '../lib/wiki-client.ts';
import { buildDrops, buildMonsters, linkSuperiors } from './normalize.ts';
import { parseSuperiors } from './parsers.ts';
import { SUPERIORS_PAGE, fetchDrops, fetchMonsters, fetchTaskOnlyPages } from './sources.ts';

/**
 * Pretty-printed with a trailing newline, so commits show line-level diffs.
 * Returns whether the file changed, and leaves it untouched when it didn't.
 */
export async function writeJson(file: string, data: unknown): Promise<boolean> {
  const text = `${JSON.stringify(data, null, 2)}\n`;
  const old = await readFile(file, 'utf8').catch(() => null);
  if (old === text) return false;
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, text);
  return true;
}

/**
 * Writes public/data/monsters.json and public/data/drops/<slug>.json, and
 * returns the monsters for the steps after it. `changed` is whether any file changed.
 */
export async function syncMonsters(
  client: WikiClient,
  dataDir: string,
): Promise<{ monsters: Monster[]; changed: boolean }> {
  const rows = await fetchMonsters(client);
  const taskOnly = await fetchTaskOnlyPages(client);
  const dropRows = await fetchDrops(client);
  const superiorsPage = (await client.wikitext([SUPERIORS_PAGE])).get(SUPERIORS_PAGE);
  if (!superiorsPage) throw new Error(`Missing page ${SUPERIORS_PAGE}`);

  const slayerPages = new Set(buildMonsters(rows, taskOnly, new Set()).map((m) => m.page));
  const drops = buildDrops(dropRows, slayerPages);
  const monsters = buildMonsters(rows, taskOnly, new Set(drops.keys()));
  for (const warning of linkSuperiors(monsters, parseSuperiors(superiorsPage))) {
    console.warn(`  ! ${warning}`);
  }

  const file: MonstersFile = { monsters };
  let changed = await writeJson(path.join(dataDir, 'monsters.json'), file);

  const dropsDir = path.join(dataDir, 'drops');
  const written = new Set<string>();
  for (const monster of monsters) {
    const list = drops.get(monster.page);
    if (!list) continue;
    const dropsFile: DropsFile = { page: monster.page, drops: list };
    const name = `${monster.slug}.json`;
    written.add(name);
    if (await writeJson(path.join(dropsDir, name), dropsFile)) changed = true;
  }
  // Remove files for monsters that are gone from the wiki or lost their drops.
  for (const name of await readdir(dropsDir).catch(() => [])) {
    if (!written.has(name)) {
      await rm(path.join(dropsDir, name));
      changed = true;
    }
  }

  const versions = monsters.reduce((n, m) => n + m.versions.length, 0);
  const dropCount = [...drops.values()].reduce((n, d) => n + d.length, 0);
  const superiors = monsters.filter((m) => m.superior).length;
  console.log(
    `  ${monsters.length} monsters (${versions} versions, ${monsters.filter((m) => m.taskOnly).length} task-only, ` +
      `${superiors} with a superior), ${dropCount} drops for ${drops.size} of them`,
  );
  return { monsters, changed };
}
