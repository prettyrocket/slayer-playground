import type { MasterKey } from '../../src/data/types.ts';
import {
  amountRange,
  column,
  findTables,
  linkTargets,
  parseTable,
  skillRequirement,
  wikiPlain,
} from './wikitext.ts';

/**
 * Where each master's assignment table lives. Alternate masters (Aya, Achtryn,
 * Steve, Kuradal) transclude their main master's table, so they share a key.
 */
export const MASTER_PAGES: { key: MasterKey; name: string; page: string; alternates: string[] }[] =
  [
    { key: 'turael', name: 'Turael', page: 'Turael/Slayer assignments', alternates: ['Aya'] },
    { key: 'spria', name: 'Spria', page: 'Spria', alternates: [] },
    {
      key: 'mazchna',
      name: 'Mazchna',
      page: 'Mazchna/Slayer assignments',
      alternates: ['Achtryn'],
    },
    { key: 'vannaka', name: 'Vannaka', page: 'Vannaka', alternates: [] },
    { key: 'chaeldar', name: 'Chaeldar', page: 'Chaeldar', alternates: [] },
    { key: 'konar', name: 'Konar quo Maten', page: 'Konar quo Maten', alternates: [] },
    { key: 'nieve', name: 'Nieve', page: 'Nieve/Slayer assignments', alternates: ['Steve'] },
    {
      key: 'duradel',
      name: 'Duradel',
      page: 'Duradel/Slayer assignments',
      alternates: ['Kuradal'],
    },
    { key: 'krystilia', name: 'Krystilia', page: 'Krystilia', alternates: [] },
    { key: 'mortimer', name: 'Mortimer', page: 'Mortimer', alternates: [] },
  ];

/** One row of a master's table, before it is matched to a Slayer category. */
export interface RawAssignment {
  /** As the master's table writes it, e.g. "Aberrant spectres". */
  name: string;
  /** The row's first link, e.g. "Aberrant spectre" or "Slayer task/Crabs". */
  link: string | null;
  weight: number;
  amount: [number, number] | null;
  extended: [number, number] | null;
  slayerLevel: number | null;
  combatLevel: number | null;
  /** Plain-text requirements, from the requirement column or (Krystilia) the name's footnotes. */
  requirements: string | null;
  /** Monster pages the master lists as counting for the task. */
  alternatives: string[];
  /** Konar's possible locations, or Krystilia's location. */
  locations: string[];
  /** Krystilia only, e.g. "35-39". */
  wildernessLevels: string | null;
}

/** `{{+=|weight|8|echo=2}}` or a bare `8`. */
function weightOf(cell: string | undefined): number | null {
  const counted = cell?.match(/\{\{\s*\+=\s*\|\s*weight\s*\|\s*(\d+)/);
  if (counted) return Number(counted[1]);
  const bare = wikiPlain(cell ?? '');
  return /^\d+$/.test(bare) ? Number(bare) : null;
}

/**
 * The weighted table on a master's page: the first table that uses
 * `{{+=|weight|...}}`. Columns are found by header name, since every master's
 * columns differ. Throws when there is none, so a wiki restructure fails loudly.
 */
export function parseMasterTable(wikitext: string, page: string): RawAssignment[] {
  const block = findTables(wikitext).find((t) => /\{\{\s*\+=\s*\|\s*weight/.test(t));
  if (!block) throw new Error(`No weighted assignment table on ${page}`);
  const table = parseTable(block);

  const col = {
    amount: column(table, 'amount'),
    extended: column(table, 'extend'),
    requirement: column(table, 'requirement'),
    alternatives: table.headers.findIndex((h) => h === 'alternative(s)'),
    // Not Turael's "Location (Slayer Point Farming)", which is advice.
    locations: table.headers.findIndex((h) => h === 'possible locations' || h === 'location'),
    wilderness: column(table, 'wilderness level'),
    weight: column(table, 'weight'),
  };
  if (col.amount < 0 || col.weight < 0) {
    throw new Error(`Unexpected columns on ${page}: ${table.headers.join(' | ')}`);
  }

  const out: RawAssignment[] = [];
  for (const [i, cells] of table.rows.entries()) {
    const weight = weightOf(cells[col.weight]);
    if (weight === null) continue;
    const place = col.locations >= 0 ? locationCell(cells[col.locations] ?? '') : null;
    // Krystilia's boss task spans one row per boss; they all belong to the first.
    if (table.spanned[i][col.weight]) {
      const first = out.at(-1)!;
      first.alternatives = [...new Set([...first.alternatives, ...(place?.monsters ?? [])])];
      first.locations = [...new Set([...first.locations, ...(place?.locations ?? [])])];
      continue;
    }
    const nameCell = cells[0] ?? '';
    // Krystilia keeps requirements in footnotes on the name.
    const requirementSource =
      col.requirement >= 0 ? (cells[col.requirement] ?? '') : refText(nameCell);
    const requirements = wikiPlain(requirementSource);
    out.push({
      name: wikiPlain(nameCell),
      link: linkTargets(nameCell)[0] ?? null,
      weight,
      amount: amountRange(cells[col.amount] ?? ''),
      extended: col.extended >= 0 ? amountRange(cells[col.extended] ?? '') : null,
      slayerLevel: skillRequirement(requirementSource, 'Slayer'),
      combatLevel: skillRequirement(requirementSource, 'Combat'),
      requirements: requirements === '' || /^none$/i.test(requirements) ? null : requirements,
      alternatives:
        col.alternatives >= 0
          ? alternativeLinks(cells[col.alternatives] ?? '')
          : (place?.monsters ?? []),
      locations: place?.locations ?? [],
      // Only the task's own level range, not each boss's.
      wildernessLevels:
        col.wilderness >= 0 && !table.spanned[i + 1]?.[col.weight]
          ? wikiPlain(cells[col.wilderness] ?? '') || null
          : null,
    });
  }
  return out;
}

/**
 * A location cell: bullets or comma-separated links. Krystilia's boss rows
 * read "[[Callisto]]<ref>[[Artio]] also counts.</ref>: South of the [[Demonic Ruins]]",
 * where the part before the colon (and any "also counts" note) is a monster.
 */
function locationCell(cell: string): { locations: string[]; monsters: string[] } {
  const locations: string[] = [];
  const monsters: string[] = [];
  for (const line of cell.split('\n')) {
    const refs = refText(line);
    const main = line.replace(/<ref[^>/]*>[\s\S]*?<\/ref>/gi, '');
    const colon = main.search(/\]\]\s*:/);
    if (colon >= 0) {
      const split = main.indexOf(':', colon);
      monsters.push(...linkTargets(main.slice(0, split)));
      locations.push(...linkTargets(main.slice(split + 1)));
      if (/also counts/i.test(refs)) monsters.push(...linkTargets(refs));
    } else {
      locations.push(...linkTargets(main));
    }
  }
  return { locations: [...new Set(locations)], monsters: [...new Set(monsters)] };
}

/** The text of a cell's `<ref>` footnotes, joined. */
function refText(cell: string): string {
  return [...cell.matchAll(/<ref[^>/]*>([\s\S]*?)<\/ref>/gi)].map((m) => m[1]).join('\n');
}

/**
 * Konar writes alternatives as "*[[Catacombs of Kourend]]: [[Deviant spectre]]",
 * so for each line keep only the links after a location prefix.
 */
function alternativeLinks(cell: string): string[] {
  return [
    ...new Set(
      cell.split('\n').flatMap((line) => {
        const colon = line.search(/\]\]\s*:/);
        return linkTargets(colon >= 0 ? line.slice(line.indexOf(':', colon) + 1) : line);
      }),
    ),
  ];
}
