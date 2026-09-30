import { useState } from 'react';

import CheckIcon from '@mui/icons-material/Check';
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
import { findCategory, findMonster, useCatalog } from '@/data/catalog';
import { getMaster, masterIcon, useMastersFile } from '@/data/masters';
import type { MasterKey, Monster } from '@/data/types';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { masterPath, monsterPath } from '@/routing/paths';
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
 * combat and Slayer level, and a column per master who assigns the task,
 * checked where that master's task counts the monster.
 */
export function CategoryPage() {
  const { slug = '' } = useParams();
  const { data: catalog } = useCatalog();
  const { data: masters } = useMastersFile();
  const { master: current } = useNavLocation();
  const [sortBy, setSortBy] = useState<SortBy>('monster');
  if (!catalog) return <CatalogStatus />;
  const category = findCategory(catalog, slug);
  if (!category) return <NotFoundPage />;

  const key = category.name.toLowerCase();
  // Monsters a master's task doesn't count, e.g. the King Black Dragon for Krystilia.
  const excluded = (master: MasterKey, monster: Monster) =>
    masters?.masters
      .find((m) => m.key === master)
      ?.assignments.find((a) => a.category === key)
      ?.excludes.includes(monster.slug) ?? false;

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
  const highlight = (master: MasterKey) =>
    master === current?.key ? { bgcolor: 'action.selected' } : undefined;

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
              {category.masters.map((master) => {
                const name = getMaster(master)?.name ?? master;
                return (
                  <TableCell key={master} align="center" title={name} sx={highlight(master)}>
                    <Link
                      component={RouterLink}
                      to={masterPath(master)}
                      aria-label={name}
                      sx={{ display: 'inline-flex' }}
                    >
                      <IconTile icon={masterIcon(master)} name={name} size={32} />
                    </Link>
                  </TableCell>
                );
              })}
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
                  {category.masters.map((master) => (
                    <TableCell key={master} align="center" sx={highlight(master)}>
                      {!excluded(master, monster) && (
                        <Link
                          component={RouterLink}
                          to={monsterPath(monster.slug, category.slug, master)}
                          aria-label={`${monster.page} for ${getMaster(master)?.name ?? master}`}
                          sx={{ display: 'inline-flex' }}
                        >
                          <CheckIcon fontSize="small" />
                        </Link>
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
}
