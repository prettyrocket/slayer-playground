/**
 * Shapes of the JSON in public/data/, written by `npm run sync-data` and read
 * by the app. Data is from the OSRS Wiki (CC BY-NC-SA 3.0).
 */

export const MASTER_KEYS = [
  'turael',
  'spria',
  'mazchna',
  'vannaka',
  'chaeldar',
  'konar',
  'nieve',
  'duradel',
  'krystilia',
  'mortimer',
] as const;
export type MasterKey = (typeof MASTER_KEYS)[number];

/** public/data/monsters.json: every monster page with a Slayer category. */
export interface MonstersFile {
  monsters: Monster[];
}

/** One wiki monster page; its infobox versions are in `versions`, default first. */
export interface Monster {
  slug: string;
  /** Wiki page title; the page is https://oldschool.runescape.wiki/w/<page>. */
  page: string;
  /** From the default version. Null when there is no Slayer level requirement. */
  slayerLevel: number | null;
  /** Lowercased Slayer categories across all versions, e.g. "abyssal demons". */
  categories: string[];
  assignedBy: MasterKey[];
  /** In the wiki's "can only be fought on task" category. */
  taskOnly: boolean;
  members: boolean;
  /** Whether drops/<slug>.json exists. */
  hasDrops: boolean;
  versions: MonsterVersion[];
}

export interface MonsterVersion {
  /** Version label, e.g. "Catacombs of Kourend" or "Level 21, 1" (nested); null for single-version pages. */
  version: string | null;
  /** Exactly one version per monster is the default, and it is first. */
  isDefault: boolean;
  name: string;
  npcIds: number[];
  /** Plain text; several examines are separated by newlines. */
  examine: string | null;
  combatLevel: number | null;
  hitpoints: number | null;
  /** As the wiki writes them, e.g. "28 (Melee)", "50 (Dragonfire)". */
  maxHit: string[];
  attackStyles: string[];
  /** In game ticks. */
  attackSpeed: number | null;
  size: number | null;
  attributes: string[];
  slayerLevel: number | null;
  slayerXp: number | null;
  levels: {
    attack: number | null;
    strength: number | null;
    defence: number | null;
    ranged: number | null;
    magic: number | null;
  };
  offence: {
    attack: number | null;
    strength: number | null;
    magic: number | null;
    magicDamage: number | null;
    ranged: number | null;
    rangedStrength: number | null;
  };
  defence: {
    stab: number | null;
    slash: number | null;
    crush: number | null;
    magic: number | null;
    ranged: number | null;
    lightRanged: number | null;
    standardRanged: number | null;
    heavyRanged: number | null;
  };
  /** e.g. { element: "Water", percent: 50 }; null when the wiki lists none. */
  weakness: { element: string; percent: number | null } | null;
  immunities: {
    /** Resistance values as the wiki gives them: "0", "100", "Poisons", … */
    poison: string | null;
    venom: string | null;
    cannon: boolean | null;
    thrall: boolean | null;
    /** e.g. "Immune (weak)", "Not immune". */
    burn: string | null;
    /** Percent resistance to freezes. */
    freeze: number | null;
  };
}

/** public/data/drops/<slug>.json */
export interface DropsFile {
  page: string;
  drops: Drop[];
}

export interface Drop {
  item: string;
  /** Drop table version, e.g. "Standard" or "Drop table 1"; null when the page has one table. */
  dropVersion: string | null;
  /** [low, high]; null when the wiki gives "Varies" or "Unknown". */
  quantity: [number, number] | null;
  noted: boolean;
  /** Rarity as the wiki writes it: "1/512", "Always", "Rare", … */
  rarity: string;
  /** Chance per roll as a fraction, when `rarity` is numeric or "Always"; multiply by `rolls` per kill. */
  chance: number | null;
  /** The wiki's rarity is an approximation (shown with ~). */
  approx: boolean;
  rolls: number;
  /** A second rarity the wiki shows for some drops, as written. */
  altRarity: string | null;
  /** The wiki's per-item value (it matches high alchemy value); a fallback for untradeables. */
  value: number | null;
  /** "combat" for kills; "reward", "thieving", … for other sources on the page. */
  type: string;
}
