import { column, findTables, linkTargets, parseTable, wikiPlain } from './wikitext.ts';

/**
 * Parsers for single wiki pages that feed tasks.json and monsters.json:
 * Superior slayer monster, Slayer Rewards and Slayer equipment.
 */

/** Base monster page -> superior monster page, from the table on Superior slayer monster. */
export function parseSuperiors(wikitext: string): Map<string, string> {
  const block = findTables(wikitext).find((t) => /superior variant/i.test(t));
  if (!block) throw new Error('No superior table on Superior slayer monster');
  const table = parseTable(block);
  const normal = column(table, 'normal variant');
  const superior = column(table, 'superior variant');
  const out = new Map<string, string>();
  for (const cells of table.rows) {
    const base = linkTargets(cells[normal] ?? '')[0];
    const sup = linkTargets(cells[superior] ?? '')[0];
    if (base && sup) out.set(base, sup);
  }
  return out;
}

export interface RawUnlock {
  name: string;
  cost: number;
  /** "unlock" changes what you're assigned or how you fight; "extend" raises a task's amount. */
  kind: 'unlock' | 'extend';
  /** Plain text of the Notes column. */
  notes: string;
  /** Link targets in the notes, used to find the task an extend applies to. */
  links: string[];
}

/** The Unlock and Extend tables on Slayer Rewards. */
export function parseRewards(wikitext: string): RawUnlock[] {
  const out: RawUnlock[] = [];
  for (const kind of ['unlock', 'extend'] as const) {
    const section = wikitext.match(
      new RegExp(`^===\\s*${kind}\\s*===\\s*$([\\s\\S]*?)(?=^==)`, 'im'),
    );
    const block = section && findTables(section[1])[0];
    if (!block) throw new Error(`No ${kind} table on Slayer Rewards`);
    const table = parseTable(block);
    const name = column(table, 'unlock');
    const cost = column(table, 'cost');
    const notes = column(table, 'notes');
    for (const cells of table.rows) {
      const unlock = wikiPlain(cells[name] ?? '');
      const points = Number(wikiPlain(cells[cost] ?? '').replace(/,/g, ''));
      if (!unlock || !Number.isFinite(points)) continue;
      out.push({
        name: unlock,
        cost: points,
        kind,
        notes: wikiPlain(cells[notes] ?? ''),
        links: linkTargets(cells[notes] ?? ''),
      });
    }
  }
  return out;
}

/**
 * Names of the unlocks a requirement text asks for, as the Rewards page spells
 * them: "unlocked the Watch the birdie ability via ..." -> "Watch the Birdie".
 * Unknown names are returned as written, so the caller can report them.
 */
export function requiredUnlocks(requirements: string, unlocks: RawUnlock[]): string[] {
  const names = [...requirements.matchAll(/unlocked (?:the )?(.+?) (?:ability )?via/gi)].map((m) =>
    m[1].trim(),
  );
  return names.map(
    (name) => unlocks.find((u) => u.name.toLowerCase() === name.toLowerCase())?.name ?? name,
  );
}

export interface RawEquipment {
  item: string;
  /** What it's for, e.g. "Protecting against Banshees". */
  use: string;
  /** Pages linked from that use, e.g. ["Banshee"]; the caller keeps monster pages. */
  links: string[];
}

// Uses that tie an item to fighting a monster, not to a place or a craft.
const MONSTER_USE = /^(protecting against|protection from|finishing off|killing|harming|luring)\b/i;

/** Items on Slayer equipment whose use is tied to a monster. */
export function parseEquipment(wikitext: string): RawEquipment[] {
  const block = findTables(wikitext).find((t) => /Use\(s\)/i.test(t));
  if (!block) throw new Error('No equipment table on Slayer equipment');
  const out: RawEquipment[] = [];
  // "Item" spans two columns, but most rows fill it with one {{plinkt}} cell,
  // so read by position: level, item cell(s), cost, uses.
  for (const cells of parseTable(block).rows) {
    // The linked page, not the text: "{{plinkp|Lit bug lantern}}||[[Unlit bug lantern]]".
    const name = cells
      .slice(1, -2)
      .map((c) => c.match(/\{\{\s*plink[pt]?\s*\|([^|}]+)/i)?.[1].trim() ?? linkTargets(c)[0])
      .find(Boolean);
    if (!name) continue;
    for (const line of (cells.at(-1) ?? '').split('\n')) {
      const text = line.replace(/^\s*\*\s*/, '');
      const use = wikiPlain(text);
      if (MONSTER_USE.test(use)) out.push({ item: name, use, links: linkTargets(text) });
    }
  }
  return out;
}
