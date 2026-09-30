import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { Link, useSearchParams } from 'react-router';

import { CategoryList } from '@/components/CategoryList';
import { getMasters } from '@/data/masters';
import { masterPath } from '@/routing/paths';

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
      <Typography variant="h4" component="h1" gutterBottom>
        What&apos;s your Slayer task?
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Compare where to do it, see what to bring, and check what it drops.
      </Typography>
      <TextField
        type="search"
        label="Search tasks"
        placeholder="A task or monster: abyssal demons, kalphites, Vorkath…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        fullWidth
      />
      <Typography variant="subtitle2" component="h2" color="text.secondary" sx={{ mt: 3, mb: 1 }}>
        Or start from your Slayer master
      </Typography>
      <Stack
        component="nav"
        aria-label="Slayer masters"
        direction="row"
        useFlexGap
        sx={{ flexWrap: 'wrap', gap: 1 }}
      >
        {getMasters().map((master) => (
          <Chip
            key={master.key}
            label={master.name}
            component={Link}
            to={masterPath(master.key)}
            clickable
            variant="outlined"
          />
        ))}
      </Stack>
      <Typography variant="subtitle2" component="h2" color="text.secondary" sx={{ mt: 3 }}>
        All categories
      </Typography>
      <CategoryList query={query} />
    </>
  );
}
