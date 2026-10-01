import { mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';

import type { Monster, SlayerCategory } from '../../src/data/types.ts';
import type { WikiClient } from '../lib/wiki-client.ts';
import { resolveCategory } from './build-categories.ts';
import { writeFile } from './files.ts';
import { MASTER_PAGES } from './masters.ts';
import { pageKey } from './normalize.ts';
import { fetchImageUrls, fetchSlayerIcons } from './sources.ts';

/** Icons wider than this come from a thumbnail of this width; the card shows them at most 40px. */
export const ICON_WIDTH = 64;

/**
 * The wiki file to show for each category, by category:
 * 1. an in-game Slayer icon ("File:Abyssal demon icon.png") named after the
 *    category or after a monster only in that category ("Jelly" -> jellies);
 * 2. else the picture of the Slayer unlock it needs ("Like a boss" for bosses);
 * 3. else the infobox image of its most typical monster (see `typical`);
 * 4. else none.
 * `slayerIcons` are the file titles in Category:Slayer icons.
 */
export function chooseIcons(
  categories: SlayerCategory[],
  monsters: Monster[],
  slayerIcons: string[],
): Map<string, string> {
  const known = new Set(categories.map((c) => c.category));
  const byPage = new Map(monsters.map((m) => [pageKey(m.page), m]));
  const bySlug = new Map(monsters.map((m) => [m.slug, m]));
  const out = new Map<string, string>();

  // Holiday and old versions, and unlock pictures, aren't task icons.
  const icons = slayerIcons.filter((t) => / icon\.png$/i.test(t) && !/\(.*\) icon\.png$/i.test(t));
  const iconName = (title: string) =>
    title.replace(/^File:/i, '').replace(/( slayer)? icon\.png$/i, '');
  // Named after the category first, so "Black dragon icon" beats "Brutal black dragon icon".
  for (const title of icons) {
    const category = resolveCategory(iconName(title), known);
    if (category && !out.has(category)) out.set(category, title);
  }
  for (const title of icons) {
    const monster = byPage.get(pageKey(iconName(title)));
    const only = monster?.categories.length === 1 ? monster.categories[0] : null;
    if (only && known.has(only) && !out.has(only)) out.set(only, title);
  }

  const unlockPictures = new Map(
    slayerIcons
      .filter((t) => !/ icon\.png$/i.test(t))
      .map((t) => [
        t
          .replace(/^File:/i, '')
          .replace(/\.png$/i, '')
          .toLowerCase(),
        t,
      ]),
  );
  for (const { category, unlocks } of categories) {
    const picture = unlocks.map((u) => unlockPictures.get(u.toLowerCase())).find(Boolean);
    if (picture && !out.has(category)) out.set(category, picture);
  }

  for (const { category, monsters: slugs } of categories) {
    if (out.has(category)) continue;
    const pick = typical(
      category,
      slugs.map((slug) => bySlug.get(slug)).filter((m) => !!m),
    );
    if (pick) out.set(category, `File:${pick.versions[0].image}`);
  }
  return out;
}

/**
 * The monster that best shows what a category looks like, among those with an
 * image and not a superior (a rare spawn): its namesake ("Wolf" for wolves);
 * else a non-boss named after it ("Grizzly bear", "Kalphite Worker"); else a
 * non-boss with drops (a real monster, not a minigame copy); else any. The
 * plainest page name wins a tie.
 */
function typical(category: string, monsters: Monster[]): Monster | undefined {
  const word = singular(category);
  // "Grizzly bear" and "TzHaar-Ket" name "bear" and "tzhaar" as whole words.
  const named = (page: string) =>
    ` ${page.toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `.includes(` ${word} `);
  const boss = (m: Monster) => m.categories.includes('bosses');
  const rank = (m: Monster) =>
    singular(m.page) === word ? 0 : !boss(m) && named(m.page) ? 1 : !boss(m) && m.hasDrops ? 2 : 3;
  return monsters
    .filter((m) => m.versions[0]?.image && m.superiorOf.length === 0)
    .sort(
      (a, b) => rank(a) - rank(b) || a.page.length - b.page.length || a.page.localeCompare(b.page),
    )[0];
}

/** "Wolves" -> "wolf", "Jellies" -> "jelly", "Monkey (monster)" -> "monkey". Good enough to spot a namesake. */
function singular(name: string): string {
  const base = name
    .replace(/\s*\(.*\)$/, '')
    .trim()
    .toLowerCase();
  if (base.endsWith('ves')) return `${base.slice(0, -3)}f`;
  if (base.endsWith('ies')) return `${base.slice(0, -3)}y`;
  if (/(ch|sh|ss|x)es$/.test(base)) return base.slice(0, -2);
  return base.replace(/s$/, '');
}

const slugOf = (category: string) => category.replaceAll(' ', '-');

/**
 * Downloads each category's icon into public/data/icons/<slug>.<ext> and sets
 * `icon` on the categories. Files the wiki versions by URL are downloaded once
 * (see WikiClient.download); icons of categories that no longer have one are removed.
 */
export async function syncIcons(
  client: WikiClient,
  dataDir: string,
  categories: SlayerCategory[],
  monsters: Monster[],
): Promise<string[]> {
  const warnings: string[] = [];
  const chosen = chooseIcons(categories, monsters, await fetchSlayerIcons(client));
  const urls = await fetchImageUrls(client, [...new Set(chosen.values())], ICON_WIDTH);

  const dir = path.join(dataDir, 'icons');
  await mkdir(dir, { recursive: true });
  const written = new Set<string>();
  for (const category of categories) {
    const file = chosen.get(category.category);
    const url = file && urls.get(file);
    if (file && !url) warnings.push(`No image for ${file} (${category.category})`);
    if (!url) continue;
    const name = `${slugOf(category.category)}${path.extname(new URL(url).pathname).toLowerCase()}`;
    await writeFile(path.join(dir, name), await client.download(url));
    written.add(name);
    category.icon = `icons/${name}`;
  }
  // Files only: icons/masters/ is the masters' (syncMasterIcons).
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isFile() && !written.has(entry.name)) await rm(path.join(dir, entry.name));
  }
  console.log(`  ${written.size} of ${categories.length} categories have an icon`);
  return warnings;
}

/**
 * Downloads a thumbnail of each monster's default infobox image into
 * public/data/icons/monsters/<slug>.<ext> and sets `icon` on the monsters.
 * About 650 files the first time, one polite request each; cached after that
 * (see WikiClient.download). Icons of monsters that are gone are removed.
 */
export async function syncMonsterIcons(
  client: WikiClient,
  dataDir: string,
  monsters: Monster[],
): Promise<string[]> {
  const warnings: string[] = [];
  const file = (m: Monster) => (m.versions[0]?.image ? `File:${m.versions[0].image}` : null);
  const titles = [...new Set(monsters.map(file).filter((t): t is string => t !== null))];
  const urls = await fetchImageUrls(client, titles, ICON_WIDTH);

  const dir = path.join(dataDir, 'icons', 'monsters');
  await mkdir(dir, { recursive: true });
  const written = new Set<string>();
  for (const monster of monsters) {
    const title = file(monster);
    const url = title && urls.get(title);
    if (title && !url) warnings.push(`No image for ${title} (${monster.page})`);
    if (!url) continue;
    const name = `${monster.slug}${path.extname(new URL(url).pathname).toLowerCase()}`;
    await writeFile(path.join(dir, name), await client.download(url));
    written.add(name);
    monster.icon = `icons/monsters/${name}`;
  }
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isFile() && !written.has(entry.name)) await rm(path.join(dir, entry.name));
  }
  console.log(`  ${written.size} of ${monsters.length} monsters have an icon`);
  return warnings;
}

/**
 * Downloads each master's chathead (their dialogue portrait) to
 * public/data/icons/masters/<key>.png, where the app looks for it.
 */
export async function syncMasterIcons(client: WikiClient, dataDir: string): Promise<string[]> {
  const warnings: string[] = [];
  const title = (name: string) => `File:${name} chathead.png`;
  const urls = await fetchImageUrls(
    client,
    MASTER_PAGES.map((m) => title(m.name)),
    ICON_WIDTH,
  );
  const dir = path.join(dataDir, 'icons', 'masters');
  for (const { key, name } of MASTER_PAGES) {
    const url = urls.get(title(name));
    if (!url || !/\.png$/i.test(new URL(url).pathname)) {
      warnings.push(`No PNG chathead for ${name}`);
      continue;
    }
    await writeFile(path.join(dir, `${key}.png`), await client.download(url));
  }
  return warnings;
}
