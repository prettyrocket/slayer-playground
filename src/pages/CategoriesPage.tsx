import { useState } from 'react';

import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { CategoryList } from '@/components/CategoryList';

/** /categories — every Slayer category. */
export function CategoriesPage() {
  const [query, setQuery] = useState('');

  return (
    <>
      <Typography variant="h4" component="h1" gutterBottom>
        Slayer categories
      </Typography>
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
