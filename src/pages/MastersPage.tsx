import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import { MasterCards } from '@/components/MasterCards';
import { WikiLink } from '@/components/WikiLink';

/** /masters — every Slayer master. */
export function MastersPage() {
  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <Typography variant="h4" component="h1">
          Slayer masters
        </Typography>
        <Box sx={{ ml: 'auto' }}>
          <WikiLink page="Slayer Master" />
        </Box>
      </Box>
      <MasterCards />
    </>
  );
}
