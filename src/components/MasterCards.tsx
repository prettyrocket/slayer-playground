import Box from '@mui/material/Box';

import { IconCard } from '@/components/IconCard';
import { getMasters, masterIcon } from '@/data/masters';
import type { MasterKey } from '@/data/types';
import { masterPath } from '@/routing/paths';

/**
 * Masters as cards with their chathead and name, linking to their pages: all
 * of them, or just `only` (in master order). `label` names the navigation.
 */
export function MasterCards({
  only,
  label = 'Slayer masters',
}: {
  only?: MasterKey[];
  label?: string;
}) {
  const masters = getMasters().filter((m) => !only || only.includes(m.key));
  return (
    <Box component="nav" aria-label={label}>
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
        {masters.map((master) => (
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
