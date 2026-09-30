import SearchIcon from '@mui/icons-material/Search';
import Box from '@mui/material/Box';
import InputBase from '@mui/material/InputBase';

import { useLocation, useNavigate, useSearchParams } from 'react-router';

/**
 * Task search in the app bar. Results show on Home, which reads the query from
 * `?q=`, so the URL is the only state: typing elsewhere goes to `/?q=…` (a new
 * history entry, so Back returns to where you were), and typing on Home
 * replaces the entry instead of adding one per keystroke.
 */
export function AppBarSearch() {
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const onHome = pathname === '/';
  const query = onHome ? (params.get('q') ?? '') : '';

  const search = (q: string) =>
    navigate(q ? `/?${new URLSearchParams({ q })}` : '/', { replace: onHome });

  return (
    <Box
      role="search"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1.5,
        width: { xs: '100%', sm: 320 },
        minWidth: 0,
        borderRadius: 2,
        // Tints follow the text color, so they show on light and dark app bars.
        bgcolor: 'color-mix(in srgb, currentColor 15%, transparent)',
        '&:hover, &:focus-within': {
          bgcolor: 'color-mix(in srgb, currentColor 25%, transparent)',
        },
      }}
    >
      <SearchIcon fontSize="small" sx={{ opacity: 0.8 }} />
      <InputBase
        type="search"
        placeholder="Search tasks or monsters…"
        value={query}
        onChange={(e) => search(e.target.value)}
        inputProps={{ 'aria-label': 'Search tasks' }}
        sx={{
          flex: 1,
          color: 'inherit',
          '& input::placeholder': { color: 'inherit', opacity: 0.7 },
        }}
      />
    </Box>
  );
}
