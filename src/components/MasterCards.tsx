import Box from '@mui/material/Box';

import { IconCard } from '@/components/IconCard';
import { getMasters, masterIcon } from '@/data/masters';
import { masterPath } from '@/routing/paths';

/** Every master as a card with their chathead and name, linking to their page. */
export function MasterCards() {
  return (
    <Box component="nav" aria-label="Slayer masters">
      <Box
        component="ul"
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 1.5,
          listStyle: 'none',
          p: 0,
          m: 0,
        }}
      >
        {getMasters().map((master) => (
          <IconCard
            key={master.key}
            to={masterPath(master.key)}
            name={master.name}
            icon={masterIcon(master.key)}
          />
        ))}
      </Box>
    </Box>
  );
}
