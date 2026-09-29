import type { WikiClient } from '../lib/wiki-client.ts';
import { MASTER_PAGES } from './masters.ts';

/**
 * Raw Bucket fetches. Every field is named (Bucket rejects `select('*')`), and
 * the lists mirror the schemas at Bucket:Infobox_monster and Bucket:Dropsline.
 */

export const MONSTER_FIELDS = [
  'page_name',
  'page_name_sub',
  'default_version',
  'version_anchor',
  'name',
  'id',
  'examine',
  'is_members_only',
  'combat_level',
  'hitpoints',
  'max_hit',
  'attack_style',
  'attack_speed',
  'size',
  'attribute',
  'slayer_level',
  'slayer_experience',
  'slayer_category',
  'assigned_by',
  'attack_level',
  'strength_level',
  'defence_level',
  'ranged_level',
  'magic_level',
  'attack_bonus',
  'strength_bonus',
  'magic_attack_bonus',
  'magic_damage_bonus',
  'range_attack_bonus',
  'range_strength_bonus',
  'stab_defence_bonus',
  'slash_defence_bonus',
  'crush_defence_bonus',
  'magic_defence_bonus',
  'range_defence_bonus',
  'light_range_defence_bonus',
  'standard_range_defence_bonus',
  'heavy_range_defence_bonus',
  'elemental_weakness',
  'elemental_weakness_percent',
  'poison_resistance',
  'venom_resistance',
  'cannon_immune',
  'thrall_immune',
  'burn_immune',
  'freeze_resistance',
] as const;

export type RawMonster = Partial<Record<(typeof MONSTER_FIELDS)[number], unknown>>;

export interface RawDrop {
  page_name: string;
  page_name_sub?: string;
  item_name?: string;
  drop_json?: string;
}

const select = (fields: readonly string[]) => fields.map((f) => `'${f}'`).join(',');

/** Every infobox_monster row (about 3,250, so one page). */
export function fetchMonsters(client: WikiClient): Promise<RawMonster[]> {
  return client.bucketAll<RawMonster>(
    `bucket('infobox_monster').select(${select(MONSTER_FIELDS)})`,
    'page_name_sub',
  );
}

/** Pages in the wiki's "can only be fought on task" category. */
export async function fetchTaskOnlyPages(client: WikiClient): Promise<Set<string>> {
  const rows = await client.bucketAll<{ page_name: string }>(
    "bucket('infobox_monster').select('page_name').where('Category:Slayer monsters that can only be fought on task')",
    'page_name',
  );
  return new Set(rows.map((row) => row.page_name));
}

export const SUPERIORS_PAGE = 'Superior slayer monster';
export const REWARDS_PAGE = 'Slayer Rewards';
export const EQUIPMENT_PAGE = 'Slayer equipment';

/** Every page sync-data reads as wikitext: the master pages plus three reference pages. */
export const WIKITEXT_PAGES = [
  ...MASTER_PAGES.map((m) => m.page),
  SUPERIORS_PAGE,
  REWARDS_PAGE,
  EQUIPMENT_PAGE,
];

/**
 * The wikitext of WIKITEXT_PAGES in one batched request, as a lookup. Throws
 * if any page is missing, before anything is written.
 */
export async function fetchPages(client: WikiClient): Promise<(page: string) => string> {
  const text = await client.wikitext(WIKITEXT_PAGES);
  const missing = WIKITEXT_PAGES.filter((page) => !text.get(page));
  if (missing.length > 0) throw new Error(`Missing wiki pages: ${missing.join(', ')}`);
  return (page) => text.get(page)!;
}

/** Titles of the wiki's "Slayer task/..." guide pages, without redirects (about 80, one request). */
export async function fetchTaskPageTitles(client: WikiClient): Promise<string[]> {
  const res = await client.get<{ query?: { allpages?: { title: string }[] } }>({
    action: 'query',
    list: 'allpages',
    apprefix: 'Slayer task/',
    apnamespace: '0',
    apfilterredir: 'nonredirects',
    aplimit: '500',
  });
  return (res.query?.allpages ?? []).map((page) => page.title).sort();
}

/**
 * Every dropsline row (about 40k, 8 or 9 pages). Filtering by
 * Category:Slayer monsters would halve that but missed pages in the #3 spike,
 * so fetch everything and filter to Slayer monsters locally.
 */
export function fetchDrops(client: WikiClient): Promise<RawDrop[]> {
  return client.bucketAll<RawDrop>(
    "bucket('dropsline').select('page_name','page_name_sub','item_name','drop_json')",
    'page_name_sub',
  );
}
