/**
 * URLs for the app's pages. How the user got to a page rides along in the query
 * string, so the breadcrumb can show it: `?master=` for the master a task came
 * from, and `?category=` for the category a monster was chosen for (a monster
 * can be in several).
 */

function withQuery(path: string, params: Record<string, string | null | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) query.set(key, value);
  const search = query.toString();
  return search ? `${path}?${search}` : path;
}

export function categoryPath(slug: string, master?: string | null): string {
  return withQuery(`/categories/${slug}`, { master });
}

export function monsterPath(
  slug: string,
  category?: string | null,
  master?: string | null,
): string {
  return withQuery(`/monsters/${slug}`, { category, master });
}

export function masterPath(key: string): string {
  return `/masters/${key}`;
}
