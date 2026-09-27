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
import path from 'node:path';

import { WikiClient } from './lib/wiki-client.ts';

const root = path.resolve(import.meta.dirname, '..');
const refresh = process.argv.includes('--refresh');

const client = new WikiClient({ cacheDir: path.join(root, '.cache', 'wiki'), refresh });

// Sync steps are added in #6 (monsters, drops) and #7 (masters, tasks, superiors).
const steps: { name: string; run: (client: WikiClient) => Promise<void> }[] = [];

for (const step of steps) {
  console.log(`\n${step.name}`);
  await step.run(client);
}

const { network, cached, retries } = client.stats;
console.log(`\nDone: ${network} network requests (${retries} retries), ${cached} from cache.`);
