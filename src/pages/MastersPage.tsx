import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';

import { Link } from 'react-router';

import { getMasters } from '@/data/masters';
import { masterPath } from '@/paths';

/** /masters — every Slayer master. */
export function MastersPage() {
  return (
    <>
      <Typography variant="h4" component="h1" gutterBottom>
        Slayer masters
      </Typography>
      <List aria-label="Slayer masters">
        {getMasters().map((master) => (
          <ListItem key={master.key} disablePadding>
            <ListItemButton component={Link} to={masterPath(master.key)}>
              <ListItemText primary={master.name} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </>
  );
}
