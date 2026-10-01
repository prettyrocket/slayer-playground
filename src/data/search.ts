import type { Catalog, Category } from '@/data/catalog';
import type { Monster } from '@/data/types';

/** A category that matched a search, and why when it wasn't by name. */
export interface SearchResult {
  category: Category;
  /** The alias that matched, when the name didn't, e.g. "kalphites". */
  alias: string | null;
  /** The monsters that matched, when neither name nor alias did, e.g. Vorkath for blue dragons. */
  monsters: Monster[];
}

/** Lowercase words without accents or punctuation: "Kree'arra" -> ["kreearra"]. */
export function words(text: string): string[] {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** Every query word starts some word of `text`, so "abys dem" matches "Abyssal demons". */
function matches(query: string[], text: string): boolean {
  const target = words(text);
  return query.every((q) => target.some((word) => word.startsWith(q)));
}

/**
 * Categories matching `query` by name, then by alias, then by the name of a
 * monster that counts for them; alphabetical within each. An empty query
 * lists every category.
 */
export function searchCategories(catalog: Catalog, query: string): SearchResult[] {
  const q = words(query);
  if (q.length === 0) {
    return catalog.categories.map((category) => ({ category, alias: null, monsters: [] }));
  }

  const ranked: { rank: number; result: SearchResult }[] = [];
  for (const category of catalog.categories) {
    if (matches(q, category.name)) {
      // A name that starts with the query ranks above one that only contains it.
      const rank = words(category.name).join(' ').startsWith(q.join(' ')) ? 0 : 1;
      ranked.push({ rank, result: { category, alias: null, monsters: [] } });
      continue;
    }
    const alias = category.aliases.find((a) => matches(q, a));
    if (alias) {
      ranked.push({ rank: 2, result: { category, alias, monsters: [] } });
      continue;
    }
    const monsters = category.monsters.filter((m) => matches(q, m.page));
    if (monsters.length > 0) ranked.push({ rank: 3, result: { category, alias: null, monsters } });
  }
  // Categories come sorted by name, and sort is stable, so ties stay alphabetical.
  return ranked.sort((a, b) => a.rank - b.rank).map(({ result }) => result);
}
