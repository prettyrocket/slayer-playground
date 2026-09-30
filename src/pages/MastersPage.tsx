import Typography from '@mui/material/Typography';

import { MasterCards } from '@/components/MasterCards';

/** /masters — every Slayer master. */
export function MastersPage() {
  return (
    <>
      <Typography variant="h4" component="h1" gutterBottom>
        Slayer masters
      </Typography>
      <MasterCards />
    </>
  );
}
