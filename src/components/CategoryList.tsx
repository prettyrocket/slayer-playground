import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Typography from '@mui/material/Typography';

import { Link } from 'react-router';

import { CatalogStatus } from '@/components/CatalogStatus';
import { useCatalog } from '@/data/catalog';
import { type SearchResult, searchCategories } from '@/data/search';
import { categoryPath } from '@/routing/paths';

// How many matching monsters to name before "and N more".
const MONSTERS_SHOWN = 3;

/** Why a result matched, when it wasn't by name. */
function reason({ alias, monsters }: SearchResult): string | null {
  if (alias) return `Also called “${alias}”`;
  if (monsters.length === 0) return null;
  const shown = monsters.slice(0, MONSTERS_SHOWN).map((m) => m.page);
  const more = monsters.length - shown.length;
  return `Includes ${shown.join(', ')}${more > 0 ? ` and ${more} more` : ''}`;
}

const plural = (n: number, word: string, words = `${word}s`) => `${n} ${n === 1 ? word : words}`;

const letterId = (letter: string) => `tasks-${letter.toLowerCase()}`;

const ALPHABET = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];

function CategoryCard({ result }: { result: SearchResult }) {
  const { category } = result;
  const why = reason(result);
  return (
    <Card component="li" variant="outlined">
      <CardActionArea
        component={Link}
        to={categoryPath(category.slug)}
        sx={{ height: '100%', p: 1.5, display: 'flex', flexDirection: 'column' }}
      >
        <Box sx={{ width: '100%', flexGrow: 1 }}>
          <Typography component="span" sx={{ display: 'block', fontWeight: 600, lineHeight: 1.3 }}>
            {category.name}
          </Typography>
          {why && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {why}
            </Typography>
          )}
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ width: '100%', mt: 1 }}>
          {category.slayerLevel ? `Slayer ${category.slayerLevel}` : 'Any Slayer level'}
          {' · '}
          {category.masters.length > 0 ? plural(category.masters.length, 'master') : 'No master'}
        </Typography>
      </CardActionArea>
    </Card>
  );
}

/**
 * Every category matching `query` (by name, alias or monster; see
 * searchCategories) as a grid of cards. With no query, the cards are grouped
 * A–Z with a row of letters to jump by. `noun` is what the count calls them:
 * players say "task" on Home, the Categories page says "category".
 */
export function CategoryList({
  query,
  noun = ['task', 'tasks'],
}: {
  query: string;
  noun?: [string, string];
}) {
  const { data: catalog } = useCatalog();
  if (!catalog) return <CatalogStatus />;

  const results = searchCategories(catalog, query);
  const browsing = query.trim() === '';
  const present = new Set(results.map((r) => r.category.name[0].toUpperCase()));

  return (
    <>
      {/* Empty while browsing; kept in place so screen readers announce search results. */}
      <Typography role="status" color="text.secondary" sx={{ my: browsing ? 0 : 1.5 }}>
        {browsing
          ? null
          : results.length === 0
            ? `No ${noun[1]} match “${query}”.`
            : `${plural(results.length, ...noun)} match${results.length === 1 ? 'es' : ''} “${query}”`}
      </Typography>
      {browsing && (
        // Every letter, so the row never shifts; ones with no tasks are greyed out. One
        // line: the letters share the width, and a phone too narrow for them scrolls it.
        <Box
          component="nav"
          aria-label="Jump to letter"
          sx={{
            display: 'grid',
            gridTemplateColumns: `repeat(${ALPHABET.length}, minmax(24px, 1fr))`,
            gap: 0.5,
            overflowX: 'auto',
            mt: 1,
            mb: 3,
          }}
        >
          {ALPHABET.map((letter) => (
            <Button
              key={letter}
              variant="outlined"
              color="inherit"
              disabled={!present.has(letter)}
              aria-label={`Jump to ${letter}`}
              // Scroll without touching the URL, which holds the search.
              onClick={() =>
                document
                  .getElementById(letterId(letter))
                  ?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
              }
              sx={{
                minWidth: 0,
                width: '100%',
                height: 32,
                p: 0,
                borderColor: 'divider',
                color: 'text.secondary',
                '&:hover': { color: 'text.primary', borderColor: 'text.secondary' },
              }}
            >
              {letter}
            </Button>
          ))}
        </Box>
      )}
      {results.length > 0 && (
        <Box
          component="ul"
          aria-label="Categories"
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 1.5,
            listStyle: 'none',
            p: 0,
            m: 0,
          }}
        >
          {results.map((result, i) => {
            const letter = result.category.name[0].toUpperCase();
            const first = i === 0 || results[i - 1].category.name[0].toUpperCase() !== letter;
            return [
              browsing && first && (
                <Box
                  component="li"
                  key={`letter-${letter}`}
                  id={letterId(letter)}
                  // Full width, and clear of the sticky app bar when jumped to.
                  sx={{ gridColumn: '1 / -1', scrollMarginTop: 80, mt: i === 0 ? 0 : 1 }}
                >
                  <Typography variant="overline" component="h3" color="text.secondary">
                    {letter}
                  </Typography>
                </Box>
              ),
              <CategoryCard key={result.category.slug} result={result} />,
            ];
          })}
        </Box>
      )}
    </>
  );
}
