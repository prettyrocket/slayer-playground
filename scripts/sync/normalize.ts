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

// Categories a monster page misspells, mapped to the one the masters assign.
const CATEGORY_ALIASES: Record<string, string> = {
  lizard: 'lizards', // Grimy Lizard
};

/** Lowercased, trimmed Slayer category; null for placeholders ("No", "None") and corrupted values. */
export function slayerCategory(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  if (!value || value === 'no' || value === 'none' || /['"`{}<>]/.test(value)) return null;
  return CATEGORY_ALIASES[value] ?? value;
}

const num = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
};
const ENTITIES: Record<string, string> = {
  amp: '&',
  quot: '"',
  apos: "'",
  lt: '<',
  gt: '>',
  nbsp: ' ',
  thinsp: ' ',
  // A marker before each of several examines; the line breaks already separate them.
  bull: '',
};

/**
 * Plain text from a Bucket value. Bucket stores fields after templates expand,
 * so they can hold rendered HTML and leftover wikitext. The rules are generic
 * rather than per template (they match better-monster-examine's WikiSanitizer):
 * every tag goes, entities decode, and line breaks survive as `\n`, since one
 * field can pack several values.
 */
export function plainText(value: string): string {
  const decoded = value
    // MediaWiki strip markers (refs, nowiki): U+007F-bounded, or the quoted UNIQ form.
    .replace(/\x7f[^\x7f]*\x7f/g, '')
    .replace(/'"`UNIQ--[\w-]+?-QINU`"'/g, '')
    // Editorial notes kept out of print, e.g. {{sic}}'s "[sic]": dropped whole.
    .replace(/<sup[^>]*\bnoprint\b.*?<\/sup>/gis, '')
    // [[Magic]] -> Magic, [[a|b]] -> b; then any unbalanced brackets.
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/\[\[|\]\]/g, '')
    // <br> and a plainlist's <div> wrapper separate values.
    .replace(/<br\s*\/?>|<\/?div[^>]*>/gi, '\n')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    // Unrendered bold/italic quotes, and list bullets.
    .replace(/'{2,}/g, '')
    .replace(/^[ \t]*\*+/gm, '')
    // Ranges use a hyphen everywhere else ("30-37").
    .replace(/–/g, '-')
    // Decoded after the tag pass, so an escaped "&lt;" survives as text.
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (entity, code: string) => {
      const cp = code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code);
      return cp <= 0x10ffff ? String.fromCodePoint(cp) : entity;
    })
    .replace(/&([a-z]+);/gi, (entity, name: string) => ENTITIES[name.toLowerCase()] ?? entity);
  return decoded
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

/**
 * How the wiki writes "no value" (an attack style of "None", a max hit of "N/A").
 * Not "No": that is a real answer.
 */
const isPlaceholder = (text: string) => /^(none|n\/a)$/i.test(text);

/** Plain text, or null when empty or a placeholder. */
const str = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const text = plainText(value);
  return text === '' || isPlaceholder(text) ? null : text;
};
/** Every value as plain text, one entry per line (the wiki packs lists into one value with `<br/>`). */
const strings = (value: unknown): string[] =>
  (Array.isArray(value) ? value : value === undefined ? [] : [value])
    .flatMap((v) => (typeof v === 'string' ? plainText(v).split('\n') : []))
    .filter((v) => v !== '' && !isPlaceholder(v));

/** "Zombie bone#Unpolished" -> "Zombie bone (Unpolished)": the wiki links item versions by anchor. */
export const itemName = (name: string): string => {
  const hash = name.indexOf('#');
  return hash < 0 ? name : `${name.slice(0, hash).trim()} (${name.slice(hash + 1).trim()})`;
};

/** "Skeleton#Level 21, 1" -> "Level 21, 1". Nested switch infoboxes join their labels there. */
const versionLabel = (row: RawMonster): string | null => {
  const sub = str(row.page_name_sub);
  const hash = sub?.indexOf('#') ?? -1;
  return sub && hash >= 0 ? sub.slice(hash + 1) : str(row.version_anchor);
};

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
    version: versionLabel(row),
    isDefault: row.default_version === true,
    name: str(row.name) ?? String(row.page_name),
    // "File:Cow (1).png" -> "Cow (1).png"
    image: strings(row.image)[0]?.replace(/^file:/i, '') ?? null,
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

    const versions = pageRows.map(version).sort(
      (a, b) =>
        Number(b.isDefault) - Number(a.isDefault) ||
        (a.version ?? '').localeCompare(b.version ?? '', 'en', { numeric: true }) ||
        // Same label: order by content so re-syncs don't reshuffle them.
        JSON.stringify(a).localeCompare(JSON.stringify(b)),
    );
    // Nested switch infoboxes flag a default in each group, and some pages flag
    // none, so keep exactly one: the first after sorting.
    versions.forEach((v, i) => (v.isDefault = i === 0));
    // A few pages repeat a label for different forms ("Delve 1" x3); number the repeats.
    const seen = new Map<string | null, number>();
    for (const v of versions) {
      const n = (seen.get(v.version) ?? 0) + 1;
      seen.set(v.version, n);
      if (n > 1) v.version = `${v.version ?? 'Version'} (${n})`;
    }
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
      // Filled in by syncMonsterIcons.
      icon: null,
      // Filled in by linkSuperiors.
      superior: null,
      superiorOf: [],
      versions,
      // Filled in by addLocations.
      locations: [],
    });
  }
  return monsters.sort((a, b) => a.slug.localeCompare(b.slug));
}

/**
 * Titles as tables link them compare loosely: "Crawling hand" is the page
 * "Crawling Hand", and "Rock slug" redirects to "Rockslug".
 */
export const pageKey = (page: string) => page.toLowerCase().replace(/\s+/g, '');

/**
 * Sets `superior` and `superiorOf` from base page -> superior page, and gives
 * each superior its base's categories, since it counts for the base's task
 * (the wiki files Blood-starved venator under vampyres only). Pages that
 * aren't Slayer monsters here are skipped.
 */
export function linkSuperiors(monsters: Monster[], superiors: Map<string, string>): string[] {
  const warnings: string[] = [];
  const byPage = new Map(monsters.map((m) => [pageKey(m.page), m]));
  for (const [basePage, superiorPage] of superiors) {
    const base = byPage.get(pageKey(basePage));
    const superior = byPage.get(pageKey(superiorPage));
    if (!base || !superior) {
      warnings.push(`Superior ${superiorPage} of ${basePage}: not a Slayer monster page`);
      continue;
    }
    base.superior = superior.slug;
    superior.superiorOf = [...superior.superiorOf, base.slug].sort();
    superior.categories = [...new Set([...superior.categories, ...base.categories])].sort();
  }
  return warnings;
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
  const name = str(json['Dropped item']) ?? str(raw.item_name);
  if (!name) return null;
  const item = itemName(name);

  const from = str(json['Dropped from']) ?? '';
  const hash = from.indexOf('#');
  const low = num(json['Quantity Low']);
  const high = num(json['Quantity High']);
  const rarity = str(json.Rarity) ?? 'Unknown';
  return {
    item,
    dropVersion: hash >= 0 ? from.slice(hash + 1) : null,
    // No numbers when the wiki writes "Varies" or "Unknown".
    quantity: low === null ? null : [low, high ?? low],
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
 * Monsters whose drops live on another page, which has no monster infobox of
 * its own: monster page -> drops page.
 */
export const DROPS_PAGE: Record<string, string> = {
  Dusk: 'Grotesque Guardians',
  Dawn: 'Grotesque Guardians',
};

/**
 * Normalize drops for the given monster pages, keyed by monster page. Exact
 * duplicate rows (the wiki has a few dozen) are dropped. Order: drop version,
 * then most common first, then item.
 */
export function buildDrops(rows: RawDrop[], pages: Set<string>): Map<string, Drop[]> {
  const monstersOf = new Map<string, string[]>();
  for (const page of pages) {
    const dropsPage = DROPS_PAGE[page] ?? page;
    monstersOf.set(dropsPage, [...(monstersOf.get(dropsPage) ?? []), page]);
  }

  const byPage = new Map<string, Map<string, Drop>>();
  for (const row of rows) {
    const monsters = monstersOf.get(row.page_name);
    if (!monsters) continue;
    const drop = normalizeDrop(row);
    if (!drop) continue;
    for (const page of monsters) {
      const drops = byPage.get(page) ?? new Map<string, Drop>();
      drops.set(JSON.stringify(drop), drop);
      byPage.set(page, drops);
    }
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
          (a.quantity?.[0] ?? -1) - (b.quantity?.[0] ?? -1),
      ),
    );
  }
  return out;
}
