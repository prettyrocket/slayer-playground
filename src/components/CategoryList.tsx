import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';

import { Link } from 'react-router';

import { CatalogStatus } from '@/components/CatalogStatus';
import { useCatalog } from '@/data/catalog';
import { categoryPath } from '@/routing/paths';

/** Every category whose name contains `query`. Name match only; #11 adds monster names and aliases. */
export function CategoryList({ query }: { query: string }) {
  const { data: catalog } = useCatalog();
  if (!catalog) return <CatalogStatus />;

  const needle = query.trim().toLowerCase();
  const categories = catalog.categories.filter((c) => c.name.toLowerCase().includes(needle));

  if (categories.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ mt: 2 }}>
        No categories match &ldquo;{query}&rdquo;.
      </Typography>
    );
  }

  return (
    <List aria-label="Categories">
      {categories.map((category) => (
        <ListItem key={category.slug} disablePadding>
          <ListItemButton component={Link} to={categoryPath(category.slug)}>
            <ListItemText primary={category.name} />
          </ListItemButton>
        </ListItem>
      ))}
    </List>
  );
}
