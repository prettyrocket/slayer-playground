import { Fragment, type ReactNode, useState } from 'react';

import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
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

/** A game sprite; `scale` enlarges a small one without smoothing its pixels. */
const sprite = (file: string, scale = 1) => (
  <Box
    component="img"
    src={resolveUrl(`icons/${file}`)}
    alt=""
    sx={{ display: 'block', zoom: scale, imageRendering: 'pixelated' }}
  />
);

/** The place facts, as icons: the game's multiway, cannonball and clan hero sprites. */
const FACTS: { key: Fact; label: string; icon: ReactNode }[] = [
  { key: 'multicombat', label: 'Multicombat', icon: sprite('multicombat.png') },
  { key: 'cannon', label: 'Cannon', icon: sprite('cannon.png') },
  // The clan icon is 13px; the others are about 20.
  { key: 'safespot', label: 'Safespot', icon: sprite('safespot.png', 2) },
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

/**
 * The category's superiors, once: "Superior: Greater abyssal demon", or with
 * each one's base monster when there are several (aberrant spectres have two).
 */
function Superiors({
  monsters,
  category,
  catalog,
}: {
  monsters: Monster[];
  category: Category;
  catalog: Catalog;
}) {
  const { master } = useNavLocation();
  const bases = new Map<string, string[]>();
  for (const m of monsters) {
    if (m.superior) bases.set(m.superior, [...(bases.get(m.superior) ?? []), m.page]);
  }
  const superiors = [...bases].flatMap(([slug, from]) => {
    const superior = findMonster(catalog, slug);
    return superior ? [{ superior, from }] : [];
  });
  if (superiors.length === 0) return null;
  return (
    <Typography color="text.secondary" variant="body2">
      {superiors.length === 1 ? 'Superior' : 'Superiors'}:{' '}
      {superiors.map(({ superior, from }, i) => (
        <Fragment key={superior.slug}>
          {i > 0 && ' · '}
          <Link component={RouterLink} to={monsterPath(superior.slug, category.slug, master?.key)}>
            {superior.page}
          </Link>
          {superiors.length > 1 && ` (${from.join(', ')})`}
        </Fragment>
      ))}
    </Typography>
  );
}

/**
 * A small card for a monster at a place: its picture and name, then its level
 * there, Slayer level and Slayer XP, and what it needs, if anything.
 */
function MonsterCard({
  monster,
  location,
  category,
}: {
  monster: Monster;
  location: MonsterLocation | null;
  category: Category;
}) {
  const { master } = useNavLocation();
  const needed = needs(category, monster);
  const xp = monster.versions[0]?.slayerXp;
  const facts = [
    location?.levels.length ? `Level ${location.levels.join(', ')}` : null,
    monster.slayerLevel !== null ? `Slayer ${monster.slayerLevel}` : null,
    xp != null ? `${xp} XP` : null,
  ].filter((f) => f !== null);
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 1.25,
        py: 0.5,
        pl: 0.5,
        pr: 1.5,
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
      }}
    >
      <IconTile icon={monster.icon} name={monster.page} size={40} />
      <Box sx={{ minWidth: 0 }}>
        <Link
          component={RouterLink}
          to={monsterPath(monster.slug, category.slug, master?.key)}
          underline="hover"
          sx={{ fontWeight: 500 }}
        >
          {monster.page}
        </Link>
        {facts.length > 0 && (
          <Typography variant="caption" color="text.secondary" component="div">
            {facts.join(' · ')}
          </Typography>
        )}
        {needed !== '—' && (
          <Typography variant="caption" color="text.secondary" component="div">
            Needs {needed}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

/** A monster's cells: its card, and how many spawn there. */
function MonsterCells({
  monster,
  location,
  category,
}: {
  monster: Monster;
  location: MonsterLocation | null;
  category: Category;
}) {
  return (
    <>
      <TableCell>
        <MonsterCard monster={monster} location={location} category={category} />
      </TableCell>
      <TableCell align="right">{location?.spawns ?? '—'}</TableCell>
    </>
  );
}

/**
 * A place's rows: its name and facts spanning one row per monster there.
 * Indented under its region when it shares one; faded when the master gives
 * places and this isn't one of them.
 */
function PlaceRows({
  place,
  name,
  indent,
  dim,
  category,
}: {
  place: Place;
  name: string;
  indent: boolean;
  dim: boolean;
  category: Category;
}) {
  return place.monsters.map(({ monster, location }, i) => (
    <TableRow key={monster.slug} hover sx={{ opacity: dim ? 0.5 : 1 }}>
      {i === 0 && (
        <>
          <TableCell rowSpan={place.monsters.length} sx={{ fontWeight: 500, pl: indent ? 4 : 2 }}>
            {indent ? name : <PlaceName location={{ name, page: place.page }} />}
          </TableCell>
          <TableCell rowSpan={place.monsters.length}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <PlaceFacts place={place} />
            </Box>
          </TableCell>
        </>
      )}
      <MonsterCells monster={monster} location={location} category={category} />
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
  const [showOthers, setShowOthers] = useState(false);
  if (!catalog) return <CatalogStatus />;
  const category = findCategory(catalog, slug);
  if (!category) return <NotFoundPage />;

  const monsters = category.monsters.filter((m) => m.superiorOf.length === 0);
  const listedPlaces =
    masters.data?.masters
      .find((m) => m.key === master?.key)
      ?.assignments.find((a) => a.category === category.name.toLowerCase())?.locations ?? [];
  // Faded: everything but the master's places, when the master gives places.
  const dim = (theirs: boolean) => listedPlaces.length > 0 && !theirs;

  const places = placesOf(monsters).filter((p) => facts.every((f) => p[f]));
  const regions = regionsOf(places)
    .map((region) => ({
      region,
      listed: region.areas.some((a) => isListed(a, listedPlaces)),
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
  // On a trail whose master gives places, only theirs show until the rest are opened.
  const byMaster = listedPlaces.length > 0;
  const theirs = regions.filter((r) => r.listed);
  const others = regions.length - theirs.length + (unplaced.length > 0 ? 1 : 0);

  const regionRows = ({ region, listed }: (typeof regions)[number]) =>
    region.areas.length === 1 ? (
      <PlaceRows
        key={region.name}
        place={region.areas[0]}
        name={region.areas[0].name}
        indent={false}
        dim={dim(listed)}
        category={category}
      />
    ) : (
      <Fragment key={region.name}>
        <TableRow sx={{ bgcolor: 'action.hover', opacity: dim(listed) ? 0.5 : 1 }}>
          <TableCell colSpan={4} sx={{ fontWeight: 500 }}>
            <PlaceName location={region} />
          </TableCell>
        </TableRow>
        {region.areas.map((area) => (
          <PlaceRows
            key={area.name}
            place={area}
            name={areaName(region, area)}
            indent
            dim={dim(isListed(area, listedPlaces))}
            category={category}
          />
        ))}
      </Fragment>
    );

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
          <Superiors monsters={monsters} category={category} catalog={catalog} />
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
              <TableCell />
              <TableCell>Monster</TableCell>
              <TableCell align="right">Spawns</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(byMaster ? theirs : regions).map(regionRows)}
            {byMaster && others > 0 && (
              <TableRow>
                <TableCell colSpan={4} sx={{ py: 0.5 }}>
                  <Button
                    size="small"
                    color="inherit"
                    onClick={() => setShowOthers(!showOthers)}
                    aria-expanded={showOthers}
                    endIcon={showOthers ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    sx={{ textTransform: 'none', color: 'text.secondary' }}
                  >
                    Other places ({others})
                  </Button>
                </TableCell>
              </TableRow>
            )}
            {(!byMaster || showOthers) && (
              <>
                {byMaster && regions.filter((r) => !r.listed).map(regionRows)}
                {unplaced.map((monster, i) => (
                  <TableRow key={monster.slug} hover sx={{ opacity: dim(false) ? 0.5 : 1 }}>
                    {i === 0 && (
                      <>
                        <TableCell rowSpan={unplaced.length}>—</TableCell>
                        <TableCell rowSpan={unplaced.length} />
                      </>
                    )}
                    <MonsterCells monster={monster} location={null} category={category} />
                  </TableRow>
                ))}
              </>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
}
