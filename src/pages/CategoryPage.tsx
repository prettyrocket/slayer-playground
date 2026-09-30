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
import { findCategory, findMonster, useCatalog } from '@/data/catalog';
import type { Monster } from '@/data/types';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { monsterPath } from '@/routing/paths';
import { useNavLocation } from '@/routing/useNavLocation';

/** Combat level across a monster's versions: "124", or "21–84" when they differ. */
function combatRange(monster: Monster): [number, number] | null {
  const levels = monster.versions.map((v) => v.combatLevel).filter((l): l is number => l !== null);
  return levels.length ? [Math.min(...levels), Math.max(...levels)] : null;
}
const showRange = (range: [number, number] | null) =>
  !range ? '—' : range[0] === range[1] ? `${range[0]}` : `${range[0]}–${range[1]}`;

type SortBy = 'monster' | 'combat';

/**
 * /categories/:slug — "I got this task, which monster do I kill?": one row per
 * monster that counts (superiors show on their base monster's row), with its
 * combat and Slayer level; then the masters who assign it (the others, when
 * the user came from one).
 */
export function CategoryPage() {
  const { slug = '' } = useParams();
  const { data: catalog } = useCatalog();
  const { master: current } = useNavLocation();
  const [sortBy, setSortBy] = useState<SortBy>('monster');
  if (!catalog) return <CatalogStatus />;
  const category = findCategory(catalog, slug);
  if (!category) return <NotFoundPage />;

  const rows = category.monsters
    .filter((m) => m.superiorOf.length === 0)
    .toSorted((a, b) => {
      if (sortBy === 'combat') {
        const diff = (combatRange(a)?.[0] ?? Infinity) - (combatRange(b)?.[0] ?? Infinity);
        if (diff !== 0) return diff;
      }
      return a.page.localeCompare(b.page);
    });
  const hasSuperiors = rows.some((m) => m.superior);
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
              <TableCell align="right" sortDirection={sortBy === 'combat' ? 'asc' : false}>
                <TableSortLabel active={sortBy === 'combat'} onClick={() => setSortBy('combat')}>
                  Combat
                </TableSortLabel>
              </TableCell>
              <TableCell align="right">Slayer</TableCell>
              {hasSuperiors && <TableCell>Superior</TableCell>}
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
                      <Link
                        component={RouterLink}
                        to={monsterPath(monster.slug, category.slug, current?.key)}
                        underline="hover"
                        sx={{ fontWeight: 500 }}
                      >
                        {monster.page}
                      </Link>
                    </Box>
                  </TableCell>
                  <TableCell align="right">{showRange(combatRange(monster))}</TableCell>
                  <TableCell align="right">{monster.slayerLevel ?? '—'}</TableCell>
                  {hasSuperiors && (
                    <TableCell>
                      {superior && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <IconTile icon={superior.icon} name={superior.page} size={24} />
                          <Link
                            component={RouterLink}
                            to={monsterPath(superior.slug, category.slug, current?.key)}
                            underline="hover"
                          >
                            {superior.page}
                          </Link>
                        </Box>
                      )}
                    </TableCell>
                  )}
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
