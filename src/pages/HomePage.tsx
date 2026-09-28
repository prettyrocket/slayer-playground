import { useState } from 'react';

import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { Link } from 'react-router';

import { CategoryList } from '@/components/CategoryList';
import { getMasters } from '@/data/masters';
import { masterPath } from '@/paths';

export function HomePage() {
  const [query, setQuery] = useState('');

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
        placeholder="Abyssal demons, dust devils, kalphite…"
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
