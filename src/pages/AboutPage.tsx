import type { ReactNode } from 'react';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';

import { LICENSE_URL, WIKI_URL, useMeta, wikiUrl } from '@/data/meta';

const REPO_URL = 'https://github.com/prettyrocket/slayer-playground';

// The date in words, the same for every visitor ("29 September 2026").
const dateFormat = new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeZone: 'UTC' });

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box component="section" sx={{ mt: 3 }}>
      <Typography variant="h6" component="h2" gutterBottom>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

/** /about — where the data and images come from, and that this isn't a Jagex product. */
export function AboutPage() {
  const { data: meta } = useMeta();

  return (
    <>
      <Typography variant="h4" component="h1" gutterBottom>
        About
      </Typography>
      <Typography>
        Slayer Playground helps you find where and what to kill for an Old School RuneScape Slayer
        task.
      </Typography>

      <Section title="Data">
        <Typography sx={{ mb: 2 }}>
          Monster, drop and Slayer data comes from the{' '}
          <Link href={WIKI_URL}>Old School RuneScape Wiki</Link> and is used under{' '}
          <Link href={LICENSE_URL}>CC BY-NC-SA 3.0</Link>. The data files this site builds from it
          are shared under the same licence.
          {meta && ` Last updated ${dateFormat.format(new Date(meta.syncedAt))}.`}
        </Typography>
        {meta && (
          <>
            <Typography variant="subtitle2" component="h3">
              Source pages
            </Typography>
            <Box
              component="ul"
              aria-label="Source pages"
              sx={{ columns: { sm: 2 }, pl: 2.5, mt: 0.5, typography: 'body2' }}
            >
              {meta.sources.map((source) => (
                <li key={source}>
                  <Link href={wikiUrl(source)}>{source}</Link>
                </li>
              ))}
            </Box>
          </>
        )}
      </Section>

      <Section title="Images">
        <Typography>Game images are © Jagex Ltd, via the Old School RuneScape Wiki.</Typography>
      </Section>

      <Section title="Not affiliated with Jagex">
        <Typography>
          Slayer Playground is a fan project. It isn&apos;t affiliated with or endorsed by Jagex.
          Old School RuneScape and RuneScape are trademarks of Jagex Ltd.
        </Typography>
      </Section>

      <Section title="Source code">
        <Link href={REPO_URL}>{REPO_URL.replace('https://', '')}</Link>
      </Section>
    </>
  );
}
