import { useState } from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
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

import { IconTile } from '@/components/IconCard';
import { WikiLink } from '@/components/WikiLink';
import { categorySlug, useCatalog } from '@/data/catalog';
import { getMaster, masterIcon, useMastersFile } from '@/data/masters';
import type { Assignment } from '@/data/types';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { categoryPath } from '@/routing/paths';

/** "120–170", or "50" for a fixed amount. */
function amount(range: [number, number] | null): string {
  if (!range) return '—';
  return range[0] === range[1] ? `${range[0]}` : `${range[0]}–${range[1]}`;
}

/** "Troll Stronghold (location)" -> "Troll Stronghold": the wiki's disambiguator, not part of the name. */
const placeName = (page: string) => page.replace(/ \(location\)$/, '');

type SortBy = 'chance' | 'task';

/**
 * /masters/:slug — the master's assignment table: each task's weight, chance,
 * amount and extended amount, linking to the task with the master kept as
 * context. Facts only: no block or skip advice.
 */
export function MasterPage() {
  const { slug = '' } = useParams();
  const master = getMaster(slug);
  const masters = useMastersFile();
  const { data: catalog } = useCatalog();
  const [sortBy, setSortBy] = useState<SortBy>('chance');
  if (!master) return <NotFoundPage />;

  const table = masters.data?.masters.find((m) => m.key === master.key);
  // Mortimer offers a choice of tasks, so his weights aren't chances of being assigned.
  const showChance = master.key !== 'mortimer';
  const showLocations = table?.assignments.some((a) => a.locations.length > 0) ?? false;
  const category = (a: Assignment) =>
    catalog?.categories.find((c) => c.slug === categorySlug(a.category));
  const name = (a: Assignment) =>
    category(a)?.name ?? a.category.charAt(0).toUpperCase() + a.category.slice(1);
  const rows = (table?.assignments ?? []).toSorted((a, b) =>
    sortBy === 'chance'
      ? b.weight - a.weight || name(a).localeCompare(name(b))
      : name(a).localeCompare(name(b)),
  );

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconTile icon={masterIcon(master.key)} name={master.name} size={64} />
        <Box>
          <Typography variant="h4" component="h1">
            {master.name}
          </Typography>
          {table && (
            <Typography color="text.secondary">{table.assignments.length} tasks</Typography>
          )}
        </Box>
        <Box sx={{ ml: 'auto' }}>
          {/* The master's NPC page, which has the same title as their name. */}
          <WikiLink page={master.name} />
        </Box>
      </Box>

      {masters.isError && <Alert severity="error">{masters.error.message}</Alert>}
      {!table && !masters.isError && <CircularProgress size={24} aria-label="Loading" />}
      {table && (
        <TableContainer>
          <Table size="small" aria-label={`${master.name}'s tasks`}>
            <TableHead>
              <TableRow>
                <TableCell sortDirection={sortBy === 'task' ? 'asc' : false}>
                  <TableSortLabel active={sortBy === 'task'} onClick={() => setSortBy('task')}>
                    Task
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right">Weight</TableCell>
                {showChance && (
                  <TableCell align="right" sortDirection={sortBy === 'chance' ? 'desc' : false}>
                    <TableSortLabel
                      active={sortBy === 'chance'}
                      direction="desc"
                      onClick={() => setSortBy('chance')}
                    >
                      Chance
                    </TableSortLabel>
                  </TableCell>
                )}
                <TableCell align="right">Amount</TableCell>
                <TableCell align="right">Extended</TableCell>
                {showLocations && <TableCell>Location</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((a) => (
                <TableRow key={a.category} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <IconTile icon={category(a)?.icon ?? null} name={name(a)} size={32} />
                      <Link
                        component={RouterLink}
                        to={categoryPath(categorySlug(a.category), master.key)}
                        underline="hover"
                        sx={{ fontWeight: 500 }}
                      >
                        {name(a)}
                      </Link>
                    </Box>
                  </TableCell>
                  <TableCell align="right">{a.weight}</TableCell>
                  {showChance && (
                    <TableCell align="right">
                      {((a.weight / table.totalWeight) * 100).toFixed(1)}%
                    </TableCell>
                  )}
                  <TableCell align="right">{amount(a.amount)}</TableCell>
                  <TableCell align="right">{amount(a.extended)}</TableCell>
                  {showLocations && (
                    <TableCell>{a.locations.map(placeName).join(', ') || '—'}</TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </>
  );
}
