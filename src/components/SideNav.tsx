import { type ReactNode, useEffect, useRef } from 'react';

import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';

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
  const { data: catalog } = useCatalog();
  const categories = catalog?.categories ?? [];
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
          <SectionLink
            to="/categories"
            label="Categories"
            current={section === 'categories' && !category}
            onNavigate={onNavigate}
          />
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
