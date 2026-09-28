/**
 * Refresh the parser test fixtures in scripts/sync/fixtures/ from the wiki.
 *
 *   node scripts/update-fixtures.ts               # from .cache/wiki where possible
 *   node scripts/update-fixtures.ts -- --refresh  # refetch
 *
 * Fixtures are real wiki responses: whole pages for the wikitext parsers, and
 * the Bucket rows of a few monsters picked for their quirks. After refreshing,
 * a failing test in fixtures.test.ts means the wiki changed its format (or
 * its data: update the expectation if the change is real).
 */
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { WikiClient } from './lib/wiki-client.ts';
import { MASTER_PAGES } from './sync/masters.ts';
import {
  EQUIPMENT_PAGE,
  REWARDS_PAGE,
  SUPERIORS_PAGE,
  fetchDrops,
  fetchMonsters,
} from './sync/sources.ts';

/** Monster pages kept from Bucket, and why. */
const FIXTURE_MONSTERS = [
  'Abyssal demon', // versions are locations; drops in three tables
  'Blue dragon', // nested switch infobox ("Level 111, 1")
  'Bloodthirst rockslug', // a [sic] note in the name
  'Doom of Mokhaiotl', // repeated "Delve" labels; <br/>-packed max hits
  'Dusk', // strip markers; drops kept on Grotesque Guardians
  'Dawn',
  'Grimy Lizard', // category "lizard", a typo for "lizards"
  'Cow', // one version
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

// The same batches sync-data sends, so a warm cache answers them all.
const batches = [
  [...MASTER_PAGES.map((m) => m.page), REWARDS_PAGE, EQUIPMENT_PAGE],
  [SUPERIORS_PAGE],
];
const text = new Map<string, string | null>();
for (const batch of batches)
  for (const [page, t] of await client.wikitext(batch)) text.set(page, t);
const pages = batches.flat();
await rm(path.join(dir, 'wikitext'), { recursive: true, force: true });
await mkdir(path.join(dir, 'wikitext'), { recursive: true });
for (const page of pages) {
  const wikitext = text.get(page);
  if (!wikitext) throw new Error(`Missing page ${page}`);
  await writeFile(path.join(dir, 'wikitext', `${page.replace(/[/:]/g, '_')}.wiki`), wikitext);
}

const monsters = (await fetchMonsters(client)).filter((row) =>
  FIXTURE_MONSTERS.includes(String(row.page_name)),
);
const drops = (await fetchDrops(client)).filter((row) =>
  FIXTURE_DROP_PAGES.includes(row.page_name),
);
await writeFile(path.join(dir, 'infobox_monster.json'), `${JSON.stringify(monsters, null, 2)}\n`);
await writeFile(path.join(dir, 'dropsline.json'), `${JSON.stringify(drops, null, 2)}\n`);

const { network, cached } = client.stats;
console.log(
  `${pages.length} pages, ${monsters.length} monster rows, ${drops.length} drop rows ` +
    `(${network} requests, ${cached} from cache)`,
);
