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
  /** Slug of the superior that can spawn on task (needs Bigger and Badder), if any. */
  superior: string | null;
  /** For a superior: slugs of the monsters it spawns from. Empty otherwise. */
  superiorOf: string[];
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

/** public/data/masters.json: each master's assignment table, from their wiki page. */
export interface MastersFile {
  masters: SlayerMaster[];
}

export interface SlayerMaster {
  key: MasterKey;
  name: string;
  /** Wiki page holding the table, e.g. "Nieve/Slayer assignments". */
  page: string;
  /** Alternate masters that give the same list, e.g. ["Steve"]. */
  alternates: string[];
  /** Sum of the assignments' weights; a task's chance is weight / totalWeight. */
  totalWeight: number;
  assignments: Assignment[];
}

/** One row of a master's table. */
export interface Assignment {
  /** Key into categories.json, and a Monster category, e.g. "abyssal demons". */
  category: string;
  weight: number;
  /** [min, max] assigned; min === max for a fixed amount. */
  amount: [number, number] | null;
  /** [min, max] with the task's extend unlock; null when it can't be extended. */
  extended: [number, number] | null;
  slayerLevel: number | null;
  combatLevel: number | null;
  /** Plain text as the wiki writes it, e.g. "85 Slayer, 85 Combat, completion of Priest in Peril". */
  requirements: string | null;
  /** Unlocks (names in unlocks.json) this master needs before assigning it. */
  unlocks: string[];
  /**
   * Slugs of the category's monsters that don't count for this master, e.g.
   * Krystilia's black dragons leave out the King Black Dragon.
   */
  excludes: string[];
  /**
   * Wiki pages linked as places: where Konar may send you, or where Krystilia's
   * task is done. Mostly areas, but Krystilia uses landmarks too ("Muddy chest").
   */
  locations: string[];
}

/**
 * public/data/categories.json: every Slayer category, whether or not a master
 * assigns it, plus task lists that aren't a monster category (Krystilia's
 * "wilderness bosses").
 */
export interface CategoriesFile {
  categories: SlayerCategory[];
}

export interface SlayerCategory {
  /** Lowercased, as in Monster.categories and Assignment.category, e.g. "abyssal demons". */
  category: string;
  /** Other names masters' tables and guide pages use, lowercased, e.g. ["kalphites"] for "kalphite". */
  aliases: string[];
  /**
   * The lowest Slayer level any master needs to assign it; null when a master
   * assigns it with no Slayer level, or none assigns it.
   */
  slayerLevel: number | null;
  /** The wiki's guide page, e.g. "Slayer task/Abyssal demons"; null when there is none. */
  page: string | null;
  /** Slugs of the monsters that count, superiors included; minigame and Deadman copies left out. */
  monsters: string[];
  /** Masters who assign it, in MASTER_KEYS order; empty when none does. */
  masters: MasterKey[];
  /** Unlocks any master needs before assigning it (see each Assignment for which). */
  unlocks: string[];
  /** Name of the unlock that extends it, if any. */
  extend: string | null;
  /** Slayer equipment the wiki ties to its monsters. */
  equipment: CategoryEquipment[];
}

export interface CategoryEquipment {
  item: string;
  /** As the wiki writes it, e.g. "Protecting against Banshees". */
  use: string;
  /** Slugs of the category's monsters it applies to. */
  monsters: string[];
}

/** public/data/unlocks.json: the Slayer Rewards Unlock and Extend tabs. */
export interface UnlocksFile {
  unlocks: Unlock[];
}

/** A Slayer Rewards purchase from the Unlock or Extend tab. */
export interface Unlock {
  name: string;
  /** Slayer reward points. */
  cost: number;
  kind: 'unlock' | 'extend';
  /** Plain text of the wiki's notes. */
  notes: string;
}

/** public/data/meta.json */
export interface MetaFile {
  /** ISO time of the last sync that changed any data. */
  syncedAt: string;
  /** SHA-256 of the other data files, to tell whether a sync changed anything. */
  dataHash: string;
  /** Wiki pages the data came from, for attribution. Monster and drop data comes from every monster page. */
  sources: string[];
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
