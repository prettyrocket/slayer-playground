import type { Monster, MonsterLocation } from '../../src/data/types.ts';
import {
  column,
  findTables,
  linkTargets,
  parseTable,
  splitTopLevel,
  wikiPlain,
} from './wikitext.ts';

/** A place from a monster page's {{LocLine}}, with its spawns as "x,y" keys. */
export interface RawLocation {
  name: string;
  page: string | null;
  spawns: Set<string>;
}

/** A row of a Slayer task/ page's locations table. */
export interface TaskLocation {
  name: string;
  spawns: Set<string>;
  multicombat: boolean | null;
  cannon: boolean | null;
  safespot: boolean | null;
}

/** "[[Abyssal Area]] ({{Fairycode|alr}})" -> "Abyssal Area": templates that render nothing leave "()". */
const placeName = (wikitext: string) =>
  wikiPlain(wikitext)
    .replace(/\(\s*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Each `{{name ...}}` on a page, as its top-level parts (the name first), nested templates whole. */
function templates(wikitext: string, name: string): string[][] {
  const out: string[][] = [];
  const open = new RegExp(`\\{\\{\\s*${name}\\s*[|}]`, 'gi');
  for (const match of wikitext.matchAll(open)) {
    let depth = 0;
    for (let i = match.index; i < wikitext.length - 1; i++) {
      const pair = wikitext.slice(i, i + 2);
      if (pair === '{{') depth++;
      else if (pair === '}}') depth--;
      else continue;
      i++;
      if (depth === 0) {
        out.push(splitTopLevel(wikitext.slice(match.index + 2, i - 1), '|').map((p) => p.trim()));
        break;
      }
    }
  }
  return out;
}

/** `location = [[Slayer Tower]]` -> location: "[[Slayer Tower]]": the named parameters of a template's parts. */
function params(parts: string[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const part of parts) {
    const match = /^([a-z_ ]+?)\s*=\s*([\s\S]*)$/i.exec(part);
    if (match) out.set(match[1].trim().toLowerCase(), match[2].trim());
  }
  return out;
}

/**
 * Spawn coordinates as "x,y". LocLine writes `x:3025,y:4916`; the task pages'
 * {{Map}} writes `3025,4916`, `1629,10071,title:Brutal blue dragon` or
 * `x:1240,y:9503,title:...`. The plane is left out: pages give it in different
 * ways, and the same x and y on two floors are rare enough not to matter.
 */
function spawnKeys(parts: string[]): Set<string> {
  const keys = new Set<string>();
  for (const part of parts) {
    const match = /^(?:x:)?(\d+),\s*(?:y:)?(\d+)(?:,|$)/.exec(part);
    if (match) keys.add(`${match[1]},${match[2]}`);
  }
  return keys;
}

/** The places on a monster page, one per {{LocLine}}; repeats of a place merge. */
export function parseLocLines(wikitext: string): RawLocation[] {
  const byName = new Map<string, RawLocation>();
  for (const parts of templates(wikitext, 'LocLine')) {
    const location = params(parts).get('location');
    if (!location) continue;
    const name = placeName(location);
    const known = byName.get(name);
    const spawns = spawnKeys(parts);
    if (known) {
      for (const key of spawns) known.spawns.add(key);
    } else {
      byName.set(name, { name, page: linkTargets(location)[0] ?? null, spawns });
    }
  }
  return [...byName.values()];
}

/** "{{Yes}}" -> true, "{{No}}" -> false, anything else ("Partial", blank) -> null. */
function yesNo(wikitext: string): boolean | null {
  const text = wikiPlain(wikitext).toLowerCase();
  if (text.startsWith('yes')) return true;
  if (text.startsWith('no')) return false;
  return null;
}

/** The rows of a Slayer task/ page's locations table: the one with a Cannonable column. */
export function parseTaskLocations(wikitext: string): TaskLocation[] {
  for (const raw of findTables(wikitext)) {
    const table = parseTable(raw);
    const [location, map, multi, cannon, safespot] = [
      column(table, 'location'),
      column(table, 'map'),
      column(table, 'multi'),
      column(table, 'cannon'),
      column(table, 'safespot'),
    ];
    if (cannon < 0 || location < 0) continue;
    return table.rows.map((row) => ({
      name: placeName(row[location] ?? ''),
      spawns: new Set(
        map < 0 ? [] : templates(row[map] ?? '', 'Map').flatMap((parts) => [...spawnKeys(parts)]),
      ),
      multicombat: multi < 0 ? null : yesNo(row[multi] ?? ''),
      cannon: yesNo(row[cannon] ?? ''),
      safespot: safespot < 0 ? null : yesNo(row[safespot] ?? ''),
    }));
  }
  return [];
}

/**
 * Sets each monster's `locations` from its page's LocLines (`monsterText`,
 * by page), with multicombat, cannon and safespot from the task pages' rows
 * (`taskText`, by page) that shares the most spawns with it. Returns places
 * where rows tie with different answers, for the sync log.
 */
export function addLocations(
  monsters: Monster[],
  monsterText: Map<string, string | null>,
  taskText: Map<string, string | null>,
): string[] {
  const warnings: string[] = [];
  const rows = [...taskText.values()].flatMap((text) => (text ? parseTaskLocations(text) : []));
  for (const monster of monsters) {
    monster.locations = parseLocLines(monsterText.get(monster.page) ?? '')
      .map(({ name, page, spawns }): MonsterLocation => {
        // The row sharing the most spawns: floors of a building can share an x and y.
        const shared = rows.map((row) => [...spawns].filter((key) => row.spawns.has(key)).length);
        const best = Math.max(0, ...shared);
        const matches = best === 0 ? [] : rows.filter((_, i) => shared[i] === best);
        const answers = new Set(matches.map((m) => `${m.multicombat}/${m.cannon}/${m.safespot}`));
        if (answers.size > 1) {
          warnings.push(
            `${monster.page}, ${name}: task pages disagree (${[...answers].join(' vs ')})`,
          );
        }
        const [match] = matches;
        return {
          name,
          page,
          spawns: spawns.size || null,
          multicombat: match?.multicombat ?? null,
          cannon: match?.cannon ?? null,
          safespot: match?.safespot ?? null,
        };
      })
      .sort((a, b) => (b.spawns ?? 0) - (a.spawns ?? 0) || a.name.localeCompare(b.name, 'en'));
  }
  return warnings;
}
