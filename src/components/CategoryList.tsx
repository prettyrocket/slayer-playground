import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

import { CatalogStatus } from '@/components/CatalogStatus';
import { IconCard } from '@/components/IconCard';
import { useCatalog } from '@/data/catalog';
import { searchCategories } from '@/data/search';
import { categoryPath } from '@/routing/paths';

const plural = (n: number, word: string, words = `${word}s`) => `${n} ${n === 1 ? word : words}`;

const letterId = (letter: string) => `tasks-${letter.toLowerCase()}`;

const ALPHABET = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];

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
            gridTemplateColumns: `repeat(${ALPHABET.length}, minmax(20px, 1fr))`,
            // Fits one line down to about 570px wide; narrower (phones) scrolls.
            gap: '2px',
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
              <IconCard
                key={result.category.slug}
                to={categoryPath(result.category.slug)}
                name={result.category.name}
                icon={result.category.icon}
              />,
            ];
          })}
        </Box>
      )}
    </>
  );
}
