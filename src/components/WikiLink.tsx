import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';

import { resolveUrl } from '@/api';

/** "Slayer task/Abyssal demons" -> https://oldschool.runescape.wiki/w/Slayer_task/Abyssal_demons */
function wikiUrl(page: string): string {
  const path = encodeURIComponent(page.replaceAll(' ', '_')).replaceAll('%2F', '/');
  return `https://oldschool.runescape.wiki/w/${path}`;
}

/**
 * The in-game "Wiki" lookup button, linking to a page's wiki page. Without a
 * page it's disabled, and its tooltip says what's missing.
 */
export function WikiLink(props: { page: string } | { page: null; missing: string }) {
  const label = props.page === null ? props.missing : `${props.page} on the OSRS Wiki`;
  const icon = (
    <Box component="img" src={resolveUrl('icons/wiki.png')} alt="" sx={{ display: 'block' }} />
  );

  return (
    <Tooltip title={label}>
      {props.page === null ? (
        // A disabled button gets no pointer events, so the tooltip hangs on a wrapper.
        <Box component="span" tabIndex={0} aria-label={label} sx={{ display: 'inline-flex' }}>
          <IconButton disabled sx={{ borderRadius: 1, filter: 'grayscale(1)', opacity: 0.4 }}>
            {icon}
          </IconButton>
        </Box>
      ) : (
        <IconButton
          href={wikiUrl(props.page)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          sx={{ borderRadius: 1 }}
        >
          {icon}
        </IconButton>
      )}
    </Tooltip>
  );
}
