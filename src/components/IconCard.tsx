import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Typography from '@mui/material/Typography';

import { Link } from 'react-router';

/** Synced data, including icons (public/data/icons). */
const DATA_URL = `${import.meta.env.BASE_URL}data/`;

/**
 * A card in a grid list (render it inside a `<ul>`): a picture, then a name,
 * left-aligned, linking to `to`. `icon` is a path under public/data; without
 * one, the tile shows the name's first letter.
 */
export function IconCard({ to, name, icon }: { to: string; name: string; icon: string | null }) {
  return (
    <Card component="li" variant="outlined">
      <CardActionArea
        component={Link}
        to={to}
        // ButtonBase centres its content; cards read from the left.
        sx={{
          height: '100%',
          p: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          textAlign: 'left',
          gap: 1.5,
        }}
      >
        <Box
          aria-hidden
          sx={{
            width: 48,
            height: 48,
            flexShrink: 0,
            borderRadius: 1.5,
            bgcolor: 'action.hover',
            display: 'grid',
            placeItems: 'center',
            overflow: 'hidden',
            color: 'text.secondary',
            fontWeight: 600,
          }}
        >
          {icon ? (
            // In-game icons are about 20-30px and stay at their own size; renders
            // and chatheads (up to 64px) shrink to fit.
            <Box
              component="img"
              src={`${DATA_URL}${icon}`}
              alt=""
              loading="lazy"
              sx={{ maxWidth: 40, maxHeight: 40, objectFit: 'contain' }}
            />
          ) : (
            name[0]
          )}
        </Box>
        <Typography component="span" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
          {name}
        </Typography>
      </CardActionArea>
    </Card>
  );
}
