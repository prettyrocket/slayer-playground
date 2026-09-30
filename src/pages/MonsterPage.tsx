import { type ReactNode, useState } from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Link from '@mui/material/Link';
import Tab from '@mui/material/Tab';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';

import { Link as RouterLink, useParams } from 'react-router';

import { CatalogStatus } from '@/components/CatalogStatus';
import { IconCard, IconTile } from '@/components/IconCard';
import { type Catalog, categorySlug, findCategory, findMonster, useCatalog } from '@/data/catalog';
import { useDrops } from '@/data/drops';
import type { Drop, Monster, MonsterVersion } from '@/data/types';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { categoryPath, monsterPath } from '@/routing/paths';
import { useNavLocation } from '@/routing/useNavLocation';

const immune = (value: boolean | null) => (value === null ? null : value ? 'Immune' : 'Not immune');

/** The stats worth showing for a version, as label and text; missing values are left out. */
function stats(v: MonsterVersion): [string, string][] {
  const rows: [string, string | number | null][] = [
    ['Combat level', v.combatLevel],
    ['Hitpoints', v.hitpoints],
    ['Max hit', v.maxHit.join(', ') || null],
    ['Attack style', v.attackStyles.join(', ') || null],
    // A game tick is 0.6 seconds.
    [
      'Attack speed',
      v.attackSpeed && `${v.attackSpeed} ticks (${(v.attackSpeed * 0.6).toFixed(1)}s)`,
    ],
    ['Size', v.size && `${v.size}×${v.size}`],
    ['Slayer XP', v.slayerXp],
    [
      'Weakness',
      v.weakness &&
        `${v.weakness.element}${v.weakness.percent !== null ? ` ${v.weakness.percent}%` : ''}`,
    ],
    ['Poison', v.immunities.poison],
    ['Venom', v.immunities.venom],
    ['Cannon', immune(v.immunities.cannon)],
    ['Thralls', immune(v.immunities.thrall)],
    ['Burn', v.immunities.burn],
    ['Freeze', v.immunities.freeze !== null ? `${v.immunities.freeze}% resistance` : null],
  ];
  return rows
    .filter((r): r is [string, string | number] => r[1] !== null && r[1] !== '')
    .map(([label, value]) => [label, String(value)]);
}

const show = (n: number | null) => (n === null ? '—' : String(n));

/** One row of numbers under column headings, e.g. combat levels or defence bonuses. */
function NumberTable({ label, columns }: { label: string; columns: [string, number | null][] }) {
  return (
    <TableContainer>
      <Table size="small" aria-label={label}>
        <TableHead>
          <TableRow>
            {columns.map(([heading]) => (
              <TableCell key={heading} align="center">
                {heading}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          <TableRow>
            {columns.map(([heading, value]) => (
              <TableCell key={heading} align="center">
                {show(value)}
              </TableCell>
            ))}
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function quantity(drop: Drop): string {
  const q = drop.quantity;
  const amount = !q ? 'Varies' : q[0] === q[1] ? `${q[0]}` : `${q[0]}–${q[1]}`;
  return drop.noted ? `${amount} (noted)` : amount;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box component="section" sx={{ mt: 4 }}>
      <Typography variant="h6" component="h2" sx={{ mb: 1.5 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
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

function Drops({ monster, version }: { monster: Monster; version: string | null }) {
  const { data, isError, error } = useDrops(monster);
  const tables = [...new Set(data?.drops.map((d) => d.dropVersion) ?? [])];
  // The drop table named like the chosen version, else the first.
  const [picked, setPicked] = useState<string | null | undefined>(undefined);
  const table = picked !== undefined ? picked : tables.includes(version) ? version : tables[0];

  if (!monster.hasDrops) return <Typography color="text.secondary">No drops.</Typography>;
  if (isError) return <Alert severity="error">{error.message}</Alert>;
  if (!data) return <CircularProgress size={24} aria-label="Loading drops" />;

  const drops = data.drops.filter((d) => d.dropVersion === table);
  return (
    <>
      {tables.length > 1 && (
        <Tabs
          value={tables.indexOf(table ?? null)}
          onChange={(_, i: number) => setPicked(tables[i])}
          variant="scrollable"
          aria-label="Drop tables"
          sx={{ mb: 1 }}
        >
          {tables.map((t) => (
            <Tab key={t ?? ''} label={t ?? 'Drops'} />
          ))}
        </Tabs>
      )}
      <TableContainer>
        <Table size="small" aria-label={`${monster.page} drops`}>
          <TableHead>
            <TableRow>
              <TableCell>Item</TableCell>
              <TableCell align="right">Quantity</TableCell>
              <TableCell align="right">Rarity</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {drops.map((drop, i) => (
              <TableRow key={`${drop.item}-${i}`} hover>
                <TableCell>{drop.item}</TableCell>
                <TableCell align="right">{quantity(drop)}</TableCell>
                <TableCell align="right">{drop.rarity}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
}

/**
 * /monsters/:slug — the monster picked for a task: its versions' stats, levels
 * and defences, its drops, and the tasks it counts for.
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

function MonsterDetails({ monster, catalog }: { monster: Monster; catalog: Catalog }) {
  const { master, category } = useNavLocation();
  const [index, setIndex] = useState(0);
  const version = monster.versions[index];

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconTile icon={monster.icon} name={monster.page} size={64} />
        <Box>
          <Typography variant="h4" component="h1">
            {monster.page}
          </Typography>
          <SuperiorLinks monster={monster} catalog={catalog} category={category?.slug} />
        </Box>
      </Box>

      {monster.versions.length > 1 && (
        <Tabs
          value={index}
          onChange={(_, i: number) => setIndex(i)}
          variant="scrollable"
          aria-label="Versions"
          sx={{ mb: 2 }}
        >
          {monster.versions.map((v, i) => (
            <Tab key={i} label={v.version ?? v.name} />
          ))}
        </Tabs>
      )}

      {version && (
        <>
          <Box
            component="dl"
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: 2,
              m: 0,
            }}
          >
            {stats(version).map(([label, value]) => (
              <Box key={label}>
                <Typography component="dt" variant="body2" color="text.secondary">
                  {label}
                </Typography>
                <Typography component="dd" sx={{ m: 0, fontWeight: 500 }}>
                  {value}
                </Typography>
              </Box>
            ))}
          </Box>

          <Section title="Levels">
            <NumberTable
              label="Levels"
              columns={[
                ['Attack', version.levels.attack],
                ['Strength', version.levels.strength],
                ['Defence', version.levels.defence],
                ['Magic', version.levels.magic],
                ['Ranged', version.levels.ranged],
              ]}
            />
          </Section>

          <Section title="Defence">
            <NumberTable
              label="Defence bonuses"
              columns={[
                ['Stab', version.defence.stab],
                ['Slash', version.defence.slash],
                ['Crush', version.defence.crush],
                ['Magic', version.defence.magic],
                ['Light', version.defence.lightRanged],
                ['Standard', version.defence.standardRanged],
                ['Heavy', version.defence.heavyRanged],
              ]}
            />
          </Section>
        </>
      )}

      <Section title="Drops">
        <Drops monster={monster} version={version?.version ?? null} />
      </Section>

      <Section title="Counts for">
        <Box
          component="ul"
          aria-label="Counts for"
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 1.5,
            listStyle: 'none',
            p: 0,
            m: 0,
          }}
        >
          {monster.categories.map((name) => {
            const c = findCategory(catalog, categorySlug(name));
            return (
              c && (
                <IconCard
                  key={c.slug}
                  to={categoryPath(c.slug, master?.key)}
                  name={c.name}
                  icon={c.icon}
                />
              )
            );
          })}
        </Box>
      </Section>
    </>
  );
}
