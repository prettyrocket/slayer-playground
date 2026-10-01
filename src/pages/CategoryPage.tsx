import { useState } from 'react';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableSortLabel from '@mui/material/TableSortLabel';
import Typography from '@mui/material/Typography';

import { Link as RouterLink, useParams } from 'react-router';

import { CatalogStatus } from '@/components/CatalogStatus';
import { IconTile } from '@/components/IconCard';
import { MasterCards } from '@/components/MasterCards';
import { WikiLink } from '@/components/WikiLink';
import { type Category, findCategory, findMonster, useCatalog } from '@/data/catalog';
import { neededItems, protectFrom } from '@/data/combat';
import type { Monster } from '@/data/types';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { monsterPath } from '@/routing/paths';
import { useNavLocation } from '@/routing/useNavLocation';

/** Combat level across a monster's versions: [lowest, highest]. */
function combatRange(monster: Monster): [number, number] | null {
  const levels = monster.versions.map((v) => v.combatLevel).filter((l): l is number => l !== null);
  return levels.length ? [Math.min(...levels), Math.max(...levels)] : null;
}
const range = (r: [number, number] | null) =>
  !r ? '—' : r[0] === r[1] ? `${r[0]}` : `${r[0]}–${r[1]}`;

/** Items the category's equipment list ties to this monster ("Earmuffs", "Leaf-bladed spear +4"). */
function needs(category: Category, monster: Monster): string {
  const items = neededItems([category], monster);
  if (items.length === 0) return '—';
  return items.length > 1 ? `${items[0]} +${items.length - 1}` : items[0];
}

/** A comparison column: heading, cell text, and optionally how to sort by it. */
interface Column {
  key: string;
  label: string;
  cell: (m: Monster) => string | number;
  sort?: (m: Monster) => number | null;
  /** Largest first when sorting (e.g. XP); smallest first otherwise. */
  descending?: boolean;
}

const COLUMNS: Column[] = [
  { key: 'slayer', label: 'Slayer', cell: (m) => m.slayerLevel ?? '—', sort: (m) => m.slayerLevel },
  {
    key: 'combat',
    label: 'Combat',
    cell: (m) => range(combatRange(m)),
    sort: (m) => combatRange(m)?.[0] ?? null,
  },
  {
    key: 'hp',
    label: 'HP',
    cell: (m) => m.versions[0]?.hitpoints ?? '—',
    sort: (m) => m.versions[0]?.hitpoints ?? null,
  },
  {
    key: 'def',
    label: 'Def',
    cell: (m) => m.versions[0]?.levels.defence ?? '—',
    sort: (m) => m.versions[0]?.levels.defence ?? null,
  },
  {
    key: 'xp',
    label: 'Slayer XP',
    cell: (m) => m.versions[0]?.slayerXp ?? '—',
    sort: (m) => m.versions[0]?.slayerXp ?? null,
    descending: true,
  },
  { key: 'maxhit', label: 'Max hit', cell: (m) => m.versions[0]?.maxHit.join(', ') || '—' },
  { key: 'attacks', label: 'Attacks', cell: (m) => protectFrom(m.versions[0]) ?? '—' },
];

/**
 * /categories/:slug — "I got this task, which monster do I kill?": the monsters
 * that count, compared on what decides it: requirements, how fast and how
 * dangerous, and what they need. Superiors show under their base monster.
 * Then the masters who assign it (the others, when the user came from one).
 */
export function CategoryPage() {
  const { slug = '' } = useParams();
  const { data: catalog } = useCatalog();
  const { master: current } = useNavLocation();
  const [sortBy, setSortBy] = useState('monster');
  if (!catalog) return <CatalogStatus />;
  const category = findCategory(catalog, slug);
  if (!category) return <NotFoundPage />;

  const column = COLUMNS.find((c) => c.key === sortBy);
  const rows = category.monsters
    .filter((m) => m.superiorOf.length === 0)
    .toSorted((a, b) => {
      if (column?.sort) {
        // Missing values last, whichever way it sorts.
        const [x, y] = [column.sort(a), column.sort(b)];
        if (x !== y) {
          if (x === null) return 1;
          if (y === null) return -1;
          return column.descending ? y - x : x - y;
        }
      }
      return a.page.localeCompare(b.page);
    });
  const hasNeeds = rows.some((m) => needs(category, m) !== '—');
  const others = category.masters.filter((key) => key !== current?.key);

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconTile icon={category.icon} name={category.name} size={64} />
        <Box>
          <Typography variant="h4" component="h1">
            {category.name}
          </Typography>
          <Typography color="text.secondary">
            {rows.length} monster{rows.length === 1 ? '' : 's'}
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
        <Table size="small" aria-label={`${category.name} monsters`}>
          <TableHead>
            <TableRow>
              <TableCell sortDirection={sortBy === 'monster' ? 'asc' : false}>
                <TableSortLabel active={sortBy === 'monster'} onClick={() => setSortBy('monster')}>
                  Monster
                </TableSortLabel>
              </TableCell>
              {COLUMNS.map((c) => (
                <TableCell
                  key={c.key}
                  align="right"
                  sortDirection={sortBy === c.key ? (c.descending ? 'desc' : 'asc') : false}
                  sx={{ whiteSpace: 'nowrap' }}
                >
                  {c.sort ? (
                    <TableSortLabel
                      active={sortBy === c.key}
                      direction={c.descending ? 'desc' : 'asc'}
                      onClick={() => setSortBy(c.key)}
                    >
                      {c.label}
                    </TableSortLabel>
                  ) : (
                    c.label
                  )}
                </TableCell>
              ))}
              {hasNeeds && <TableCell>Needs</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((monster) => {
              const superior = monster.superior
                ? findMonster(catalog, monster.superior)
                : undefined;
              return (
                <TableRow key={monster.slug} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <IconTile icon={monster.icon} name={monster.page} size={32} />
                      <Box sx={{ minWidth: 0 }}>
                        <Link
                          component={RouterLink}
                          to={monsterPath(monster.slug, category.slug, current?.key)}
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
                              to={monsterPath(superior.slug, category.slug, current?.key)}
                              color="inherit"
                            >
                              {superior.page}
                            </Link>
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </TableCell>
                  {COLUMNS.map((c) => (
                    <TableCell key={c.key} align="right" sx={{ whiteSpace: 'nowrap' }}>
                      {c.cell(monster)}
                    </TableCell>
                  ))}
                  {hasNeeds && <TableCell>{needs(category, monster)}</TableCell>}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {others.length > 0 && (
        <Box component="section" sx={{ mt: 4 }}>
          <Typography variant="h6" component="h2" sx={{ mb: 1.5 }}>
            {current ? 'Also assigned by' : 'Assigned by'}
          </Typography>
          <MasterCards only={others} label={current ? 'Also assigned by' : 'Assigned by'} />
        </Box>
      )}
    </>
  );
}
