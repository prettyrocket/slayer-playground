import { plainText } from './normalize.ts';

/**
 * Helpers for page wikitext (master tables, Slayer Rewards, superiors, ...).
 * Unlike Bucket values, wikitext is unexpanded, so templates are still
 * `{{...}}` and are either rendered here or dropped.
 */

/** `{{SCP|Slayer|85}}` -> 85; null when the page gives no such requirement. */
export function skillRequirement(wikitext: string, skill: string): number | null {
  const match = wikitext.match(
    new RegExp(`\\{\\{\\s*SCP\\s*\\|\\s*${skill}\\s*\\|\\s*(\\d+)`, 'i'),
  );
  return match ? Number(match[1]) : null;
}

/**
 * Link targets in order, without anchors or duplicates: `[[Abyssal demon]]s,
 * [[Slayer task/Crabs|Crabs]]` -> ["Abyssal demon", "Slayer task/Crabs"].
 * Files and categories are skipped.
 */
export function linkTargets(wikitext: string): string[] {
  const targets = [...stripRefs(wikitext).matchAll(/\[\[([^\]|#]*)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g)]
    .map((m) => m[1].trim().replace(/_/g, ' '))
    .filter((t) => t && !/^(file|image|category):/i.test(t))
    .map((t) => t[0].toUpperCase() + t.slice(1));
  return [...new Set(targets)];
}

/** "40-90" -> [40, 90], "50" -> [50, 50]; null for "{{NA}}", blanks and anything else. */
export function amountRange(wikitext: string): [number, number] | null {
  const text = wikiPlain(wikitext).replace(/,/g, '');
  const range = text.match(/^(\d+)\s*-\s*(\d+)$/);
  if (range) return [Number(range[1]), Number(range[2])];
  const single = text.match(/^(\d+)$/);
  return single ? [Number(single[1]), Number(single[1])] : null;
}

function stripRefs(wikitext: string): string {
  return wikitext
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<ref[^>/]*\/>/gi, '')
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '');
}

// Templates whose text is worth keeping; every other template is dropped.
const RENDER: Record<string, (args: string[]) => string> = {
  scp: ([skill, level]) => (level ? `${level} ${skill}` : (skill ?? '')),
  yes: ([text]) => text ?? 'Yes',
  no: ([text]) => text ?? 'No',
  floornumber: (args) => {
    const uk = args.find((a) => a.startsWith('uk='))?.slice(3);
    return uk ? `floor ${uk}` : '';
  },
  plink: ([page, ...rest]) => rest.find((a) => a.startsWith('txt='))?.slice(4) ?? page ?? '',
  plinkt: ([page, ...rest]) => rest.find((a) => a.startsWith('txt='))?.slice(4) ?? page ?? '',
  plinkp: () => '',
};

/**
 * Plain text from wikitext: comments, refs, files and unknown templates go,
 * known templates render (`{{SCP|Slayer|85}}` -> "85 Slayer"), links become
 * their text, then `plainText` handles tags, quotes and entities.
 */
export function wikiPlain(wikitext: string): string {
  let text = stripRefs(wikitext).replace(/\[\[(?:File|Image):[^\]]*\]\]/gi, '');
  // Innermost templates first, so nested ones collapse outwards.
  for (let prev = ''; prev !== text;) {
    prev = text;
    text = text.replace(/\{\{([^{}]*)\}\}/g, (_, body: string) => {
      const [name, ...args] = body.split('|').map((part) => part.trim());
      return RENDER[name.toLowerCase().replace(/\s+/g, '')]?.(args) ?? '';
    });
  }
  // [[target]]s -> targets, as the wiki renders link trails.
  text = text.replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]([a-z]*)/g, '$1$2');
  // [https://example.com label] -> label
  text = text.replace(/\[https?:\/\/\S+\s+([^\]]*)\]/g, '$1');
  return plainText(text);
}

export interface WikiTable {
  /** Lowercased plain header text, e.g. "extended amt.". */
  headers: string[];
  /** Raw cell wikitext, with cell attributes removed and row/colspans filled in. */
  rows: string[][];
  /** Per cell: true when it was filled in from a rowspan above. */
  spanned: boolean[][];
}

/** Every `{| ... |}` table on a page, outermost only. */
export function findTables(wikitext: string): string[] {
  const tables: string[] = [];
  let depth = 0;
  let start = 0;
  const lines = wikitext.split('\n');
  let offset = 0;
  for (const line of lines) {
    const trimmed = line.trimStart();
    if (trimmed.startsWith('{|')) {
      if (depth === 0) start = offset;
      depth++;
    } else if (trimmed.startsWith('|}') && depth > 0) {
      depth--;
      if (depth === 0) tables.push(wikitext.slice(start, offset + line.length));
    }
    offset += line.length + 1;
  }
  return tables;
}

/**
 * Split `text` on `separator` outside `{{ }}` and `[[ ]]`, so `{{NA|None}}`
 * and `[[a|b]]` stay whole.
 */
function splitTopLevel(text: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let last = 0;
  for (let i = 0; i < text.length; i++) {
    const pair = text.slice(i, i + 2);
    if (pair === '{{' || pair === '[[') {
      depth++;
      i++;
    } else if ((pair === '}}' || pair === ']]') && depth > 0) {
      depth--;
      i++;
    } else if (depth === 0 && text.startsWith(separator, i)) {
      parts.push(text.slice(last, i));
      i += separator.length - 1;
      last = i + 1;
    }
  }
  parts.push(text.slice(last));
  return parts;
}

interface Cell {
  text: string;
  rowspan: number;
  colspan: number;
}

/**
 * `rowspan="2" |25` -> the attributes and "25"; `[[a|b]]` has none. A cell
 * that is only `{{NA|rowspan=7}}` also spans: the template renders attributes.
 */
function cell(raw: string): Cell {
  const [first, ...rest] = splitTopLevel(raw, '|');
  const hasAttributes = rest.length > 0 && (first.trim() === '' || first.includes('='));
  const text = (hasAttributes ? rest.join('|') : raw).trim();
  const attrs = `${hasAttributes ? first : ''} ${/^\{\{[^{}]*\}\}$/.test(text) ? text : ''}`;
  const span = (name: string) =>
    Number(attrs.match(new RegExp(`${name}\\s*=\\s*"?(\\d+)`))?.[1] ?? 1);
  return { text, rowspan: span('rowspan'), colspan: span('colspan') };
}

/** Net `{{`/`}}` depth change of a line, to keep multi-line templates in one cell. */
const braceDelta = (line: string) =>
  (line.match(/\{\{/g)?.length ?? 0) - (line.match(/\}\}/g)?.length ?? 0);

/**
 * Parse one table into headers and a grid of cells. Header rows are the `!`
 * rows before the first data row; `!` rows after it (a "Total" footer) are
 * skipped. Lines that don't start a cell, and lines inside an open template,
 * continue the previous cell.
 */
export function parseTable(table: string): WikiTable {
  const headers: string[] = [];
  const rawRows: Cell[][] = [];
  let row: Cell[] | null = null;
  let current: Cell | null = null;
  let open = 0;
  let footer = false;

  for (const line of table.split('\n').slice(1)) {
    const trimmed = line.trimStart();
    if (open > 0 && current) {
      current.text += `\n${line}`;
      open += braceDelta(line);
      continue;
    }
    if (trimmed.startsWith('|}')) break;
    if (trimmed.startsWith('|+')) continue;
    if (trimmed.startsWith('|-')) {
      row = null;
      current = null;
      footer = false;
      continue;
    }
    if (trimmed.startsWith('!')) {
      current = null;
      if (rawRows.length > 0) {
        footer = true;
        continue;
      }
      for (const h of splitTopLevel(trimmed.slice(1), '!!')) {
        const { text, colspan } = cell(h);
        for (let i = 0; i < colspan; i++) headers.push(wikiPlain(text).toLowerCase());
      }
      continue;
    }
    if (trimmed.startsWith('|')) {
      if (footer) continue;
      if (!row) {
        row = [];
        rawRows.push(row);
      }
      for (const raw of splitTopLevel(trimmed.slice(1), '||')) {
        current = cell(raw);
        row.push(current);
      }
      open = braceDelta(trimmed);
      continue;
    }
    if (current) {
      current.text += `\n${line}`;
      open += braceDelta(line);
    }
  }

  // Lay the cells out on a grid, carrying rowspans down.
  const rows: string[][] = [];
  const spanned: boolean[][] = [];
  const carried: { text: string; left: number }[] = [];
  const carryingFrom = (col: number) => carried.slice(col).some((c) => c && c.left > 0);
  for (const cells of rawRows) {
    const out: string[] = [];
    const fromAbove: boolean[] = [];
    const queue = [...cells];
    for (let col = 0; queue.length > 0 || carryingFrom(col); col++) {
      const carry = carried[col];
      if (carry && carry.left > 0) {
        out[col] = carry.text;
        fromAbove[col] = true;
        carry.left--;
        continue;
      }
      const next = queue.shift();
      if (!next) {
        // A short row with a rowspan further right: leave the gap empty.
        out[col] = '';
        fromAbove[col] = false;
        continue;
      }
      for (let i = 0; i < next.colspan; i++) {
        out[col + i] = next.text;
        fromAbove[col + i] = false;
        carried[col + i] = { text: next.text, left: next.rowspan - 1 };
      }
      col += next.colspan - 1;
    }
    rows.push(out);
    spanned.push(fromAbove);
  }
  return { headers, rows, spanned };
}

/** The column whose header contains any of `names`, or -1. */
export function column(table: WikiTable, ...names: string[]): number {
  return table.headers.findIndex((h) => names.some((n) => h.includes(n)));
}
