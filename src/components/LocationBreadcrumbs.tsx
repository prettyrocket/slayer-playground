import { useState } from 'react';

import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Popover from '@mui/material/Popover';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { Link as RouterLink } from 'react-router';

import { type Category, useCatalog } from '@/data/catalog';
import { type Master, getMasters } from '@/data/masters';
import type { Monster } from '@/data/types';
import { useNavLocation } from '@/hooks/useNavLocation';
import { categoryPath, masterPath, monsterPath } from '@/paths';

/** A crumb that opens a menu of the other items at its level. */
function SwitcherButton({
  label,
  isCurrent,
  onOpen,
}: {
  label: string;
  isCurrent: boolean;
  onOpen: (anchor: HTMLElement) => void;
}) {
  return (
    <Button
      size="small"
      color="inherit"
      endIcon={<ArrowDropDownIcon />}
      aria-haspopup="true"
      aria-current={isCurrent ? 'page' : undefined}
      onClick={(e) => onOpen(e.currentTarget)}
      sx={{ textTransform: 'none', fontSize: 'inherit', fontWeight: isCurrent ? 500 : 400 }}
    >
      {label}
    </Button>
  );
}

/**
 * Switches to another master's page, from anywhere on a master's trail: the
 * task came from the current master, and the next one may come from any master.
 */
function MasterSwitcher({ current, isCurrent }: { current: Master; isCurrent: boolean }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  return (
    <>
      <SwitcherButton label={current.name} isCurrent={isCurrent} onOpen={setAnchor} />
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        {getMasters().map((m) => (
          <MenuItem
            key={m.key}
            component={RouterLink}
            to={masterPath(m.key)}
            selected={m.key === current.key}
            onClick={() => setAnchor(null)}
          >
            {m.name}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

/**
 * Switches to another category: one the master assigns when on a master's
 * trail, otherwise any. There can be over 100, so this one has a filter box.
 */
function CategorySwitcher({
  current,
  isCurrent,
  master,
}: {
  current: Category;
  isCurrent: boolean;
  master?: Master;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [filter, setFilter] = useState('');
  const needle = filter.trim().toLowerCase();
  const { data: catalog } = useCatalog();
  const categories = (catalog?.categories ?? []).filter(
    (c) => c.name.toLowerCase().includes(needle) && (!master || c.masters.includes(master.key)),
  );
  const close = () => {
    setAnchor(null);
    setFilter('');
  };

  return (
    <>
      <SwitcherButton label={current.name} isCurrent={isCurrent} onOpen={setAnchor} />
      <Popover
        anchorEl={anchor}
        open={!!anchor}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <TextField
          type="search"
          placeholder="Switch category"
          slotProps={{ htmlInput: { 'aria-label': 'Switch category' } }}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          size="small"
          autoFocus
          sx={{ m: 1, width: 260 }}
        />
        <List dense sx={{ maxHeight: 360, overflow: 'auto', pt: 0 }} aria-label="Categories">
          {categories.map((c) => (
            <ListItemButton
              key={c.slug}
              component={RouterLink}
              to={categoryPath(c.slug, master?.key)}
              selected={c.slug === current.slug}
              onClick={close}
            >
              <ListItemText primary={c.name} />
            </ListItemButton>
          ))}
        </List>
      </Popover>
    </>
  );
}

/** Switches to another monster in the same category, keeping the trail. */
function MonsterSwitcher({
  current,
  category,
  master,
}: {
  current: Monster;
  category: Category;
  master?: Master;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <SwitcherButton label={current.page} isCurrent onOpen={setAnchor} />
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        {category.monsters.map((m) => (
          <MenuItem
            key={m.slug}
            component={RouterLink}
            to={monsterPath(m.slug, category.slug, master?.key)}
            selected={m.slug === current.slug}
            onClick={() => setAnchor(null)}
          >
            {m.page}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

/**
 * Breadcrumbs that follow how the user got here, e.g. Categories › Abyssal demons ▾,
 * or Masters › Vannaka ▾ › Abyssal demons ▾ › Abyssal demon.
 */
export function LocationBreadcrumbs() {
  const { section, category, master, monster } = useNavLocation();
  // Nothing above Home or the Categories and Masters pages, so no trail to show.
  if (!section || (!category && !master && !monster)) return null;

  const [sectionPath, sectionLabel] =
    section === 'categories' ? ['/categories', 'Categories'] : ['/masters', 'Masters'];

  return (
    <Breadcrumbs
      aria-label="Breadcrumb"
      sx={{ mb: 2, '& .MuiBreadcrumbs-li': { display: 'flex' } }}
    >
      <Link component={RouterLink} to={sectionPath} color="inherit" underline="hover">
        {sectionLabel}
      </Link>
      {master && <MasterSwitcher current={master} isCurrent={!category} />}
      {category && <CategorySwitcher current={category} isCurrent={!monster} master={master} />}
      {monster &&
        (category ? (
          <MonsterSwitcher current={monster} category={category} master={master} />
        ) : (
          <Typography color="text.primary" aria-current="page">
            {monster.page}
          </Typography>
        ))}
    </Breadcrumbs>
  );
}
