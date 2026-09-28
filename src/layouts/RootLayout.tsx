import { useState } from 'react';

import MenuIcon from '@mui/icons-material/Menu';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';

import { Link, Outlet, useLocation } from 'react-router';

import { ColorModeToggle } from '@/components/ColorModeToggle';
import { LocationBreadcrumbs } from '@/components/LocationBreadcrumbs';
import { SideNav } from '@/components/SideNav';
import { navItems } from '@/routes';

const SIDE_NAV_WIDTH = 260;

export function RootLayout() {
  const { pathname } = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <AppBar position="sticky" enableColorOnDark>
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            aria-label="Open navigation"
            onClick={() => setDrawerOpen(true)}
            sx={{ mr: 1, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography
            variant="h6"
            component="span"
            sx={{ mr: 3, display: { xs: 'none', sm: 'block' } }}
          >
            {import.meta.env.VITE_APP_TITLE}
          </Typography>
          <Stack component="nav" direction="row" spacing={1} sx={{ flexGrow: 1 }}>
            {navItems.map(({ to, label }) => {
              const active = pathname === to;
              return (
                <Button
                  key={to}
                  component={Link}
                  to={to}
                  color="inherit"
                  aria-current={active ? 'page' : undefined}
                  // Tint follows the text color, so it shows on light and dark app bars.
                  sx={{
                    bgcolor: active
                      ? 'color-mix(in srgb, currentColor 15%, transparent)'
                      : undefined,
                  }}
                >
                  {label}
                </Button>
              );
            })}
          </Stack>
          <ColorModeToggle />
        </Toolbar>
      </AppBar>
      <Box sx={{ display: 'flex' }}>
        {/* Sticky beside the page on wide screens; a drawer from the menu button on narrow ones. */}
        <Box
          component="aside"
          sx={{
            display: { xs: 'none', md: 'block' },
            width: SIDE_NAV_WIDTH,
            flexShrink: 0,
            position: 'sticky',
            top: 64,
            height: 'calc(100vh - 64px)',
            overflowY: 'auto',
            borderRight: 1,
            borderColor: 'divider',
          }}
        >
          <SideNav />
        </Box>
        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          sx={{ display: { md: 'none' } }}
          slotProps={{ paper: { sx: { width: SIDE_NAV_WIDTH } } }}
        >
          <SideNav onNavigate={() => setDrawerOpen(false)} />
        </Drawer>
        <Container component="main" maxWidth="md" sx={{ py: 4, minWidth: 0 }}>
          <LocationBreadcrumbs />
          <Outlet />
        </Container>
      </Box>
    </>
  );
}
