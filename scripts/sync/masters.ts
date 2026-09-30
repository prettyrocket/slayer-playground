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
  /** Monster pages the master says don't count (Krystilia: "The King Black Dragon ... do not count"). */
  excludes: string[];
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

// Every column header the master tables use today. Anything else is reported,
// so a renamed column shows up in the sync log instead of emptying a field.
const KNOWN_HEADERS = new Set([
  'monster',
  'amount',
  'extended amt.',
  'extended amount',
  'unlock requirement',
  'alternative(s)',
  'noteworthy alternative(s)',
  'location',
  'possible locations',
  'location (slayer point farming)',
  'combat level',
  'slayer exp',
  'wilderness level',
  'weight',
  'task weight',
  'quantity modifier',
  'points modifier',
  'clue scroll modifier',
  'clues dropped',
  'xp% modifier',
  'superior unique% modifier',
]);

/**
 * The weighted table on a master's page: the first table that uses
 * `{{+=|weight|...}}`. Columns are found by header name, since every master's
 * columns differ. Throws when there is none, so a wiki restructure fails
 * loudly; an unknown column goes to `warn`.
 */
export function parseMasterTable(
  wikitext: string,
  page: string,
  warn: (message: string) => void = () => {},
): RawAssignment[] {
  const block = findTables(wikitext).find((t) => /\{\{\s*\+=\s*\|\s*weight/.test(t));
  if (!block) throw new Error(`No weighted assignment table on ${page}`);
  const table = parseTable(block);
  const refs = namedRefs(wikitext);

  for (const header of new Set(table.headers)) {
    if (!KNOWN_HEADERS.has(header)) warn(`${page}: unknown column "${header}"`);
  }
  const col = {
    amount: column(table, 'amount'),
    extended: column(table, 'extend'),
    requirement: column(table, 'requirement'),
    // Turael's "Noteworthy alternative(s)" (bosses) count too.
    alternatives: table.headers.flatMap((h, i) => (h.endsWith('alternative(s)') ? [i] : [])),
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
    const place = col.locations >= 0 ? locationCell(cells[col.locations] ?? '', refs) : null;
    // Krystilia's boss task spans one row per boss; they all belong to the first.
    if (table.spanned[i][col.weight]) {
      const first = out.at(-1)!;
      first.alternatives = [...new Set([...first.alternatives, ...(place?.monsters ?? [])])];
      first.locations = [...new Set([...first.locations, ...(place?.locations ?? [])])];
      continue;
    }
    const nameCell = cells[0] ?? '';
    // Krystilia keeps requirements, and which monsters count, in footnotes on the name.
    const notes = footnotes(nameCell, refs);
    const counts = notes.filter((n) => /\balso counts?\b/i.test(n));
    const doesNot = notes.filter((n) => /\bnot\b[^.]*\bcount/i.test(n));
    const requirementSource =
      col.requirement >= 0
        ? (cells[col.requirement] ?? '')
        : notes.filter((n) => !counts.includes(n) && !doesNot.includes(n)).join('\n');
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
      alternatives: [
        ...new Set([
          ...col.alternatives.flatMap((c) => alternativeLinks(cells[c] ?? '')),
          ...(place?.monsters ?? []),
          ...counts.flatMap(linkTargets),
        ]),
      ],
      excludes: [...new Set(doesNot.flatMap(linkTargets))],
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

/** `<ref name="gwd">text</ref>` bodies on a page, by name, so later `<ref name="gwd" />` can reuse them. */
function namedRefs(wikitext: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const [, attrs, body] of wikitext.matchAll(/<ref\b([^>]*?)>([\s\S]*?)<\/ref>/gi)) {
    const name = refName(attrs);
    if (name && !out.has(name)) out.set(name, body);
  }
  return out;
}

function refName(attrs: string): string | null {
  const m = attrs.match(/\bname\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'/>]+))/i);
  return m ? (m[1] ?? m[2] ?? m[3]).trim() : null;
}

/** A cell's footnotes in order, with reused ones (`<ref name="x" />`) filled in from `refs`. */
function footnotes(cell: string, refs: Map<string, string>): string[] {
  return [...cell.matchAll(/<ref\b([^>]*?)(?:\/>|>([\s\S]*?)<\/ref>)/gi)]
    .map(([, attrs, body]) => body ?? refs.get(refName(attrs) ?? '') ?? '')
    .filter(Boolean);
}

/**
 * The text with top-level `(...)` asides removed, but not parentheses inside a
 * link: "Chaos Temple ([[Zombie pirate]]s)" -> "Chaos Temple ", while
 * "[[Ruins (east)|Eastern Ruins]]" stays whole.
 */
function withoutAsides(text: string): string {
  let out = '';
  let links = 0;
  let parens = 0;
  for (let i = 0; i < text.length; i++) {
    const pair = text.slice(i, i + 2);
    if (pair === '[[' || pair === '{{') links++;
    if ((pair === ']]' || pair === '}}') && links > 0) links--;
    if (links === 0 && text[i] === '(') parens++;
    if (parens === 0) out += text[i];
    if (links === 0 && text[i] === ')' && parens > 0) parens--;
  }
  return out;
}

/**
 * A location cell: bullets or comma-separated links. Krystilia's boss rows
 * read "[[Callisto]]<ref>[[Artio]] also counts.</ref>: South of the [[Demonic Ruins]]",
 * where the part before the colon (and any "also counts" note) is a monster.
 * Asides like "(''Bring a [[lockpick]]!'')" aren't locations.
 */
function locationCell(
  cell: string,
  refs: Map<string, string>,
): { locations: string[]; monsters: string[] } {
  const locations: string[] = [];
  const monsters: string[] = [];
  for (const line of cell.split('\n')) {
    const notes = footnotes(line, refs);
    const main = withoutAsides(line.replace(/<ref\b[^>]*?(?:\/>|>[\s\S]*?<\/ref>)/gi, ''));
    const colon = main.search(/\]\]\s*:/);
    if (colon >= 0) {
      const split = main.indexOf(':', colon);
      monsters.push(...linkTargets(main.slice(0, split)));
      locations.push(...linkTargets(main.slice(split + 1)));
      monsters.push(...notes.filter((n) => /\balso counts?\b/i.test(n)).flatMap(linkTargets));
    } else {
      locations.push(...linkTargets(main));
    }
  }
  return { locations: [...new Set(locations)], monsters: [...new Set(monsters)] };
}

/**
 * Konar writes alternatives as "*[[Catacombs of Kourend]]: [[Deviant spectre]]",
 * so for each line keep only the links after a location prefix, and skip
 * asides like "(completion of [[Bone Voyage]] required)".
 */
function alternativeLinks(cell: string): string[] {
  return [
    ...new Set(
      cell.split('\n').flatMap((line) => {
        const main = withoutAsides(line);
        const colon = main.search(/\]\]\s*:/);
        return linkTargets(colon >= 0 ? main.slice(main.indexOf(':', colon) + 1) : main);
      }),
    ),
  ];
}
