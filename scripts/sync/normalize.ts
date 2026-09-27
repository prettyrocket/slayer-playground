import { createHash } from 'node:crypto';

import {
  type Drop,
  MASTER_KEYS,
  type MasterKey,
  type Monster,
  type MonsterVersion,
} from '../../src/data/types.ts';
import type { RawDrop, RawMonster } from './sources.ts';

/** URL-safe, stable slug for a wiki page title: "Kalphite Queen" -> "kalphite-queen". */
export function slugify(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Slugs for a set of page titles. When titles collide ("Skeleton Mage" and
 * "Skeleton (mage)"), the one that is just its slug with spaces keeps it and
 * the others get a hash of their own title, so a page's slug never depends on
 * which other pages exist.
 */
export function uniqueSlugs(titles: string[]): Map<string, string> {
  const groups = new Map<string, string[]>();
  for (const title of titles) {
    const slug = slugify(title);
    groups.set(slug, [...(groups.get(slug) ?? []), title]);
  }
  const out = new Map<string, string>();
  for (const [slug, group] of groups) {
    for (const title of group) {
      const plain = title.toLowerCase().replace(/ /g, '-') === slug;
      out.set(title, group.length === 1 || plain ? slug : `${slug}-${shortHash(title)}`);
    }
  }
  return out;
}

function shortHash(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 4);
}

// `assigned_by` spells masters several ways; alternates share their main master's list.
const MASTER_ALIASES: Record<string, MasterKey> = {
  aya: 'turael',
  achtryn: 'mazchna',
  steve: 'nieve',
  kuradal: 'duradel',
  'konar quo maten': 'konar',
};

export function masterKey(raw: string): MasterKey | null {
  const key = raw.trim().toLowerCase();
  if ((MASTER_KEYS as readonly string[]).includes(key)) return key as MasterKey;
  return MASTER_ALIASES[key] ?? null;
}

/** Lowercased, trimmed Slayer category; null for placeholders ("No", "None") and corrupted values. */
export function slayerCategory(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  if (!value || value === 'no' || value === 'none' || /['"`{}<>]/.test(value)) return null;
  return value;
}

const num = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
};
const str = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
const strings = (value: unknown): string[] =>
  (Array.isArray(value) ? value : value === undefined ? [] : [value])
    .map(str)
    .filter((v): v is string => v !== null);

/** "Immune" / "Not immune" -> boolean. */
const immune = (value: unknown): boolean | null => {
  const text = str(value)?.toLowerCase();
  if (text === 'immune') return true;
  if (text === 'not immune') return false;
  return null;
};

function version(row: RawMonster): MonsterVersion {
  const element = str(row.elemental_weakness);
  return {
    version: str(row.version_anchor),
    isDefault: row.default_version === true,
    name: str(row.name) ?? String(row.page_name),
    npcIds: strings(row.id)
      .map(Number)
      .filter(Number.isInteger)
      .sort((a, b) => a - b),
    examine: str(row.examine),
    combatLevel: num(row.combat_level),
    hitpoints: num(row.hitpoints),
    maxHit: strings(row.max_hit),
    attackStyles: strings(row.attack_style),
    attackSpeed: num(row.attack_speed),
    size: num(row.size),
    attributes: strings(row.attribute).map((a) => a.toLowerCase()),
    slayerLevel: num(row.slayer_level),
    slayerXp: num(row.slayer_experience),
    levels: {
      attack: num(row.attack_level),
      strength: num(row.strength_level),
      defence: num(row.defence_level),
      ranged: num(row.ranged_level),
      magic: num(row.magic_level),
    },
    offence: {
      attack: num(row.attack_bonus),
      strength: num(row.strength_bonus),
      magic: num(row.magic_attack_bonus),
      magicDamage: num(row.magic_damage_bonus),
      ranged: num(row.range_attack_bonus),
      rangedStrength: num(row.range_strength_bonus),
    },
    defence: {
      stab: num(row.stab_defence_bonus),
      slash: num(row.slash_defence_bonus),
      crush: num(row.crush_defence_bonus),
      magic: num(row.magic_defence_bonus),
      ranged: num(row.range_defence_bonus),
      lightRanged: num(row.light_range_defence_bonus),
      standardRanged: num(row.standard_range_defence_bonus),
      heavyRanged: num(row.heavy_range_defence_bonus),
    },
    weakness:
      element && element.toLowerCase() !== 'none'
        ? {
            element: element[0].toUpperCase() + element.slice(1).toLowerCase(),
            percent: num(row.elemental_weakness_percent),
          }
        : null,
    immunities: {
      poison: str(row.poison_resistance),
      venom: str(row.venom_resistance),
      cannon: immune(row.cannon_immune),
      thrall: immune(row.thrall_immune),
      burn: str(row.burn_immune),
      freeze: num(str(row.freeze_resistance)?.match(/^(\d+(?:\.\d+)?)%/)?.[1]),
    },
  };
}

/**
 * Group infobox rows into one Monster per page, keeping pages where any
 * version has a real Slayer category. Output order is stable (by slug, then
 * default version first, then version label) so re-syncs diff cleanly.
 */
export function buildMonsters(
  rows: RawMonster[],
  taskOnlyPages: Set<string>,
  pagesWithDrops: Set<string>,
): Monster[] {
  const byPage = new Map<string, RawMonster[]>();
  for (const row of rows) {
    const page = str(row.page_name);
    if (!page) continue;
    byPage.set(page, [...(byPage.get(page) ?? []), row]);
  }

  const slayerPages = [...byPage].filter(([, pageRows]) =>
    pageRows.some((r) => strings(r.slayer_category).some((c) => slayerCategory(c) !== null)),
  );
  const slugs = uniqueSlugs(slayerPages.map(([page]) => page));

  const monsters: Monster[] = [];
  for (const [page, pageRows] of slayerPages) {
    const categories = [
      ...new Set(pageRows.flatMap((r) => strings(r.slayer_category).map(slayerCategory))),
    ].filter((c): c is string => c !== null);
    const slug = slugs.get(page)!;

    const versions = pageRows
      .map(version)
      .sort(
        (a, b) =>
          Number(b.isDefault) - Number(a.isDefault) ||
          (a.version ?? '').localeCompare(b.version ?? ''),
      );
    const main = versions[0];
    const masters = new Set(
      pageRows.flatMap((r) => strings(r.assigned_by).map(masterKey)).filter((m) => m !== null),
    );
    monsters.push({
      slug,
      page,
      slayerLevel: main.slayerLevel,
      categories: categories.sort(),
      assignedBy: MASTER_KEYS.filter((m) => masters.has(m)),
      taskOnly: taskOnlyPages.has(page),
      members: pageRows.some((r) => r.is_members_only === true),
      hasDrops: pagesWithDrops.has(page),
      versions,
    });
  }
  return monsters.sort((a, b) => a.slug.localeCompare(b.slug));
}

interface DropJson {
  'Dropped item'?: string;
  'Dropped from'?: string;
  'Drop Quantity'?: string;
  'Quantity Low'?: number;
  'Quantity High'?: number;
  Rarity?: string;
  'Alt Rarity'?: string;
  Approx?: boolean;
  Rolls?: number;
  'Drop Value'?: number;
  'Drop type'?: string;
}

/** "1/512" -> 1/512, "4/128" -> 1/32, "1/8,192" -> 1/8192, "Always" -> 1; words -> null. */
export function parseRarity(rarity: string): number | null {
  const text = rarity.trim();
  if (/^always$/i.test(text)) return 1;
  const match = text.replace(/,/g, '').match(/^~?\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const [n, d] = [Number(match[1]), Number(match[2])];
  return d > 0 ? n / d : null;
}

export function normalizeDrop(raw: RawDrop): Drop | null {
  let json: DropJson;
  try {
    json = JSON.parse(raw.drop_json ?? '') as DropJson;
  } catch {
    return null;
  }
  const item = str(json['Dropped item']) ?? str(raw.item_name);
  if (!item) return null;

  const from = str(json['Dropped from']) ?? '';
  const hash = from.indexOf('#');
  const low = num(json['Quantity Low']);
  const high = num(json['Quantity High']);
  const rarity = str(json.Rarity) ?? 'Unknown';
  return {
    item,
    dropVersion: hash >= 0 ? from.slice(hash + 1) : null,
    quantity: [low ?? 1, high ?? low ?? 1],
    noted: /\(noted\)/i.test(json['Drop Quantity'] ?? ''),
    rarity,
    chance: parseRarity(rarity),
    approx: json.Approx === true,
    rolls: num(json.Rolls) ?? 1,
    altRarity: str(json['Alt Rarity']),
    value: num(json['Drop Value']),
    type: str(json['Drop type'])?.toLowerCase() ?? 'combat',
  };
}

/**
 * Normalize drops for the given pages. Exact duplicate rows (the wiki has a
 * few dozen) are dropped. Order: drop version, then most common first, then item.
 */
export function buildDrops(rows: RawDrop[], pages: Set<string>): Map<string, Drop[]> {
  const byPage = new Map<string, Map<string, Drop>>();
  for (const row of rows) {
    if (!pages.has(row.page_name)) continue;
    const drop = normalizeDrop(row);
    if (!drop) continue;
    const drops = byPage.get(row.page_name) ?? new Map<string, Drop>();
    drops.set(JSON.stringify(drop), drop);
    byPage.set(row.page_name, drops);
  }

  const out = new Map<string, Drop[]>();
  for (const [page, drops] of byPage) {
    out.set(
      page,
      [...drops.values()].sort(
        (a, b) =>
          (a.dropVersion ?? '').localeCompare(b.dropVersion ?? '') ||
          (b.chance ?? -1) - (a.chance ?? -1) ||
          a.item.localeCompare(b.item) ||
          a.quantity[0] - b.quantity[0],
      ),
    );
  }
  return out;
}
