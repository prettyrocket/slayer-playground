import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { Link as RouterLink, useParams } from 'react-router';

import { CatalogStatus } from '@/components/CatalogStatus';
import { categorySlug, findCategory, findMonster, useCatalog } from '@/data/catalog';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { categoryPath } from '@/routing/paths';
import { useNavLocation } from '@/routing/useNavLocation';

/** /monsters/:slug — everything about the monster picked for a task (#13 fills this in). */
export function MonsterPage() {
  const { slug = '' } = useParams();
  const { data: catalog } = useCatalog();
  const { master } = useNavLocation();
  if (!catalog) return <CatalogStatus />;
  const monster = findMonster(catalog, slug);
  if (!monster) return <NotFoundPage />;

  return (
    <>
      <Typography variant="h4" component="h1" gutterBottom>
        {monster.page}
      </Typography>
      <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', columnGap: 1 }}>
        <Typography color="text.secondary">Counts toward</Typography>
        {monster.categories.map((name) => {
          const category = findCategory(catalog, categorySlug(name));
          return (
            category && (
              <Link
                key={category.slug}
                component={RouterLink}
                to={categoryPath(category.slug, master?.key)}
              >
                {category.name}
              </Link>
            )
          );
        })}
      </Stack>
    </>
  );
}
