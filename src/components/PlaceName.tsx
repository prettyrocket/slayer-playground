import Link from '@mui/material/Link';

import type { MonsterLocation } from '@/data/types';
import { wikiUrl } from '@/data/wiki';

/** A place's name, linking to its wiki page when it has one. */
export function PlaceName({ location }: { location: Pick<MonsterLocation, 'name' | 'page'> }) {
  if (!location.page) return location.name;
  return (
    <Link href={wikiUrl(location.page)} target="_blank" rel="noopener noreferrer" underline="hover">
      {location.name}
    </Link>
  );
}
