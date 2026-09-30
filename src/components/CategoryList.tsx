import type { ReactElement } from 'react';

import BackpackOutlined from '@mui/icons-material/BackpackOutlined';
import LockOutlined from '@mui/icons-material/LockOutlined';
import StarRounded from '@mui/icons-material/StarRounded';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';

import { Link } from 'react-router';

import { CatalogStatus } from '@/components/CatalogStatus';
import { type Category, useCatalog } from '@/data/catalog';
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

// The Slayer skill icon, from the OSRS Wiki, served from public/ (never hotlinked).
const SLAYER_ICON = `${import.meta.env.BASE_URL}icons/slayer.png`;
// Synced data, including category icons (public/data/icons).
const DATA_URL = `${import.meta.env.BASE_URL}data/`;

/** A small badge on a card: what the task needs, or that a superior can spawn. */
function Badge({ icon, label, title }: { icon: ReactElement; label: string; title?: string }) {
  return (
    <Chip
      size="small"
      variant="outlined"
      icon={icon}
      label={label}
      title={title}
      sx={{ height: 22, borderColor: 'divider', '& .MuiChip-label': { px: 0.75 } }}
    />
  );
}

/** Items the task needs: the first, plus how many alternatives ("Leaf-bladed spear +4"). */
function itemsBadge(equipment: Category['equipment']) {
  const items = [...new Set(equipment.map((e) => e.item))];
  if (items.length === 0) return null;
  const label = items.length > 1 ? `${items[0]} +${items.length - 1}` : items[0];
  const title = equipment.map((e) => `${e.item}: ${e.use}`).join('\n');
  return <Badge icon={<BackpackOutlined />} label={label} title={title} />;
}

function CategoryCard({ result }: { result: SearchResult }) {
  const { category } = result;
  const why = reason(result);
  const items = itemsBadge(category.equipment);
  const badges = items || category.unlocks.length > 0 || category.superior;
  return (
    <Card component="li" variant="outlined">
      <CardActionArea
        component={Link}
        to={categoryPath(category.slug)}
        sx={{
          height: '100%',
          p: 1.5,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
        }}
      >
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
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
            {category.icon ? (
              // In-game icons are about 20-30px and stay at their own size; renders
              // (up to 64px) shrink to fit.
              <Box
                component="img"
                src={`${DATA_URL}${category.icon}`}
                alt=""
                loading="lazy"
                sx={{ maxWidth: 40, maxHeight: 40, objectFit: 'contain' }}
              />
            ) : (
              category.name[0]
            )}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              component="span"
              sx={{ display: 'block', fontWeight: 600, lineHeight: 1.3 }}
            >
              {category.name}
            </Typography>
            <Box
              sx={{
                mt: 0.25,
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                columnGap: 1,
                color: 'text.secondary',
                typography: 'body2',
              }}
            >
              {category.slayerLevel !== null && (
                <Box
                  component="span"
                  title="Slayer level required"
                  sx={{ display: 'inline-flex', alignItems: 'center', whiteSpace: 'pre' }}
                >
                  {/* Native size: pixel art blurs when scaled by an odd amount. The space
                      keeps "Slayer 85" apart for screen readers too. */}
                  <img src={SLAYER_ICON} alt="Slayer" width={23} height={24} />{' '}
                  {category.slayerLevel}
                </Box>
              )}
              <span>{plural(category.monsters.length, 'monster')}</span>
            </Box>
          </Box>
        </Box>
        {why && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {why}
          </Typography>
        )}
        {badges && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1.25 }}>
            {items}
            {category.unlocks.map((unlock) => (
              <Badge
                key={unlock}
                icon={<LockOutlined />}
                label={unlock}
                title={`Needs the ${unlock} unlock from the Slayer Rewards shop`}
              />
            ))}
            {category.superior && (
              <Badge
                icon={<StarRounded />}
                label="Superior"
                title="A superior can spawn on this task (Bigger and Badder unlock)"
              />
            )}
          </Box>
        )}
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
              <CategoryCard key={result.category.slug} result={result} />,
            ];
          })}
        </Box>
      )}
    </>
  );
}
