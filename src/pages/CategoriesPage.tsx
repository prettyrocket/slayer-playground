import { useState } from 'react';

import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { CategoryList } from '@/components/CategoryList';
import { WikiLink } from '@/components/WikiLink';

/** /categories — every Slayer category. */
export function CategoriesPage() {
  const [query, setQuery] = useState('');

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <Typography variant="h4" component="h1">
          Slayer categories
        </Typography>
        <Box sx={{ ml: 'auto' }}>
          <WikiLink page="Slayer task" />
        </Box>
      </Box>
      <TextField
        type="search"
        label="Filter categories"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        size="small"
        fullWidth
      />
      <CategoryList query={query} noun={['category', 'categories']} />
    </>
  );
}
