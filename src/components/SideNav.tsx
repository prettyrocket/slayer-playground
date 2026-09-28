import { type ReactNode, useEffect, useRef, useState } from 'react';

import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import TextField from '@mui/material/TextField';

import { Link } from 'react-router';

import { useCatalog } from '@/data/catalog';
import { getMasters } from '@/data/masters';
import { categoryPath, masterPath } from '@/routing/paths';
import { useNavLocation } from '@/routing/useNavLocation';

function SectionLink({
  to,
  label,
  current,
  onNavigate,
}: {
  to: string;
  label: string;
  current: boolean;
  onNavigate?: () => void;
}) {
  return (
    <ListItemButton
      component={Link}
      to={to}
      onClick={onNavigate}
      selected={current}
      aria-current={current ? 'page' : undefined}
    >
      <ListItemText primary={label} slotProps={{ primary: { sx: { fontWeight: 500 } } }} />
    </ListItemButton>
  );
}

/**
 * Icon buttons that sit on a highlighted row: no background of their own on
 * hover or click (the row shows that), just a darker icon, plus an outline for
 * keyboard focus.
 */
const QUIET_ICON_BUTTON = {
  color: 'text.secondary',
  '&:hover': { bgcolor: 'transparent', color: 'text.primary' },
  '&.Mui-focusVisible': { outline: 2, outlineColor: 'primary.main', outlineOffset: -2 },
} as const;

/**
 * Stays at the top of the side nav while its section is in view; the next
 * section's header pushes it out.
 */
function StickyHeader({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 1,
        bgcolor: 'background.paper',
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      {children}
    </Box>
  );
}

/** Every master and every category, with the ones on the current trail highlighted. */
export function SideNav({ onNavigate }: { onNavigate?: () => void }) {
  const { section, category, master } = useNavLocation();
  // The Categories heading turns into the filter box while filtering.
  const [filtering, setFiltering] = useState(false);
  const [filter, setFilter] = useState('');
  const categoriesCurrent = section === 'categories' && !category;
  const closeFilter = () => {
    setFiltering(false);
    setFilter('');
  };
  const needle = filter.trim().toLowerCase();
  const { data: catalog } = useCatalog();
  const categories = (catalog?.categories ?? []).filter((c) =>
    c.name.toLowerCase().includes(needle),
  );
  const categoriesRef = useRef<HTMLUListElement>(null);

  // Keep the current category in view in the long list.
  useEffect(() => {
    categoriesRef.current
      ?.querySelector('[aria-current="page"]')
      ?.scrollIntoView?.({ block: 'nearest' });
  }, [category?.slug]);

  return (
    <nav aria-label="Browse">
      <section>
        <StickyHeader>
          <SectionLink
            to="/masters"
            label="Masters"
            current={section === 'masters' && !master}
            onNavigate={onNavigate}
          />
        </StickyHeader>
        <List dense disablePadding aria-label="Masters">
          {getMasters().map((m) => {
            const current = m.key === master?.key;
            return (
              <ListItemButton
                key={m.key}
                component={Link}
                to={masterPath(m.key)}
                onClick={onNavigate}
                // On a master's trail, the master is highlighted too, but the page is the category.
                selected={current}
                aria-current={current && !category ? 'page' : undefined}
                sx={{ pl: 4 }}
              >
                <ListItemText primary={m.name} />
              </ListItemButton>
            );
          })}
        </List>
      </section>
      <section>
        <StickyHeader>
          <Box
            sx={(theme) => ({
              display: 'flex',
              alignItems: 'stretch',
              // The row, not the link, carries the hover and selected highlight (in
              // ListItemButton's colors), so it spans the search button and filter box too.
              bgcolor: categoriesCurrent
                ? theme.alpha(
                    (theme.vars ?? theme).palette.primary.main,
                    (theme.vars ?? theme).palette.action.selectedOpacity,
                  )
                : undefined,
              '&:hover': {
                bgcolor: categoriesCurrent
                  ? theme.alpha(
                      (theme.vars ?? theme).palette.primary.main,
                      `${(theme.vars ?? theme).palette.action.selectedOpacity} + ${(theme.vars ?? theme).palette.action.hoverOpacity}`,
                    )
                  : 'action.hover',
              },
              '& .MuiListItemButton-root, & .MuiListItemButton-root:hover, & .MuiListItemButton-root.Mui-selected, & .MuiListItemButton-root.Mui-selected:hover':
                { bgcolor: 'transparent' },
            })}
          >
            {/* Baseline-aligned so "Categories" and the filter text sit on one line. */}
            <Box sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline' }}>
              <Box sx={{ flex: filtering ? 'none' : 1, display: 'flex' }}>
                <SectionLink
                  to="/categories"
                  label="Categories"
                  current={categoriesCurrent}
                  onNavigate={onNavigate}
                />
              </Box>
              {filtering && (
                <TextField
                  type="search"
                  placeholder="Filter…"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Escape') return;
                    // Close just the filter, not the drawer around the side nav on narrow screens.
                    e.stopPropagation();
                    closeFilter();
                  }}
                  size="small"
                  variant="standard"
                  autoFocus
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    // The close button below replaces the browser's own clear button.
                    '& input::-webkit-search-cancel-button': { display: 'none' },
                  }}
                  slotProps={{
                    htmlInput: { 'aria-label': 'Filter categories' },
                    // Match the list's text size (MUI inputs default to 16px).
                    input: { disableUnderline: true, sx: { typography: 'body2' } },
                  }}
                />
              )}
            </Box>
            {/* Search and close swap in the same spot, so the icon doesn't jump. */}
            <IconButton
              aria-label={filtering ? 'Close filter' : 'Filter categories'}
              onClick={filtering ? closeFilter : () => setFiltering(true)}
              disableRipple
              // Full row height and a wide target, not just the icon.
              sx={{ ...QUIET_ICON_BUTTON, width: 56, borderRadius: 0 }}
            >
              {filtering ? <CloseIcon fontSize="small" /> : <SearchIcon fontSize="small" />}
            </IconButton>
          </Box>
        </StickyHeader>
        <List dense disablePadding ref={categoriesRef} aria-label="Categories">
          {categories.map((c) => {
            const current = c.slug === category?.slug;
            return (
              <ListItemButton
                key={c.slug}
                component={Link}
                to={categoryPath(c.slug)}
                onClick={onNavigate}
                selected={current}
                aria-current={current ? 'page' : undefined}
                // Scroll clear of the sticky heading.
                sx={{ pl: 4, scrollMarginTop: 48 }}
              >
                <ListItemText primary={c.name} />
              </ListItemButton>
            );
          })}
        </List>
      </section>
    </nav>
  );
}
