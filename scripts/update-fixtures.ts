/**
 * Refresh the parser test fixtures in scripts/sync/fixtures/ from the wiki.
 *
 *   node scripts/update-fixtures.ts            # from .cache/wiki where possible
 *   node scripts/update-fixtures.ts --refresh  # refetch
 *
 * Fixtures are real wiki responses: whole pages for the wikitext parsers, and
 * the Bucket rows of a few monsters picked for their quirks. After refreshing,
 * a failing test in fixtures.test.ts means the wiki changed its format (or
 * its data: update the expectation if the change is real).
 */
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { WikiClient } from './lib/wiki-client.ts';
import { WIKITEXT_PAGES, fetchDrops, fetchMonsters, fetchPages } from './sync/sources.ts';

/** Monster pages kept from Bucket, and why. */
const FIXTURE_MONSTERS = [
  'Abyssal demon', // versions are locations; drops in three tables
  'Blue dragon', // nested switch infobox ("Ruins of Tapoyauik, 1")
  'Bloodthirst rockslug', // a [sic] note in the name; one version
  'Doom of Mokhaiotl', // repeated "Delve 1" labels, both flagged default; <br/>-packed max hits
  'Dusk', // strip markers in attack styles; drops kept on Grotesque Guardians
  'Dawn',
  'Grimy Lizard', // category "lizard", a typo for "lizards"
  'Cow', // several versions, one of them a place (Zanaris)
  'Abyssal walker', // no Slayer category
];
/** Drop pages kept from Bucket. */
const FIXTURE_DROP_PAGES = ['Abyssal demon', 'Grotesque Guardians'];

const root = path.resolve(import.meta.dirname, '..');
const dir = path.join(root, 'scripts', 'sync', 'fixtures');
const client = new WikiClient({
  cacheDir: path.join(root, '.cache', 'wiki'),
  refresh: process.argv.includes('--refresh'),
});

// The same requests sync-data sends, so a warm cache answers them all. Every
// fetch and check happens before anything is written.
const page = await fetchPages(client);
const monsters = (await fetchMonsters(client)).filter((row) =>
  FIXTURE_MONSTERS.includes(String(row.page_name)),
);
const drops = (await fetchDrops(client)).filter((row) =>
  FIXTURE_DROP_PAGES.includes(row.page_name),
);
const gone = [
  ...FIXTURE_MONSTERS.filter((p) => !monsters.some((row) => row.page_name === p)),
  ...FIXTURE_DROP_PAGES.filter((p) => !drops.some((row) => row.page_name === p)),
];
if (gone.length > 0) {
  throw new Error(`No rows for ${gone.join(', ')}: pick other pages in update-fixtures.ts`);
}

await rm(path.join(dir, 'wikitext'), { recursive: true, force: true });
await mkdir(path.join(dir, 'wikitext'), { recursive: true });
for (const title of WIKITEXT_PAGES) {
  await writeFile(path.join(dir, 'wikitext', `${title.replace(/[/:]/g, '_')}.wiki`), page(title));
}
await writeFile(path.join(dir, 'infobox_monster.json'), `${JSON.stringify(monsters, null, 2)}\n`);
await writeFile(path.join(dir, 'dropsline.json'), `${JSON.stringify(drops, null, 2)}\n`);

const { network, cached } = client.stats;
console.log(
  `${WIKITEXT_PAGES.length} pages, ${monsters.length} monster rows, ${drops.length} drop rows ` +
    `(${network} requests, ${cached} from cache)`,
);
