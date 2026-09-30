import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Typography from '@mui/material/Typography';

import { Link, useSearchParams } from 'react-router';

import { CategoryList } from '@/components/CategoryList';
import { useCatalog } from '@/data/catalog';
import { getMasters } from '@/data/masters';
import { masterPath } from '@/routing/paths';

/** One card per master, with how many tasks they give once the catalog is loaded. */
function MasterCards() {
  const { data: catalog } = useCatalog();
  return (
    <Box component="nav" aria-label="Slayer masters">
      <Box
        component="ul"
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
          gap: 1,
          listStyle: 'none',
          p: 0,
          m: 0,
        }}
      >
        {getMasters().map((master) => {
          const tasks = catalog?.categories.filter((c) => c.masters.includes(master.key)).length;
          return (
            <Card component="li" variant="outlined" key={master.key}>
              <CardActionArea component={Link} to={masterPath(master.key)} sx={{ px: 1.5, py: 1 }}>
                <Typography component="span" sx={{ display: 'block', fontWeight: 600 }} noWrap>
                  {master.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {tasks === undefined ? ' ' : `${tasks} task${tasks === 1 ? '' : 's'}`}
                </Typography>
              </CardActionArea>
            </Card>
          );
        })}
      </Box>
    </Box>
  );
}

/**
 * / — find your task: masters and every task, or the results of the app bar
 * search, which lives in the URL (`?q=`) so a search can be linked.
 */
export function HomePage() {
  const [params] = useSearchParams();
  const query = params.get('q') ?? '';

  return (
    <>
      <Typography
        variant="h3"
        component="h1"
        sx={{ fontWeight: 700, textAlign: 'center', my: { xs: 2, sm: 4 } }}
      >
        What&apos;s your Slayer task?
      </Typography>
      {/* While searching, only the results matter. */}
      {!query && (
        <Box component="section" sx={{ mb: 4 }}>
          <Typography variant="h6" component="h2" sx={{ mb: 1.5 }}>
            Start from your Slayer master
          </Typography>
          <MasterCards />
        </Box>
      )}
      <Box component="section">
        <Typography variant="h6" component="h2">
          {query ? 'Results' : 'All tasks'}
        </Typography>
        <CategoryList query={query} />
      </Box>
    </>
  );
}
