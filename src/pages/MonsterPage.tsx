import { type ReactNode, useState } from 'react';

import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import Link from '@mui/material/Link';
import MenuItem from '@mui/material/MenuItem';
import Tab from '@mui/material/Tab';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { Link as RouterLink, useParams, useSearchParams } from 'react-router';

import { resolveUrl } from '@/api';
import { CatalogStatus } from '@/components/CatalogStatus';
import { IconTile } from '@/components/IconCard';
import { PlaceName } from '@/components/PlaceName';
import { WikiLink } from '@/components/WikiLink';
import { type Catalog, categorySlug, findCategory, findMonster, useCatalog } from '@/data/catalog';
import { neededItems, protectFrom } from '@/data/combat';
import { useDrops } from '@/data/drops';
import { LOCATION_COLUMNS } from '@/data/locations';
import type { Drop, Monster, MonsterVersion } from '@/data/types';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { categoryPath, monsterPath } from '@/routing/paths';
import { useNavLocation } from '@/routing/useNavLocation';

const ICONS = `${import.meta.env.BASE_URL}icons/stats/`;
const RUNES: Record<string, string> = {
  Air: 'Air_rune',
  Water: 'Water_rune',
  Earth: 'Earth_rune',
  Fire: 'Fire_rune',
};

/** One row of a stat panel: icon, label, value on the right; `strong` highlights it. */
interface StatRow {
  label: string;
  value: string | number | null;
  icon?: string;
  strong?: boolean;
}

const bonus = (n: number | null) => (n === null ? null : n > 0 ? `+${n}` : `${n}`);
const immunity = (value: boolean | null) =>
  value === null ? null : value ? 'Immune' : 'Not immune';
// Resistances as the wiki gives them: "Immune" (or a 100% resistance) stands out.
const isImmune = (value: string | null) => !!value && /^(immune|100)/i.test(value);
const capitalize = (text: string) => text[0].toUpperCase() + text.slice(1);

/**
 * The wiki's infobox as four panels, like better-monster-examine: combat
 * levels, offensive bonuses, defensive bonuses, and the rest. Rows without a
 * value are left out.
 */
function panels(v: MonsterVersion, monster: Monster): [string, StatRow[]][] {
  const weakness = v.weakness;
  const size = [v.size && `${v.size}×${v.size}`, ...v.attributes.map(capitalize)].filter(Boolean);
  return [
    [
      'Combat',
      [
        { label: 'Hitpoints', value: v.hitpoints, icon: 'Hitpoints_icon' },
        { label: 'Attack', value: v.levels.attack, icon: 'Attack_icon' },
        { label: 'Strength', value: v.levels.strength, icon: 'Strength_icon' },
        { label: 'Defence', value: v.levels.defence, icon: 'Defence_icon' },
        { label: 'Magic', value: v.levels.magic, icon: 'Magic_icon' },
        { label: 'Ranged', value: v.levels.ranged, icon: 'Ranged_icon' },
        // A game tick is 0.6 seconds.
        {
          label: 'Speed',
          value: v.attackSpeed && `${v.attackSpeed} ticks (${(v.attackSpeed * 0.6).toFixed(1)}s)`,
        },
        { label: 'Style', value: v.attackStyles.join(', ') || null },
        { label: 'Max hit', value: v.maxHit.join('\n') || null },
      ],
    ],
    [
      'Aggressive',
      [
        { label: 'Attack', value: bonus(v.offence.attack), icon: 'Attack_icon' },
        { label: 'Strength', value: bonus(v.offence.strength), icon: 'Strength_icon' },
        { label: 'Magic', value: bonus(v.offence.magic), icon: 'Magic_icon' },
        { label: 'Magic dmg', value: bonus(v.offence.magicDamage), icon: 'Magic_Damage_icon' },
        { label: 'Ranged', value: bonus(v.offence.ranged), icon: 'Ranged_icon' },
        {
          label: 'Ranged str',
          value: bonus(v.offence.rangedStrength),
          icon: 'Ranged_Strength_icon',
        },
      ],
    ],
    [
      'Defensive',
      [
        { label: 'Stab', value: bonus(v.defence.stab), icon: 'White_dagger' },
        { label: 'Slash', value: bonus(v.defence.slash), icon: 'White_scimitar' },
        { label: 'Crush', value: bonus(v.defence.crush), icon: 'White_warhammer' },
        { label: 'Magic', value: bonus(v.defence.magic), icon: 'Magic_defence_icon' },
        {
          label: weakness?.element ?? 'Weakness',
          value: weakness && (weakness.percent !== null ? `${weakness.percent}%` : 'Weak'),
          icon: weakness ? RUNES[weakness.element] : undefined,
          strong: true,
        },
        { label: 'Light', value: bonus(v.defence.lightRanged), icon: 'Steel_dart' },
        { label: 'Standard', value: bonus(v.defence.standardRanged), icon: 'Steel_arrow_5' },
        { label: 'Heavy', value: bonus(v.defence.heavyRanged), icon: 'Steel_bolts_5' },
      ],
    ],
    [
      'Info',
      [
        { label: 'Size', value: size.join(', ') || null },
        {
          label: 'Slayer level',
          value: v.slayerLevel ?? monster.slayerLevel,
          icon: 'Slayer_icon',
        },
        { label: 'Slayer XP', value: v.slayerXp, icon: 'Antique_lamp' },
        { label: 'Poison', value: v.immunities.poison, strong: isImmune(v.immunities.poison) },
        { label: 'Venom', value: v.immunities.venom, strong: isImmune(v.immunities.venom) },
        { label: 'Cannon', value: immunity(v.immunities.cannon), strong: !!v.immunities.cannon },
        { label: 'Thrall', value: immunity(v.immunities.thrall), strong: !!v.immunities.thrall },
        { label: 'Burn', value: v.immunities.burn, strong: isImmune(v.immunities.burn) },
        {
          label: 'Freeze',
          value: v.immunities.freeze !== null ? `${v.immunities.freeze}%` : null,
          strong: v.immunities.freeze === 100,
        },
      ],
    ],
  ];
}

/**
 * What to know before fighting it: the prayer, max hit, weakness, the items it
 * needs, its Slayer level, and only the immunities that apply.
 */
function fightRows(v: MonsterVersion, monster: Monster, catalog: Catalog): StatRow[] {
  const weakness = v.weakness;
  const immune = (label: string, value: boolean) =>
    value ? [{ label, value: 'Immune', strong: true }] : [];
  return [
    { label: 'Protect from', value: protectFrom(v) },
    { label: 'Max hit', value: v.maxHit.join('\n') || null },
    {
      label: weakness ? `Weak to ${weakness.element.toLowerCase()}` : 'Weakness',
      value: weakness && (weakness.percent !== null ? `${weakness.percent}%` : 'Yes'),
      icon: weakness ? RUNES[weakness.element] : undefined,
    },
    { label: 'Needs', value: neededItems(catalog.categories, monster).join(', ') || null },
    { label: 'Slayer level', value: v.slayerLevel ?? monster.slayerLevel, icon: 'Slayer_icon' },
    ...immune('Cannon', !!v.immunities.cannon),
    ...immune('Thralls', !!v.immunities.thrall),
    ...immune('Poison', isImmune(v.immunities.poison)),
    ...immune('Venom', isImmune(v.immunities.venom)),
    ...immune('Freeze', v.immunities.freeze === 100),
  ];
}

/** A titled panel of stat rows: icon, label, and the value on the right. */
function StatPanel({ title, rows }: { title: string; rows: StatRow[] }) {
  const shown = rows.filter((r) => r.value !== null && r.value !== '');
  if (shown.length === 0) return null;
  const id = `stats-${title.toLowerCase()}`;
  return (
    <Box
      component="section"
      aria-labelledby={id}
      sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 1.5 }}
    >
      <Typography id={id} variant="subtitle2" component="h2" sx={{ mb: 1 }}>
        {title}
      </Typography>
      <Box component="dl" sx={{ m: 0, display: 'grid', rowGap: 0.5 }}>
        {shown.map((row) => (
          <Box key={row.label} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
            <Box
              component="dt"
              sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}
            >
              <Box sx={{ width: 20, display: 'grid', placeItems: 'center' }}>
                {row.icon && (
                  <Box
                    component="img"
                    src={`${ICONS}${row.icon}.png`}
                    alt=""
                    sx={{ maxWidth: 20, maxHeight: 20 }}
                  />
                )}
              </Box>
              <Typography variant="body2" color="text.secondary">
                {row.label}
              </Typography>
            </Box>
            <Typography
              component="dd"
              variant="body2"
              sx={{
                m: 0,
                ml: 'auto',
                textAlign: 'right',
                whiteSpace: 'pre-line',
                fontWeight: 500,
                color: row.strong ? 'error.main' : undefined,
              }}
            >
              {row.value}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function quantity(drop: Drop): string {
  const q = drop.quantity;
  const amount = !q ? 'Varies' : q[0] === q[1] ? `${q[0]}` : `${q[0]}–${q[1]}`;
  return drop.noted ? `${amount} (noted)` : amount;
}

/** Its superior, or what it's the superior of, as small linked lines under the name. */
function SuperiorLinks({
  monster,
  catalog,
  category,
}: {
  monster: Monster;
  catalog: Catalog;
  category?: string;
}) {
  const { master } = useNavLocation();
  const links = [
    ...(monster.superior ? [['Superior', monster.superior]] : []),
    ...monster.superiorOf.map((slug) => ['Superior of', slug]),
  ] as [string, string][];
  return links.map(([label, slug]) => {
    const other = findMonster(catalog, slug);
    return (
      other && (
        <Typography key={slug} color="text.secondary">
          {label}:{' '}
          <Link component={RouterLink} to={monsterPath(other.slug, category, master?.key)}>
            {other.page}
          </Link>
        </Typography>
      )
    );
  });
}

/**
 * How rare a drop is per kill, for its color, as in better-monster-examine:
 * past 1/50 uncommon, past 1/500 rare, past 1/5000 ultra rare. "Always" and
 * rarities without a number stay common.
 */
type Tier = 'common' | 'uncommon' | 'rare' | 'ultra';
function tierOf(drop: Drop): Tier {
  const p = drop.chance === null ? 0 : drop.chance * drop.rolls;
  if (p <= 0 || p >= 1 / 50) return 'common';
  if (p >= 1 / 500) return 'uncommon';
  if (p >= 1 / 5000) return 'rare';
  return 'ultra';
}

// Light and dark shades of green, blue and purple; common keeps the text color.
const TIER_COLORS: Record<Exclude<Tier, 'common'>, [string, string]> = {
  uncommon: ['#2e7d32', '#5fc96b'],
  rare: ['#1565c0', '#5aa9e6'],
  ultra: ['#7b1fa2', '#bb7fe0'],
};

function Rarity({ drop }: { drop: Drop }) {
  const tier = tierOf(drop);
  if (tier === 'common') return <>{drop.rarity}</>;
  const [light, dark] = TIER_COLORS[tier];
  return (
    <Box
      component="span"
      sx={(theme) => ({
        color: light,
        fontWeight: 500,
        ...theme.applyStyles('dark', { color: dark }),
      })}
    >
      {drop.rarity}
    </Box>
  );
}

/** A heading that folds what's under it away, with a triangle saying which way. */
function Disclosure({
  id,
  title,
  count,
  open,
  onToggle,
  band,
  children,
}: {
  id: string;
  title: string;
  count?: number;
  open: boolean;
  onToggle: () => void;
  band?: boolean;
  children: ReactNode;
}) {
  return (
    <Box
      component="section"
      aria-labelledby={`${id}-title`}
      sx={band ? { mb: 2 } : { border: 1, borderColor: 'divider', borderRadius: 2, mb: 1 }}
    >
      <Typography
        component={band ? 'h2' : 'h3'}
        variant={band ? 'subtitle1' : 'subtitle2'}
        sx={{ m: 0 }}
      >
        <ButtonBase
          id={`${id}-title`}
          aria-expanded={open}
          aria-controls={id}
          onClick={onToggle}
          sx={{
            width: '100%',
            justifyContent: 'flex-start',
            gap: 1,
            px: 1.5,
            py: band ? 1 : 0.75,
            borderRadius: 2,
            font: 'inherit',
            fontWeight: band ? 600 : 500,
            textAlign: 'left',
            ...(band && { bgcolor: 'action.selected' }),
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          <ExpandMoreIcon
            fontSize="small"
            sx={{ transition: 'transform 150ms', transform: open ? 'none' : 'rotate(-90deg)' }}
          />
          {title}
          {count !== undefined && (
            <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
              {count}
            </Typography>
          )}
        </ButtonBase>
      </Typography>
      <Collapse in={open} id={id} unmountOnExit>
        <Box sx={band ? { pt: 1 } : undefined}>{children}</Box>
      </Collapse>
    </Box>
  );
}

function DropRows({ label, drops }: { label: string; drops: Drop[] }) {
  return (
    <TableContainer>
      <Table size="small" aria-label={label}>
        <TableHead>
          <TableRow>
            <TableCell>Item</TableCell>
            <TableCell align="right">Quantity</TableCell>
            <TableCell align="right">Rarity</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {drops.map((drop, i) => (
            <TableRow key={`${drop.item}-${i}`} hover sx={{ '&:last-child td': { border: 0 } }}>
              <TableCell>{drop.item}</TableCell>
              <TableCell align="right">{quantity(drop)}</TableCell>
              <TableCell align="right">
                <Rarity drop={drop} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

interface DropGroup {
  label: string | null;
  sections: { label: string; drops: Drop[] }[];
}

/**
 * Drops in the wiki's own tables, in its order: groups (a location or combat
 * level the page splits its drops by), then sections ("Herbs", "Tertiary").
 * Drops the sync couldn't file go under their drop version.
 */
function dropGroups(drops: Drop[]): DropGroup[] {
  const groups: DropGroup[] = [];
  for (const drop of drops) {
    const label = drop.section === null ? null : drop.group;
    const section = drop.section ?? drop.dropVersion ?? 'Drops';
    let group = groups.find((g) => g.label === label);
    if (!group) groups.push((group = { label, sections: [] }));
    let s = group.sections.find((x) => x.label === section);
    if (!s) group.sections.push((s = { label: section, drops: [] }));
    s.drops.push(drop);
  }
  return groups;
}

const slug = (...parts: (string | null)[]) =>
  parts
    .filter(Boolean)
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');

/**
 * Its drops as better-monster-examine lays them out: a band per location or
 * combat level, each folding away, and a table per wiki section under it, each
 * folding on its own. Bands for other versions than the picked one start folded.
 */
function Drops({ monster, version }: { monster: Monster; version: string | null }) {
  const { data, isError, error } = useDrops(monster);
  const [toggled, setToggled] = useState<Record<string, boolean>>({});

  if (!monster.hasDrops) return <Typography color="text.secondary">No drops.</Typography>;
  if (isError) return <Alert severity="error">{error.message}</Alert>;
  if (!data) return <CircularProgress size={24} aria-label="Loading drops" />;

  const groups = dropGroups(data.drops);
  const hasVersion = (g: DropGroup) =>
    g.sections.some((s) => s.drops.some((d) => d.dropVersion === version));
  const anyMatch = groups.some(hasVersion);
  const isOpen = (key: string, byDefault: boolean) => toggled[key] ?? byDefault;
  const toggle = (key: string, byDefault: boolean) =>
    setToggled((t) => ({ ...t, [key]: !(t[key] ?? byDefault) }));

  const sections = (group: DropGroup) =>
    group.sections.map((s) => {
      const key = slug('drops', group.label, s.label);
      return (
        <Disclosure
          key={key}
          id={key}
          title={s.label}
          count={s.drops.length}
          open={isOpen(key, true)}
          onToggle={() => toggle(key, true)}
        >
          <DropRows label={`${s.label} drops`} drops={s.drops} />
        </Disclosure>
      );
    });

  return groups.map((group) => {
    if (group.label === null) return <Box key="-">{sections(group)}</Box>;
    const key = slug('drops', group.label);
    const byDefault = !anyMatch || hasVersion(group);
    return (
      <Disclosure
        key={key}
        id={key}
        title={group.label}
        open={isOpen(key, byDefault)}
        onToggle={() => toggle(key, byDefault)}
        band
      >
        {sections(group)}
      </Disclosure>
    );
  });
}

/**
 * /monsters/:slug — the monster picked for a task: its stats, where it spawns
 * and its drops, a tab each, under a header with the tasks it counts for.
 */
export function MonsterPage() {
  const { slug = '' } = useParams();
  const { data: catalog } = useCatalog();
  if (!catalog) return <CatalogStatus />;
  const monster = findMonster(catalog, slug);
  if (!monster) return <NotFoundPage />;
  // Keyed, so version and drop tabs start over on another monster.
  return <MonsterDetails key={monster.slug} monster={monster} catalog={catalog} />;
}

/** Where it spawns: one row per place, most spawns first. */
function Locations({ monster }: { monster: Monster }) {
  return (
    <TableContainer>
      <Table size="small" aria-label={`${monster.page} locations`}>
        <TableHead>
          <TableRow>
            <TableCell>Location</TableCell>
            {LOCATION_COLUMNS.map((c) => (
              <TableCell key={c.label} align="right">
                {c.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {monster.locations.map((location) => (
            <TableRow key={location.name} hover>
              <TableCell>
                <PlaceName location={location} />
              </TableCell>
              {LOCATION_COLUMNS.map((c) => (
                <TableCell key={c.label} align="right">
                  {c.cell(location)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

type TabKey = 'stats' | 'locations' | 'drops';

/** The tasks it counts for, as small linked chips in the header. */
function CountsFor({ monster, catalog }: { monster: Monster; catalog: Catalog }) {
  const { master } = useNavLocation();
  const categories = monster.categories
    .map((name) => findCategory(catalog, categorySlug(name)))
    .filter((c) => c !== undefined);
  if (categories.length === 0) return null;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
      <Typography variant="body2" color="text.secondary">
        Counts for
      </Typography>
      <Box
        component="ul"
        aria-label="Counts for"
        sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, listStyle: 'none', p: 0, m: 0 }}
      >
        {categories.map((c) => (
          <li key={c.slug}>
            <Chip
              component={RouterLink}
              to={categoryPath(c.slug, master?.key)}
              clickable
              size="small"
              variant="outlined"
              label={c.name}
              avatar={
                c.icon ? (
                  <Avatar variant="rounded" src={resolveUrl(`data/${c.icon}`)} alt="" />
                ) : undefined
              }
            />
          </li>
        ))}
      </Box>
    </Box>
  );
}

/**
 * Like better-monster-examine's panel: a header that stays put — name, level,
 * examine, version and the tasks it counts for — over Stats, Locations and
 * Drops tabs. The tab rides in the URL (`?tab=`), so it survives a reload.
 */
function MonsterDetails({ monster, catalog }: { monster: Monster; catalog: Catalog }) {
  const { category } = useNavLocation();
  const [params, setParams] = useSearchParams();
  const [index, setIndex] = useState(0);
  const version = monster.versions[index];

  const tabs: [TabKey, string][] = [['stats', 'Stats']];
  if (monster.locations.length > 0) tabs.push(['locations', 'Locations']);
  tabs.push(['drops', 'Drops']);
  const tab = tabs.find(([key]) => key === params.get('tab'))?.[0] ?? 'stats';
  const selectTab = (key: TabKey) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (key === 'stats') next.delete('tab');
        else next.set('tab', key);
        return next;
      },
      { replace: true },
    );

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
        <IconTile icon={monster.icon} name={monster.page} size={64} />
        <Box sx={{ minWidth: 0, display: 'grid', gap: 0.5 }}>
          <Typography variant="h4" component="h1">
            {monster.page}
            {version?.combatLevel != null && (
              <Typography component="span" variant="h6" color="error.main" sx={{ ml: 1 }}>
                (level {version.combatLevel})
              </Typography>
            )}
          </Typography>
          {version?.examine && (
            <Typography color="text.secondary" sx={{ fontStyle: 'italic', whiteSpace: 'pre-line' }}>
              {version.examine}
            </Typography>
          )}
          <SuperiorLinks monster={monster} catalog={catalog} category={category?.slug} />
        </Box>
        <Box sx={{ ml: 'auto' }}>
          <WikiLink page={monster.page} />
        </Box>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 2 }}>
        {monster.versions.length > 1 && tab !== 'drops' && (
          <TextField
            select
            size="small"
            label="Version"
            value={index}
            onChange={(e) => setIndex(Number(e.target.value))}
            sx={{ minWidth: 200 }}
          >
            {monster.versions.map((v, i) => (
              <MenuItem key={i} value={i}>
                {v.version ?? v.name}
              </MenuItem>
            ))}
          </TextField>
        )}
        <CountsFor monster={monster} catalog={catalog} />
      </Box>

      <Tabs
        value={tab}
        onChange={(_, key: TabKey) => selectTab(key)}
        aria-label="Monster"
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
      >
        {tabs.map(([key, label]) => (
          <Tab
            key={key}
            value={key}
            label={label}
            id={`monster-tab-${key}`}
            aria-controls={`monster-panel-${key}`}
          />
        ))}
      </Tabs>

      <Box role="tabpanel" id={`monster-panel-${tab}`} aria-labelledby={`monster-tab-${tab}`}>
        {tab === 'stats' && version && (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 1.5,
              alignItems: 'start',
            }}
          >
            <StatPanel title="Fight" rows={fightRows(version, monster, catalog)} />
            {panels(version, monster).map(([title, rows]) => (
              <StatPanel key={title} title={title} rows={rows} />
            ))}
          </Box>
        )}
        {tab === 'locations' && <Locations monster={monster} />}
        {tab === 'drops' && <Drops monster={monster} version={version?.version ?? null} />}
      </Box>
    </>
  );
}
