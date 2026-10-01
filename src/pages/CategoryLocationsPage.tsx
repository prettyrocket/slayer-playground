import { Fragment, type ReactNode, useState } from 'react';

import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { Link as RouterLink, useParams } from 'react-router';

import { resolveUrl } from '@/api';
import { CatalogStatus } from '@/components/CatalogStatus';
import { IconTile } from '@/components/IconCard';
import { PlaceName } from '@/components/PlaceName';
import { WikiLink } from '@/components/WikiLink';
import { type Catalog, type Category, findCategory, findMonster, useCatalog } from '@/data/catalog';
import { neededItems } from '@/data/combat';
import { type Place, areaName, isListed, lowestLevel, placesOf, regionsOf } from '@/data/locations';
import { useMastersFile } from '@/data/masters';
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

type Fact = 'multicombat' | 'cannon' | 'safespot';

const sprite = (file: string) => (
  <Box component="img" src={resolveUrl(`icons/${file}`)} alt="" sx={{ display: 'block' }} />
);

/** The place facts, as icons: the game's multiway and cannonball sprites, and a shield. */
const FACTS: { key: Fact; label: string; icon: ReactNode }[] = [
  { key: 'multicombat', label: 'Multicombat', icon: sprite('multicombat.png') },
  { key: 'cannon', label: 'Cannon', icon: sprite('cannon.png') },
  { key: 'safespot', label: 'Safespot', icon: <ShieldOutlinedIcon fontSize="small" /> },
];

/** An icon for each fact that holds there. */
function PlaceFacts({ place }: { place: Place }) {
  return FACTS.filter((f) => place[f.key]).map((f) => (
    <Tooltip key={f.key} title={f.label}>
      <Box
        component="span"
        role="img"
        aria-label={f.label}
        sx={{ display: 'inline-flex', alignItems: 'center', color: 'text.secondary' }}
      >
        {f.icon}
      </Box>
    </Tooltip>
  ));
}

type SortBy = 'spawns' | 'level';

const byNullLast = (a: number | null, b: number | null, flip = 1) =>
  a === b ? 0 : a === null ? 1 : b === null ? -1 : (a - b) * flip;

interface Shared {
  category: Category;
  catalog: Catalog;
  hasNeeds: boolean;
}

/** A monster's cells: who, its level and spawns there, and what it takes. */
function MonsterCells({
  monster,
  location,
  category,
  catalog,
  hasNeeds,
}: Shared & { monster: Monster; location: MonsterLocation | null }) {
  const { master } = useNavLocation();
  const superior = monster.superior ? findMonster(catalog, monster.superior) : undefined;
  return (
    <>
      <TableCell>
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
      <TableCell align="right">{monster.slayerLevel ?? '—'}</TableCell>
      <TableCell align="right">{monster.versions[0]?.slayerXp ?? '—'}</TableCell>
      {hasNeeds && <TableCell>{needs(category, monster)}</TableCell>}
    </>
  );
}

/**
 * A place's rows: its name and facts down the first column, one row per
 * monster there. Indented under its region when it shares one; faded when the
 * master gives places and this isn't one of them.
 */
function PlaceRows({
  place,
  name,
  indent,
  listed,
  ...shared
}: Shared & { place: Place; name: string; indent: boolean; listed: boolean | null }) {
  return place.monsters.map(({ monster, location }, i) => (
    <TableRow key={monster.slug} hover sx={{ opacity: listed === false ? 0.5 : 1 }}>
      {i === 0 && (
        <TableCell
          rowSpan={place.monsters.length}
          sx={{
            verticalAlign: 'top',
            pl: indent ? 4 : 2,
            borderLeft: listed ? 3 : 0,
            borderLeftColor: 'primary.main',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
            <Box component="span" sx={{ fontWeight: 500 }}>
              {indent ? name : <PlaceName location={{ name, page: place.page }} />}
            </Box>
            <PlaceFacts place={place} />
          </Box>
        </TableCell>
      )}
      <MonsterCells monster={monster} location={location} {...shared} />
    </TableRow>
  ));
}

/**
 * /categories/:slug/locations — the category by where its monsters spawn. Each
 * place shows whether it's multicombat, cannonable or safespottable, then the
 * monsters there with their level and spawns. Places sharing a wiki page (the
 * Slayer Tower's floors) group under it. Filters keep places with the chosen
 * facts; on Konar's or Krystilia's trail, their places come first and the rest
 * fade. Monsters the wiki gives no place for come last.
 */
export function CategoryLocationsPage() {
  const { slug = '' } = useParams();
  const { data: catalog } = useCatalog();
  const { master } = useNavLocation();
  const masters = useMastersFile();
  const [facts, setFacts] = useState<Fact[]>([]);
  const [sortBy, setSortBy] = useState<SortBy>('spawns');
  if (!catalog) return <CatalogStatus />;
  const category = findCategory(catalog, slug);
  if (!category) return <NotFoundPage />;

  const monsters = category.monsters.filter((m) => m.superiorOf.length === 0);
  const listedPlaces =
    masters.data?.masters
      .find((m) => m.key === master?.key)
      ?.assignments.find((a) => a.category === category.name.toLowerCase())?.locations ?? [];
  const listed = (place: Place) => (listedPlaces.length ? isListed(place, listedPlaces) : null);

  const places = placesOf(monsters).filter((p) => facts.every((f) => p[f]));
  const regions = regionsOf(places)
    .map((region) => ({
      region,
      listed: region.areas.some((a) => listed(a)),
      lowest: region.areas
        .map(lowestLevel)
        .reduce<number | null>(
          (min, l) => (l === null ? min : min === null ? l : Math.min(min, l)),
          null,
        ),
    }))
    .sort(
      (a, b) =>
        Number(b.listed) - Number(a.listed) ||
        (sortBy === 'spawns'
          ? byNullLast(a.region.spawns, b.region.spawns, -1)
          : byNullLast(a.lowest, b.lowest)) ||
        a.region.name.localeCompare(b.region.name),
    );
  const unplaced = facts.length ? [] : monsters.filter((m) => m.locations.length === 0);
  const hasNeeds = monsters.some((m) => needs(category, m) !== '—');
  const shared = { category, catalog, hasNeeds };
  const width = 6 + (hasNeeds ? 1 : 0);

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

      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
        <ToggleButtonGroup
          size="small"
          value={facts}
          onChange={(_, value: Fact[]) => setFacts(value)}
          aria-label="Only places with"
        >
          {FACTS.map((f) => (
            <ToggleButton key={f.key} value={f.key} sx={{ gap: 0.75, textTransform: 'none' }}>
              {f.icon}
              {f.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={sortBy}
          onChange={(_, value: SortBy | null) => value && setSortBy(value)}
          aria-label="Sort places by"
        >
          <ToggleButton value="spawns" sx={{ textTransform: 'none' }}>
            Most spawns
          </ToggleButton>
          <ToggleButton value="level" sx={{ textTransform: 'none' }}>
            Lowest level
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <TableContainer>
        <Table size="small" aria-label={`${category.name} locations`}>
          <TableHead>
            <TableRow>
              <TableCell>Location</TableCell>
              <TableCell>Monster</TableCell>
              {['Level', 'Spawns', 'Slayer', 'Slayer XP'].map((h) => (
                <TableCell key={h} align="right" sx={{ whiteSpace: 'nowrap' }}>
                  {h}
                </TableCell>
              ))}
              {hasNeeds && <TableCell>Needs</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {regions.map(({ region }) =>
              region.areas.length === 1 ? (
                <PlaceRows
                  key={region.name}
                  place={region.areas[0]}
                  name={region.areas[0].name}
                  indent={false}
                  listed={listed(region.areas[0])}
                  {...shared}
                />
              ) : (
                <Fragment key={region.name}>
                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    <TableCell colSpan={width} sx={{ fontWeight: 500 }}>
                      <PlaceName location={region} />
                    </TableCell>
                  </TableRow>
                  {region.areas.map((area) => (
                    <PlaceRows
                      key={area.name}
                      place={area}
                      name={areaName(region, area)}
                      indent
                      listed={listed(area)}
                      {...shared}
                    />
                  ))}
                </Fragment>
              ),
            )}
            {unplaced.map((monster, i) => (
              <TableRow key={monster.slug} hover>
                {i === 0 && (
                  <TableCell rowSpan={unplaced.length} sx={{ verticalAlign: 'top' }}>
                    —
                  </TableCell>
                )}
                <MonsterCells monster={monster} location={null} {...shared} />
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
}
