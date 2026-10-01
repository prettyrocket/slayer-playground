import { Fragment, type ReactNode, useState } from 'react';

import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import StarIcon from '@mui/icons-material/Star';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { Link as RouterLink, useParams, useSearchParams } from 'react-router';

import { resolveUrl } from '@/api';
import { CatalogStatus } from '@/components/CatalogStatus';
import { IconTile } from '@/components/IconCard';
import { PlaceName } from '@/components/PlaceName';
import { WikiLink } from '@/components/WikiLink';
import { type Catalog, type Category, findCategory, findMonster, useCatalog } from '@/data/catalog';
import { neededItems } from '@/data/combat';
import { type Place, type Region, areaName, isListed, placesOf, regionsOf } from '@/data/locations';
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

/**
 * How a card shows the monster's superior, while we try them out (?superior=):
 * its picture inset on the monster's, a star badge in the card's corner, or a
 * line naming it.
 */
type SuperiorStyle = 'icon' | 'badge' | 'line';
const SUPERIOR_STYLES: SuperiorStyle[] = ['icon', 'badge', 'line'];

/**
 * A small card for a monster at a place. How many spawn there floats over its
 * top left corner ("×14"); then its name, with its level there on the right;
 * its Slayer level and XP; what it needs, if anything; and its superior, as
 * `superiorStyle` says.
 */
function MonsterCard({
  monster,
  location,
  category,
  catalog,
  superiorStyle,
}: {
  monster: Monster;
  location: MonsterLocation | null;
  category: Category;
  catalog: Catalog;
  superiorStyle: SuperiorStyle;
}) {
  const { master } = useNavLocation();
  const needed = needs(category, monster);
  const xp = monster.versions[0]?.slayerXp;
  const facts = [
    monster.slayerLevel !== null ? `Slayer ${monster.slayerLevel}` : null,
    xp != null ? `${xp} XP` : null,
  ].filter((f) => f !== null);
  const superior = monster.superior ? findMonster(catalog, monster.superior) : undefined;
  const superiorPath = superior && monsterPath(superior.slug, category.slug, master?.key);
  return (
    <Box
      sx={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        width: '100%',
        maxWidth: 380,
        my: 1,
        py: 0.75,
        pl: 0.75,
        pr: 1.5,
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
      }}
    >
      {location?.spawns != null && (
        <Box
          component="span"
          aria-label={`${location.spawns} spawn${location.spawns === 1 ? '' : 's'}`}
          sx={{
            position: 'absolute',
            top: -10,
            left: -10,
            zIndex: 1,
            px: 0.75,
            borderRadius: 1,
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            typography: 'caption',
            fontWeight: 700,
            lineHeight: 1.6,
            boxShadow: 1,
          }}
        >
          ×{location.spawns}
        </Box>
      )}
      {superior && superiorStyle === 'badge' && (
        <Tooltip title={`Superior: ${superior.page}`}>
          <Box
            component={RouterLink}
            to={superiorPath!}
            aria-label={`Superior: ${superior.page}`}
            sx={{
              position: 'absolute',
              top: -10,
              right: -10,
              zIndex: 1,
              display: 'grid',
              placeItems: 'center',
              width: 22,
              height: 22,
              borderRadius: '50%',
              bgcolor: 'warning.main',
              color: 'warning.contrastText',
              boxShadow: 1,
            }}
          >
            <StarIcon sx={{ fontSize: 15 }} />
          </Box>
        </Tooltip>
      )}
      <Box sx={{ position: 'relative', flexShrink: 0 }}>
        <IconTile icon={monster.icon} name={monster.page} size={40} />
        {superior && superiorStyle === 'icon' && (
          <Tooltip title={`Superior: ${superior.page}`}>
            <Box
              component={RouterLink}
              to={superiorPath!}
              aria-label={`Superior: ${superior.page}`}
              sx={{
                position: 'absolute',
                right: -8,
                bottom: -8,
                borderRadius: 1.5,
                outline: 2,
                outlineColor: 'warning.main',
                bgcolor: 'background.paper',
              }}
            >
              <IconTile icon={superior.icon} name={superior.page} size={24} />
            </Box>
          </Tooltip>
        )}
      </Box>
      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
          <Link
            component={RouterLink}
            to={monsterPath(monster.slug, category.slug, master?.key)}
            underline="hover"
            sx={{ fontWeight: 500, flexGrow: 1 }}
          >
            {monster.page}
          </Link>
          {location?.levels.length ? (
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
              Lvl {location.levels.join(', ')}
            </Typography>
          ) : null}
        </Box>
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
        {superior && superiorStyle === 'line' && (
          <Typography variant="caption" color="text.secondary" component="div">
            Superior:{' '}
            <Link component={RouterLink} to={superiorPath!} color="inherit">
              {superior.page}
            </Link>
          </Typography>
        )}
      </Box>
    </Box>
  );
}

/** What every monster card on the page shares. */
interface CardContext {
  category: Category;
  catalog: Catalog;
  superiorStyle: SuperiorStyle;
}

/** A monster's cell: its card. */
function MonsterCells({
  monster,
  location,
  ...context
}: CardContext & { monster: Monster; location: MonsterLocation | null }) {
  return (
    <TableCell>
      <MonsterCard monster={monster} location={location} {...context} />
    </TableCell>
  );
}

/**
 * A place's rows: its name and facts spanning one row per monster there. A
 * place sharing a wiki page with others is named within it ("Slayer Tower ›
 * Basement"). Faded when the master gives places and this isn't one of them.
 */
function PlaceRows({
  place,
  region,
  dim,
  ...context
}: CardContext & {
  place: Place;
  /** The region it shares, when it does. */
  region: Region | null;
  dim: boolean;
}) {
  return place.monsters.map(({ monster, location }, i) => (
    <TableRow key={monster.slug} hover sx={{ opacity: dim ? 0.5 : 1 }}>
      {i === 0 && (
        <>
          <TableCell rowSpan={place.monsters.length} sx={{ fontWeight: 500 }}>
            {region ? (
              <>
                <PlaceName location={region} /> › {areaName(region, place)}
              </>
            ) : (
              <PlaceName location={place} />
            )}
          </TableCell>
          <TableCell rowSpan={place.monsters.length}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <PlaceFacts place={place} />
            </Box>
          </TableCell>
        </>
      )}
      <MonsterCells monster={monster} location={location} {...context} />
    </TableRow>
  ));
}

/**
 * /categories/:slug/locations — the category by where its monsters spawn. Each
 * place shows whether it's multicombat, cannonable or safespottable, then the
 * monsters there with their level and spawns. Places sharing a wiki page (the
 * Slayer Tower's floors) stay together, each named within it. Most spawns
 * first. On Konar's or Krystilia's trail only their places show, the rest
 * folded away and faded. Monsters the wiki gives no place for come last.
 */
export function CategoryLocationsPage() {
  const { slug = '' } = useParams();
  const { data: catalog } = useCatalog();
  const { master } = useNavLocation();
  const masters = useMastersFile();
  const [showOthers, setShowOthers] = useState(false);
  const [search] = useSearchParams();
  const superiorStyle = SUPERIOR_STYLES.find((style) => style === search.get('superior')) ?? 'icon';
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

  const places = placesOf(monsters);
  // regionsOf keeps placesOf's order: most spawns first.
  const regions = regionsOf(places).map((region) => ({
    region,
    listed: region.areas.some((a) => isListed(a, listedPlaces)),
  }));
  const unplaced = monsters.filter((m) => m.locations.length === 0);
  // On a trail whose master gives places, only theirs show until the rest are opened.
  const byMaster = listedPlaces.length > 0;
  const theirs = regions.filter((r) => r.listed);
  const others = regions.length - theirs.length + (unplaced.length > 0 ? 1 : 0);

  // A region's places stay together.
  const context = { category, catalog, superiorStyle };

  const regionRows = ({ region }: (typeof regions)[number]) => (
    <Fragment key={region.name}>
      {region.areas.map((area) => (
        <PlaceRows
          key={area.name}
          place={area}
          region={region.areas.length > 1 ? region : null}
          dim={dim(isListed(area, listedPlaces))}
          {...context}
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
              <TableCell />
              <TableCell>Monster</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(byMaster ? theirs : regions).map(regionRows)}
            {byMaster && others > 0 && (
              <TableRow>
                <TableCell colSpan={3} sx={{ py: 0.5 }}>
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
                    <MonsterCells monster={monster} location={null} {...context} />
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
