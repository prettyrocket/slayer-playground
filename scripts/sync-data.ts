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
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { MetaFile } from '../src/data/types.ts';
import { WikiClient } from './lib/wiki-client.ts';
import { syncCategories } from './sync/categories.ts';
import { syncMonsters, writeJson } from './sync/monsters.ts';
import { SUPERIORS_PAGE } from './sync/sources.ts';

const root = path.resolve(import.meta.dirname, '..');
const refresh = process.argv.includes('--refresh');
const dataDir = path.join(root, 'public', 'data');

const client = new WikiClient({ cacheDir: path.join(root, '.cache', 'wiki'), refresh });

console.log('\nMonsters, drops and superiors');
const monsters = await syncMonsters(client, dataDir);
console.log('\nMasters, categories and unlocks');
const categories = await syncCategories(client, dataDir, monsters.monsters);

// Only move the timestamp when the data moved, so an unchanged sync leaves no diff.
const metaFile = path.join(dataDir, 'meta.json');
const sources = [
  'Bucket:Infobox_monster',
  'Bucket:Dropsline',
  SUPERIORS_PAGE,
  ...categories.sources,
].sort();
const old = await readFile(metaFile, 'utf8')
  .then((text) => JSON.parse(text) as MetaFile)
  .catch(() => null);
const changed = monsters.changed || categories.changed || old === null;
const meta: MetaFile = {
  syncedAt: changed ? new Date().toISOString() : old.syncedAt,
  sources,
};
await writeJson(metaFile, meta);

const { network, cached, retries } = client.stats;
console.log(
  `\nDone: ${network} network requests (${retries} retries), ${cached} from cache. ` +
    (changed ? 'Data changed.' : 'No data changed.'),
);
