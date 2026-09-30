import SearchIcon from '@mui/icons-material/Search';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';
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
 * / — find your task. The search lives in the URL (`?q=`), so a search can be
 * linked and survives a reload; typing replaces the history entry instead of
 * adding one per keystroke.
 */
export function HomePage() {
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const setQuery = (q: string) => setParams(q ? { q } : {}, { replace: true });

  return (
    <>
      <Box component="section" sx={{ textAlign: 'center', py: { xs: 2, sm: 4 } }}>
        <Typography variant="h3" component="h1" sx={{ fontWeight: 700, mb: 3 }}>
          What&apos;s your Slayer task?
        </Typography>
        <TextField
          type="search"
          label="Search tasks"
          placeholder="A task or monster: abyssal demons, kalphites, Vorkath…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          fullWidth
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            },
          }}
          sx={{
            maxWidth: 560,
            '& .MuiInputBase-root': { borderRadius: 3, bgcolor: 'background.paper' },
          }}
        />
      </Box>
      {/* While searching, only the results matter. */}
      {!query && (
        <Box component="section" sx={{ mb: 4 }}>
          <Typography variant="h6" component="h2" sx={{ mb: 1.5 }}>
            Choose your slayer master
          </Typography>
          <MasterCards />
        </Box>
      )}
      <Box component="section">
        <Typography variant="h6" component="h2">
          {query ? 'Results' : 'Browse all Tasks'}
        </Typography>
        <CategoryList query={query} />
      </Box>
    </>
  );
}
