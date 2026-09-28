import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';

import { Link, useParams } from 'react-router';

import { CatalogStatus } from '@/components/CatalogStatus';
import { useCatalog } from '@/data/catalog';
import { getMaster } from '@/data/masters';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { categoryPath } from '@/routing/paths';

/** /masters/:slug — the categories this master assigns (#14 adds weights and amounts). */
export function MasterPage() {
  const { slug = '' } = useParams();
  const { data: catalog } = useCatalog();
  const master = getMaster(slug);
  if (!master) return <NotFoundPage />;

  return (
    <>
      <Typography variant="h4" component="h1" gutterBottom>
        {master.name}
      </Typography>
      {catalog ? (
        <List aria-label="Categories">
          {catalog.categories
            .filter((category) => category.masters.includes(master.key))
            .map((category) => (
              <ListItem key={category.slug} disablePadding>
                <ListItemButton component={Link} to={categoryPath(category.slug, master.key)}>
                  <ListItemText primary={category.name} />
                </ListItemButton>
              </ListItem>
            ))}
        </List>
      ) : (
        <CatalogStatus />
      )}
    </>
  );
}
