import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';

import { useCatalog } from '@/data/catalog';

/** A spinner while the catalog loads, or its error. Render it until the data is there. */
export function CatalogStatus() {
  const { isError, error } = useCatalog();
  if (isError) return <Alert severity="error">{error.message}</Alert>;
  return <CircularProgress size={24} aria-label="Loading" sx={{ mt: 2 }} />;
}
