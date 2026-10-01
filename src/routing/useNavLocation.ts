import { matchPath, useLocation } from 'react-router';

import { type Category, categorySlug, findCategory, findMonster, useCatalog } from '@/data/catalog';
import { type Master, getMaster } from '@/data/masters';
import type { Monster } from '@/data/types';

/**
 * Where the current page sits in the app, as a trail: its section, then the
 * master, category and monster on the way to it. A category or monster page
 * reached from a master (`?master=`) is on that master's trail, as long as the
 * master assigns the category. Categories and monsters are undefined until the
 * catalog loads.
 */
export interface NavLocation {
  section: 'categories' | 'masters' | null;
  category?: Category;
  master?: Master;
  monster?: Monster;
}

export function useNavLocation(): NavLocation {
  const { pathname, search } = useLocation();
  const { data: catalog } = useCatalog();
  const params = new URLSearchParams(search);

  function trail(category: Category | undefined, monster?: Monster): NavLocation {
    const master = getMaster(params.get('master'));
    const onTrail = master && category?.masters.includes(master.key);
    return {
      section: onTrail ? 'masters' : 'categories',
      master: onTrail ? master : undefined,
      category,
      monster,
    };
  }

  const categoryParam = (
    matchPath('/categories/:slug', pathname) ?? matchPath('/categories/:slug/locations', pathname)
  )?.params.slug;
  if (categoryParam) return trail(findCategory(catalog, categoryParam));

  // A monster lives under the category it was chosen for, else its first one.
  const monsterSlug = matchPath('/monsters/:slug', pathname)?.params.slug;
  if (monsterSlug) {
    const monster = findMonster(catalog, monsterSlug);
    const slugs = monster?.categories.map(categorySlug) ?? [];
    const slug = slugs.find((s) => s === params.get('category')) ?? slugs[0];
    return trail(findCategory(catalog, slug), monster);
  }

  const masterKey = matchPath('/masters/:slug', pathname)?.params.slug;
  if (masterKey) return { section: 'masters', master: getMaster(masterKey) };

  if (matchPath('/categories', pathname)) return { section: 'categories' };
  if (matchPath('/masters', pathname)) return { section: 'masters' };
  return { section: null };
}
