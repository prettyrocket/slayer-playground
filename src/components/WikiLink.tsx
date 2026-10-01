import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';

import { resolveUrl } from '@/api';

/** "Slayer task/Abyssal demons" -> https://oldschool.runescape.wiki/w/Slayer_task/Abyssal_demons */
function wikiUrl(page: string): string {
  const path = encodeURIComponent(page.replaceAll(' ', '_')).replaceAll('%2F', '/');
  return `https://oldschool.runescape.wiki/w/${path}`;
}

/** The in-game "Wiki" lookup button, linking to the wiki page a page's data comes from. */
export function WikiLink({ page }: { page: string }) {
  const label = `${page} on the OSRS Wiki`;

  return (
    <Tooltip title={label}>
      <IconButton
        href={wikiUrl(page)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
        sx={{ borderRadius: 1 }}
      >
        <Box component="img" src={resolveUrl('icons/wiki.png')} alt="" sx={{ display: 'block' }} />
      </IconButton>
    </Tooltip>
  );
}
