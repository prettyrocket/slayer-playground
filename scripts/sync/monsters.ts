import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { DropsFile, MonstersFile } from '../../src/data/types.ts';
import type { WikiClient } from '../lib/wiki-client.ts';
import { buildDrops, buildMonsters } from './normalize.ts';
import { fetchDrops, fetchMonsters, fetchTaskOnlyPages } from './sources.ts';

/** Pretty-printed with a trailing newline, so commits show line-level diffs. */
export async function writeJson(file: string, data: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`);
}

/** Writes public/data/monsters.json and public/data/drops/<slug>.json. */
export async function syncMonsters(client: WikiClient, dataDir: string): Promise<void> {
  const rows = await fetchMonsters(client);
  const taskOnly = await fetchTaskOnlyPages(client);
  const dropRows = await fetchDrops(client);

  const slayerPages = new Set(buildMonsters(rows, taskOnly, new Set()).map((m) => m.page));
  const drops = buildDrops(dropRows, slayerPages);
  const monsters = buildMonsters(rows, taskOnly, new Set(drops.keys()));

  const file: MonstersFile = { monsters };
  await writeJson(path.join(dataDir, 'monsters.json'), file);

  // Rewrite the folder so monsters removed from the wiki don't leave stale files.
  const dropsDir = path.join(dataDir, 'drops');
  await rm(dropsDir, { recursive: true, force: true });
  for (const monster of monsters) {
    const list = drops.get(monster.page);
    if (!list) continue;
    const dropsFile: DropsFile = { page: monster.page, drops: list };
    await writeJson(path.join(dropsDir, `${monster.slug}.json`), dropsFile);
  }

  const versions = monsters.reduce((n, m) => n + m.versions.length, 0);
  const dropCount = [...drops.values()].reduce((n, d) => n + d.length, 0);
  console.log(
    `  ${monsters.length} monsters (${versions} versions, ${monsters.filter((m) => m.taskOnly).length} task-only), ` +
      `${dropCount} drops for ${drops.size} of them`,
  );
}
