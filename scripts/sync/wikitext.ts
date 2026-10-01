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
    // A leading colon ([[:Category:X]]) links a page instead of filing this one.
    .map((m) => m[1].trim().replace(/^:/, '').replace(/_/g, ' '))
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
  // An escaped pipe.
  '!': () => '|',
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
      const [name, ...args] = splitTopLevel(body, '|').map((part) => part.trim());
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
export function splitTopLevel(text: string, separator: string): string[] {
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
 * that is only `{{NA|rowspan=7}}` also spans: that template renders attributes.
 */
function cell(raw: string): Cell {
  const [first, ...rest] = splitTopLevel(raw, '|');
  const hasAttributes = rest.length > 0 && (first.trim() === '' || first.includes('='));
  const text = (hasAttributes ? rest.join('|') : raw).trim();
  const attrs = `${hasAttributes ? first : ''} ${/^\{\{\s*NA\b[^{}]*\}\}$/i.test(text) ? text : ''}`;
  const span = (name: string) =>
    Number(attrs.match(new RegExp(`${name}\\s*=\\s*"?(\\d+)`))?.[1] ?? 1);
  return { text, rowspan: span('rowspan'), colspan: span('colspan') };
}

/**
 * Net `{{`/`}}` depth change of a line, to keep multi-line templates in one
 * cell. Braces in comments and <nowiki> don't count.
 */
const braceDelta = (line: string) => {
  const code = line.replace(/<!--.*?-->/g, '').replace(/<nowiki>.*?<\/nowiki>/gi, '');
  return (code.match(/\{\{/g)?.length ?? 0) - (code.match(/\}\}/g)?.length ?? 0);
};

/** A row's cells: `|a||b`, or `!a!!b` (header cells may also be split by `||`). */
const cellsOf = (line: string) =>
  line.startsWith('!')
    ? splitTopLevel(line.slice(1), '!!').flatMap((part) => splitTopLevel(part, '||'))
    : splitTopLevel(line.slice(1), '||');

/**
 * Parse one table into headers and a grid of cells. The header is the leading
 * rows made only of `!` cells (several header rows join per column, e.g.
 * "amount extended"). Later rows made only of `!` cells (a "Total" footer) are
 * dropped; a `!` cell in a data row is a row header and kept as data. Lines
 * that don't start a cell, lines inside an open template and nested tables
 * continue the previous cell.
 */
export function parseTable(table: string): WikiTable {
  const rawRows: { cells: Cell[]; headerOnly: boolean }[] = [];
  let row: { cells: Cell[]; headerOnly: boolean } | null = null;
  let current: Cell | null = null;
  let open = 0;
  let nested = 0;

  for (const line of table.split('\n').slice(1)) {
    const trimmed = line.trimStart();
    if (current && (open > 0 || nested > 0 || trimmed.startsWith('{|'))) {
      current.text += `\n${line}`;
      open = Math.max(0, open + braceDelta(line));
      if (trimmed.startsWith('{|')) nested++;
      else if (trimmed.startsWith('|}') && nested > 0) nested--;
      continue;
    }
    if (trimmed.startsWith('|}')) break;
    if (trimmed.startsWith('|+')) continue;
    if (trimmed.startsWith('|-')) {
      row = null;
      current = null;
      continue;
    }
    if (trimmed.startsWith('!') || trimmed.startsWith('|')) {
      const header = trimmed.startsWith('!');
      if (!row) {
        row = { cells: [], headerOnly: true };
        rawRows.push(row);
      }
      if (!header) row.headerOnly = false;
      for (const raw of cellsOf(trimmed)) {
        current = cell(raw);
        row.cells.push(current);
      }
      open = Math.max(0, braceDelta(trimmed));
      continue;
    }
    if (current) {
      current.text += `\n${line}`;
      open = Math.max(0, open + braceDelta(line));
    }
  }
  if (open > 0 || nested > 0) throw new Error('Table ends inside an unclosed template or table');

  // Lay the cells out on a grid, carrying rowspans down.
  const rows: string[][] = [];
  const spanned: boolean[][] = [];
  const carried: { text: string; left: number }[] = [];
  const carryingFrom = (col: number) => carried.slice(col).some((c) => c && c.left > 0);
  for (const { cells } of rawRows) {
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

  const headerRows = rawRows.findIndex((r) => !r.headerOnly);
  const head = headerRows < 0 ? rows.length : headerRows;
  const width = Math.max(0, ...rows.slice(0, head).map((r) => r.length));
  const headers = Array.from({ length: width }, (_, col) =>
    [...new Set(rows.slice(0, head).map((r) => r[col]))]
      .map((text) => wikiPlain(text ?? '').replace(/\s+/g, ' '))
      .filter(Boolean)
      .join(' ')
      .toLowerCase(),
  );
  const data = rawRows.map((r, i) => (i >= head && !r.headerOnly ? i : -1)).filter((i) => i >= 0);
  return {
    headers,
    rows: data.map((i) => rows[i]),
    spanned: data.map((i) => spanned[i]),
  };
}

/** The column whose header contains any of `names`, or -1. */
export function column(table: WikiTable, ...names: string[]): number {
  return table.headers.findIndex((h) => names.some((n) => h.includes(n)));
}
