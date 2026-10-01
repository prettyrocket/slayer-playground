import { Fragment } from 'react';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

import { Link as RouterLink, useParams } from 'react-router';

import { CatalogStatus } from '@/components/CatalogStatus';
import { IconTile } from '@/components/IconCard';
import { PlaceName } from '@/components/PlaceName';
import { WikiLink } from '@/components/WikiLink';
import { type Catalog, type Category, findCategory, findMonster, useCatalog } from '@/data/catalog';
import { neededItems } from '@/data/combat';
import { placesOf, yesNo } from '@/data/locations';
import type { Monster, MonsterLocation } from '@/data/types';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { monsterPath } from '@/routing/paths';
import { useNavLocation } from '@/routing/useNavLocation';

/** Items the category's equipment list ties to this monster ("Earmuffs", "Leaf-bladed spear +4"). */
function needs(category: Category, monster: Monster): string {
  const items = neededItems([category], monster);
  if (items.length === 0) return '—';
  return items.length > 1 ? `${items[0]} +${items.length - 1}` : items[0];
}

const HEADERS = ['Level', 'Spawns', 'Multi', 'Cannon', 'Safespot', 'Slayer', 'Slayer XP'];

/** A monster's row under a place: its level and spawns there, and what it takes. */
function MonsterRow({
  monster,
  location,
  category,
  catalog,
  hasNeeds,
}: {
  monster: Monster;
  location: MonsterLocation | null;
  category: Category;
  catalog: Catalog;
  hasNeeds: boolean;
}) {
  const { master } = useNavLocation();
  const superior = monster.superior ? findMonster(catalog, monster.superior) : undefined;
  return (
    <TableRow hover>
      <TableCell sx={{ pl: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <IconTile icon={monster.icon} name={monster.page} size={32} />
          <Box sx={{ minWidth: 0 }}>
            <Link
              component={RouterLink}
              to={monsterPath(monster.slug, category.slug, master?.key)}
              underline="hover"
              sx={{ fontWeight: 500 }}
            >
              {monster.page}
            </Link>
            {superior && (
              <Typography variant="caption" color="text.secondary" component="div">
                Superior:{' '}
                <Link
                  component={RouterLink}
                  to={monsterPath(superior.slug, category.slug, master?.key)}
                  color="inherit"
                >
                  {superior.page}
                </Link>
              </Typography>
            )}
          </Box>
        </Box>
      </TableCell>
      <TableCell align="right">{location?.levels.join(', ') || '—'}</TableCell>
      <TableCell align="right">{location?.spawns ?? '—'}</TableCell>
      <TableCell colSpan={3} />
      <TableCell align="right">{monster.slayerLevel ?? '—'}</TableCell>
      <TableCell align="right">{monster.versions[0]?.slayerXp ?? '—'}</TableCell>
      {hasNeeds && <TableCell>{needs(category, monster)}</TableCell>}
    </TableRow>
  );
}

/**
 * /categories/:slug/locations — the category's monsters by where they spawn:
 * each place, with whether it's multi, cannonable or safespottable, then the
 * monsters there with their level and spawns. Monsters the wiki gives no place
 * for come last. Superiors show under their base monster.
 */
export function CategoryLocationsPage() {
  const { slug = '' } = useParams();
  const { data: catalog } = useCatalog();
  if (!catalog) return <CatalogStatus />;
  const category = findCategory(catalog, slug);
  if (!category) return <NotFoundPage />;

  const monsters = category.monsters.filter((m) => m.superiorOf.length === 0);
  const places = placesOf(monsters);
  const unplaced = monsters.filter((m) => m.locations.length === 0);
  const hasNeeds = monsters.some((m) => needs(category, m) !== '—');
  const props = { category, catalog, hasNeeds };

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconTile icon={category.icon} name={category.name} size={64} />
        <Box>
          <Typography variant="h4" component="h1">
            {category.name}
          </Typography>
          <Typography color="text.secondary">
            {places.length} location{places.length === 1 ? '' : 's'}
          </Typography>
        </Box>
        <Box sx={{ ml: 'auto' }}>
          {category.page ? (
            <WikiLink page={category.page} />
          ) : (
            <WikiLink page={null} missing="No Slayer task page on the OSRS Wiki" />
          )}
        </Box>
      </Box>

      <TableContainer>
        <Table size="small" aria-label={`${category.name} locations`}>
          <TableHead>
            <TableRow>
              <TableCell>Location</TableCell>
              {HEADERS.map((h) => (
                <TableCell key={h} align="right" sx={{ whiteSpace: 'nowrap' }}>
                  {h}
                </TableCell>
              ))}
              {hasNeeds && <TableCell>Needs</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {places.map((place) => (
              <Fragment key={place.name}>
                <TableRow sx={{ bgcolor: 'action.hover' }}>
                  <TableCell sx={{ fontWeight: 500 }}>
                    <PlaceName location={place} />
                  </TableCell>
                  <TableCell />
                  <TableCell align="right">{place.spawns ?? '—'}</TableCell>
                  <TableCell align="right">{yesNo(place.multicombat)}</TableCell>
                  <TableCell align="right">{yesNo(place.cannon)}</TableCell>
                  <TableCell align="right">{yesNo(place.safespot)}</TableCell>
                  <TableCell colSpan={hasNeeds ? 3 : 2} />
                </TableRow>
                {place.monsters.map(({ monster, location }) => (
                  <MonsterRow key={monster.slug} monster={monster} location={location} {...props} />
                ))}
              </Fragment>
            ))}
            {unplaced.length > 0 && (
              <>
                <TableRow sx={{ bgcolor: 'action.hover' }}>
                  <TableCell colSpan={HEADERS.length + (hasNeeds ? 2 : 1)} sx={{ fontWeight: 500 }}>
                    Unknown location
                  </TableCell>
                </TableRow>
                {unplaced.map((monster) => (
                  <MonsterRow key={monster.slug} monster={monster} location={null} {...props} />
                ))}
              </>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
}
