import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderRoute } from '@/test/render';

// Data is src/test/monsters.ts: five categories, served by setup.ts.
/** Each task card, in order, by accessible name: what a screen reader announces for the link. */
const expectCards = async (names: string[]) => {
  const list = await within(screen.getByRole('main')).findByRole('list', { name: 'Categories' });
  const links = within(list).getAllByRole('link');
  expect(links.map((link) => link.textContent)).toHaveLength(names.length);
  links.forEach((link, i) => expect(link).toHaveAccessibleName(names[i]));
};

describe('HomePage', () => {
  it('lists every task as a card, grouped A–Z with letters to jump by', async () => {
    const { user } = renderRoute('/');
    await expectCards([
      'Abyssal demons Slayer 85 2 monsters Superior',
      'Bosses 1 monster Like a Boss',
      'Cows 1 monster',
      'Dust devils Slayer 65 1 monster Facemask',
      'Wilderness bosses 0 monsters',
    ]);
    // The tile shows the synced icon, from the site's own data folder.
    const tile = within(screen.getByRole('main')).getByRole('link', { name: /^Abyssal demons/ });
    expect(tile.querySelector('img[src="/data/icons/abyssal-demons.png"]')).not.toBeNull();
    // No count while browsing.
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    expect(screen.getByRole('heading', { level: 3, name: 'D' })).toBeInTheDocument();

    const letters = screen.getByRole('navigation', { name: 'Jump to letter' });
    const buttons = within(letters).getAllByRole('button');
    // Every letter; only the ones with tasks are enabled.
    expect(buttons).toHaveLength(26);
    expect(buttons.filter((b) => !b.hasAttribute('disabled')).map((b) => b.textContent)).toEqual([
      'A',
      'B',
      'C',
      'D',
      'W',
    ]);
    expect(within(letters).getByRole('button', { name: 'Jump to E' })).toBeDisabled();
    // Jumping scrolls without changing the URL (jsdom can't scroll; it mustn't throw).
    await user.click(within(letters).getByRole('button', { name: 'Jump to D' }));
  });

  it('finds tasks by monster and alias, and says why', async () => {
    const { user } = renderRoute('/');
    const search = screen.getByRole('searchbox', { name: 'Search tasks' });

    await user.type(search, 'sire');
    await expectCards([
      'Abyssal demons Slayer 85 2 monsters Includes Abyssal Sire Superior',
      'Bosses 1 monster Includes Abyssal Sire Like a Boss',
    ]);
    expect(screen.getByRole('status')).toHaveTextContent('2 tasks match “sire”');
    // Results only: no letter groups, no masters.
    expect(screen.queryByRole('navigation', { name: 'Jump to letter' })).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Slayer masters' })).not.toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'dusties');
    await expectCards(['Dust devils Slayer 65 1 monster Also called “dusties” Facemask']);
    expect(screen.getByRole('status')).toHaveTextContent('1 task matches “dusties”');

    await user.clear(search);
    await user.type(search, 'zzz');
    expect(screen.getByRole('status')).toHaveTextContent('No tasks match “zzz”.');
    expect(
      within(screen.getByRole('main')).queryByRole('list', { name: 'Categories' }),
    ).not.toBeInTheDocument();
  });

  it('keeps the search in the URL, so it can be linked', async () => {
    const { user, router } = renderRoute('/?q=dust');
    const search = screen.getByRole('searchbox', { name: 'Search tasks' });
    expect(search).toHaveValue('dust');
    await expectCards(['Dust devils Slayer 65 1 monster Facemask']);

    await user.clear(search);
    await user.type(search, 'cow');
    expect(router.state.location.search).toBe('?q=cow');
    await user.clear(search);
    expect(router.state.location.search).toBe('');
  });

  it('links to every Slayer master, with how many tasks they give', async () => {
    const { user, router } = renderRoute('/');
    const masters = screen.getByRole('navigation', { name: 'Slayer masters' });
    expect(within(masters).getAllByRole('link')).toHaveLength(10);
    // Counts appear once the catalog loads.
    await within(masters).findByText('3 tasks');
    expect(within(masters).getByRole('link', { name: /^Duradel/ })).toHaveTextContent(
      'Duradel3 tasks',
    );
    expect(within(masters).getByRole('link', { name: /^Krystilia/ })).toHaveTextContent('1 task');

    await user.click(within(masters).getByRole('link', { name: /^Duradel/ }));
    expect(router.state.location.pathname).toBe('/masters/duradel');
  });
});
