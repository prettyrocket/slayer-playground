/**
 * Snapshot Slayer data from the OSRS Wiki into public/data/.
 *
 *   npm run sync-data               # use cached responses where possible
 *   npm run sync-data -- --refresh  # ignore the cache and refetch everything
 *
 * Responses are cached in .cache/wiki/ (gitignored), so re-runs during
 * development send no requests. See scripts/lib/wiki-client.ts for the
 * request etiquette.
 */
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import type { MetaFile } from '../src/data/types.ts';
import { WikiClient } from './lib/wiki-client.ts';
import { syncCategories } from './sync/categories.ts';
import { writeJson } from './sync/files.ts';
import { syncMonsters } from './sync/monsters.ts';
import { SUPERIORS_PAGE, WIKITEXT_PAGES, fetchPages } from './sync/sources.ts';

const root = path.resolve(import.meta.dirname, '..');
const refresh = process.argv.includes('--refresh');
const dataDir = path.join(root, 'public', 'data');
const metaFile = path.join(dataDir, 'meta.json');

const client = new WikiClient({ cacheDir: path.join(root, '.cache', 'wiki'), refresh });

// Every page first, so a missing one fails before anything is written.
const page = await fetchPages(client);
console.log('\nMonsters, drops and superiors');
const monsters = await syncMonsters(client, dataDir, page(SUPERIORS_PAGE));
console.log('\nMasters, categories and unlocks');
await syncCategories(client, dataDir, monsters, page);

// The timestamp moves when the data differs from what the last meta.json
// recorded, so an unchanged sync leaves no diff, and a sync that failed
// halfway is still caught by the next one.
const hash = await dataHash(dataDir);
const old = await readFile(metaFile, 'utf8')
  .then((text) => JSON.parse(text) as MetaFile)
  .catch(() => null);
const changed = old?.dataHash !== hash;
const meta: MetaFile = {
  syncedAt: changed || !old ? new Date().toISOString() : old.syncedAt,
  dataHash: hash,
  sources: ['Bucket:Dropsline', 'Bucket:Infobox_monster', ...WIKITEXT_PAGES].sort(),
};
await writeJson(metaFile, meta);

const { network, cached, retries } = client.stats;
console.log(
  `\nDone: ${network} network requests (${retries} retries), ${cached} from cache. ` +
    (changed ? 'Data changed.' : 'No data changed.'),
);

/** SHA-256 over every data file but meta.json, by path, so any change or removal shows. */
async function dataHash(dir: string): Promise<string> {
  const files = (await readdir(dir, { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(dir, path.join(entry.parentPath, entry.name)).replace(/\\/g, '/'))
    .filter((file) => file !== 'meta.json')
    .sort();
  const hash = createHash('sha256');
  for (const file of files) hash.update(`${file}\n`).update(await readFile(path.join(dir, file)));
  return hash.digest('hex');
}
