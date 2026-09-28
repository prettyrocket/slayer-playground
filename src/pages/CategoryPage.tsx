import Link from '@mui/material/Link';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { Link as RouterLink, useParams } from 'react-router';

import { CatalogStatus } from '@/components/CatalogStatus';
import { findCategory, useCatalog } from '@/data/catalog';
import { getMaster } from '@/data/masters';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { masterPath, monsterPath } from '@/routing/paths';
import { useNavLocation } from '@/routing/useNavLocation';

/** /categories/:slug — "I got this task": the monsters that count for it (#12 fills this in). */
export function CategoryPage() {
  const { slug = '' } = useParams();
  const { data: catalog } = useCatalog();
  const { master } = useNavLocation();
  if (!catalog) return <CatalogStatus />;
  const category = findCategory(catalog, slug);
  if (!category) return <NotFoundPage />;

  return (
    <>
      <Typography variant="h4" component="h1" gutterBottom>
        {category.name}
      </Typography>

      <Typography variant="h6" component="h2" sx={{ mt: 3 }}>
        Monsters
      </Typography>
      <List aria-label="Monsters">
        {category.monsters.map((monster) => (
          <ListItem key={monster.slug} disablePadding>
            <ListItemButton
              component={RouterLink}
              to={monsterPath(monster.slug, category.slug, master?.key)}
            >
              <ListItemText primary={monster.page} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <Typography variant="h6" component="h2" sx={{ mt: 3, mb: 1 }}>
        Assigned by
      </Typography>
      <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', columnGap: 2 }}>
        {category.masters.map((key) => (
          <Link key={key} component={RouterLink} to={masterPath(key)}>
            {getMaster(key)?.name}
          </Link>
        ))}
      </Stack>
    </>
  );
}
