import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';

import { Link } from 'react-router';

import { CatalogStatus } from '@/components/CatalogStatus';
import { useCatalog } from '@/data/catalog';
import { type SearchResult, searchCategories } from '@/data/search';
import { categoryPath } from '@/routing/paths';

// How many matching monsters to name before "and N more".
const MONSTERS_SHOWN = 3;

/** Why a result matched, when not by name, then its Slayer level. */
function details({ category, alias, monsters }: SearchResult): string | null {
  const shown = monsters.slice(0, MONSTERS_SHOWN).map((m) => m.page);
  const more = monsters.length - shown.length;
  const reason = alias
    ? `Also called “${alias}”`
    : shown.length > 0
      ? `Includes ${shown.join(', ')}${more > 0 ? ` and ${more} more` : ''}`
      : null;
  const level = category.slayerLevel ? `Slayer ${category.slayerLevel}` : null;
  return [reason, level].filter(Boolean).join(' · ') || null;
}

/**
 * Every category matching `query` by name, alias or monster (see
 * searchCategories), with why it matched and its Slayer level.
 */
export function CategoryList({ query }: { query: string }) {
  const { data: catalog } = useCatalog();
  if (!catalog) return <CatalogStatus />;

  const results = searchCategories(catalog, query);
  if (results.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ mt: 2 }}>
        No categories match &ldquo;{query}&rdquo;.
      </Typography>
    );
  }

  return (
    <List aria-label="Categories">
      {results.map((result) => (
        <ListItem key={result.category.slug} disablePadding>
          <ListItemButton component={Link} to={categoryPath(result.category.slug)}>
            <ListItemText primary={result.category.name} secondary={details(result)} />
          </ListItemButton>
        </ListItem>
      ))}
    </List>
  );
}
