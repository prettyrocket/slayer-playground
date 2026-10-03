import type { Drop } from '../../src/data/types.ts';
import { itemName } from './normalize.ts';
import { splitTopLevel } from './wikitext.ts';

/**
 * The wiki's own drop tables — "100%", "Herbs", "Rare and Gem drop table",
 * "Tertiary", … — as better-monster-examine shows them. Bucket's dropsline
 * rows carry no section, so the sections come from the page's wikitext: its
 * drops headings and the `{{DropsLine}}`s under them.
 *
 * Headings nest two ways, as in better-monster-examine: a `===` heading with
 * `====`s under it is a group (a location or combat level, "Wilderness Slayer
 * Cave") and the `====`s are its sections; a `===` with none under it is
 * itself a section. A drops `==` heading other than plain "Drops" ("Level 99
 * drops") is a group too. Like-named sections in different groups stay apart:
 * they're different tables with different rates.
 */
export interface DropSection {
  group: string | null;
  section: string;
  /** Items its `{{DropsLine}}`s name, in order, with the drop version each is for. */
  lines: { item: string; version: string | null }[];
  /**
   * Tables its templates expand to (`{{HerbDropTable}}`, `{{RareDropTable}}`):
   * their rows are in Bucket but not in the wikitext.
   */
  tables: { template: string; version: string | null }[];
}

interface Heading {
  kind: 'heading';
  level: number;
  text: string;
}
interface Template {
  kind: 'template';
  name: string;
  params: Record<string, string>;
}

/** Headings and top-level templates, in page order. */
function tokens(wikitext: string): (Heading | Template)[] {
  const text = wikitext.replace(/<!--[\s\S]*?-->/g, '');
  const out: (Heading | Template)[] = [];
  let i = 0;
  while (i < text.length) {
    const lineStart = i === 0 || text[i - 1] === '\n';
    if (lineStart && text[i] === '=') {
      const end = text.indexOf('\n', i);
      const line = text.slice(i, end < 0 ? text.length : end).trim();
      const m = line.match(/^(={2,6})\s*(.+?)\s*\1$/);
      if (m) {
        out.push({ kind: 'heading', level: m[1].length, text: m[2].replace(/'''?/g, '') });
        i = end < 0 ? text.length : end + 1;
        continue;
      }
    }
    if (text.startsWith('{{', i)) {
      let depth = 0;
      let j = i;
      for (; j < text.length; j++) {
        if (text.startsWith('{{', j)) {
          depth++;
          j++;
        } else if (text.startsWith('}}', j)) {
          depth--;
          j++;
          if (depth === 0) break;
        }
      }
      const [name, ...args] = splitTopLevel(text.slice(i + 2, j - 1), '|');
      const params: Record<string, string> = {};
      args.forEach((arg, n) => {
        const eq = arg.indexOf('=');
        if (eq < 0) params[String(n + 1)] = arg.trim();
        else params[arg.slice(0, eq).trim().toLowerCase()] = arg.slice(eq + 1).trim();
      });
      out.push({ kind: 'template', name: name.trim().replace(/_/g, ' '), params });
      i = j + 1;
      continue;
    }
    i++;
  }
  return out;
}

/** A `{{DropsLine}}`-like template naming one drop: DropsLine, DropsLineReward, … */
const isLine = (t: Template) => /^DropsLine/i.test(t.name) && !!t.params.name;
const isClue = (t: Template) => /^DropsLineClue$/i.test(t.name) && !!t.params.type;
/** Templates that expand to rows the wikitext doesn't list: HerbDropLines, RareDropTable, … */
const expandsToDrops = (t: Template) => /(Drop(Table|Lines)|RDT)$/i.test(t.name);
const isDrop = (t: Template) => isClue(t) || isLine(t) || expandsToDrops(t);

/** The drop tables in a page's drops regions, in page order; empty when it has none. */
export function parseDropSections(wikitext: string): DropSection[] {
  const all = tokens(wikitext);
  const sections: DropSection[] = [];
  // Drops above the first == heading count too (Deadman breach monsters have only a table there).
  const firstHeading = all.findIndex((t) => t.kind === 'heading' && t.level === 2);
  let inDrops = all
    .slice(0, firstHeading < 0 ? undefined : firstHeading)
    .some((t) => t.kind === 'template' && isDrop(t));
  let region: string | null = null;
  let level3: string | null = null;
  // Whether the current === heading has ==== headings under it, so is a group.
  let level3IsGroup = false;
  let current: DropSection | null = null;
  // The drop version the last {{DropsTableHead}} under this heading set.
  let version: string | null = null;

  const open = (group: string | null, section: string) => {
    current = { group, section, lines: [], tables: [] };
    sections.push(current);
  };
  const join = (...labels: (string | null)[]) => labels.filter(Boolean).join(' – ') || null;

  all.forEach((token, n) => {
    if (token.kind === 'heading') {
      version = null;
      if (token.level === 2) {
        // Any == section with drops in it: "Drops", "Level 99 drops", "Levels 81–100", "Rewards".
        const end = all.findIndex((t, i) => i > n && t.kind === 'heading' && t.level === 2);
        inDrops = all
          .slice(n + 1, end < 0 ? undefined : end)
          .some((t) => t.kind === 'template' && isDrop(t));
        region = inDrops && !/^drops$/i.test(token.text) ? token.text : null;
        level3 = null;
        current = null;
        return;
      }
      if (!inDrops) return;
      if (token.level === 3) {
        const next = all.slice(n + 1).find((t) => t.kind === 'heading');
        level3IsGroup = next?.kind === 'heading' && next.level > 3;
        level3 = token.text;
        if (level3IsGroup) current = null;
        else open(region, token.text);
        return;
      }
      open(join(region, level3IsGroup ? level3 : null), token.text);
      return;
    }
    if (!inDrops) return;
    if (/^DropsTableHead$/i.test(token.name)) {
      version = token.params.dropversion || null;
      return;
    }
    if (!isDrop(token)) return;
    // Drops before any table heading (a page with just "==Drops==") get one of their own.
    if (!current) open(region, 'Drops');
    const section = current as unknown as DropSection;
    const forVersion = token.params.dropversion || version;
    if (isClue(token)) {
      section.lines.push({ item: `Clue scroll (${token.params.type})`, version: forVersion });
    } else if (isLine(token)) {
      section.lines.push({ item: itemName(token.params.name), version: forVersion });
    } else {
      section.tables.push({ template: token.name, version: forVersion });
    }
  });
  return sections.filter((s) => s.lines.length > 0 || s.tables.length > 0);
}

// Which expanded table an item most likely came from, when two sit side by side.
const TABLE_HINTS: [RegExp, RegExp][] = [
  [/herb/i, /^grimy |herb/i],
  [/seed/i, / seed$|seed/i],
  [/gem|rare/i, /^uncut |half of key|^dragonstone|^shield left half|^dragon spear/i],
  [/talisman/i, /talisman$/i],
];

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const forVersion = (version: string | null, v: string | null) =>
  version === null || v === null || version === v;

/**
 * Tag drops (in Bucket's order) with their group and section, and put them in
 * the page's order. Bucket keeps each drop version's rows in page order, with a
 * table template's rows where the template sits, so the rows are walked
 * alongside the wikitext's `{{DropsLine}}`s: a row matching the next line is
 * that line; a row between two lines is from the table template between them.
 * Drops it can't place keep a null section and go last, grouped by version.
 */
export function addDropSections(drops: Drop[], sections: DropSection[]): Drop[] {
  if (sections.length === 0) return fallbackOrder(drops);
  const placed = new Map<Drop, number>();

  const versions = [...new Set(drops.map((d) => d.dropVersion))];
  for (const v of versions) {
    const rows = drops.filter((d) => d.dropVersion === v);
    // Lines no row matches ("Nothing") would hold the walk up.
    const lines = sections.flatMap((s, i) =>
      s.lines
        .filter((l) => forVersion(l.version, v) && rows.some((d) => same(d.item, l.item)))
        .map((l) => ({ ...l, at: i })),
    );
    const tableAt = sections.flatMap((s, i) =>
      s.tables.filter((t) => forVersion(t.version, v)).map((t) => ({ ...t, at: i })),
    );
    let next = 0;
    for (const drop of rows) {
      if (next < lines.length && same(lines[next].item, drop.item)) {
        placed.set(drop, lines[next++].at);
        continue;
      }
      // A table template between the last line and the next one.
      const from = next > 0 ? lines[next - 1].at : 0;
      const to = next < lines.length ? lines[next].at : sections.length - 1;
      const between = tableAt.filter((t) => t.at >= from && t.at <= to);
      if (between.length > 0) {
        const hinted = between.find((t) =>
          TABLE_HINTS.some(([table, item]) => table.test(t.template) && item.test(drop.item)),
        );
        placed.set(drop, (hinted ?? between[0]).at);
        continue;
      }
      // A line Bucket skipped: jump ahead to where this item is.
      const ahead = lines.findIndex((l, i) => i > next && same(l.item, drop.item));
      if (ahead >= 0) {
        next = ahead + 1;
        placed.set(drop, lines[ahead].at);
      }
    }
  }

  const tagged = drops.map((drop, i) => {
    const at = placed.get(drop);
    const s = at === undefined ? null : sections[at];
    return {
      drop: { ...drop, group: s?.group ?? null, section: s?.section ?? null },
      key: at ?? sections.length,
      i,
    };
  });
  const sectioned = tagged.filter((t) => t.key < sections.length);
  const rest = fallbackOrder(tagged.filter((t) => t.key === sections.length).map((t) => t.drop));
  return [...sectioned.sort((a, b) => a.key - b.key || a.i - b.i).map((t) => t.drop), ...rest];
}

/** Without sections: drop version, then most common first, then item. */
function fallbackOrder(drops: Drop[]): Drop[] {
  return drops
    .map((d) => ({ ...d, group: d.group ?? null, section: d.section ?? null }))
    .sort(
      (a, b) =>
        (a.dropVersion ?? '').localeCompare(b.dropVersion ?? '') ||
        (b.chance ?? -1) - (a.chance ?? -1) ||
        a.item.localeCompare(b.item) ||
        (a.quantity?.[0] ?? -1) - (b.quantity?.[0] ?? -1),
    );
}
