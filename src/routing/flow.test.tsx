import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderRoute } from '@/test/render';

// Data is src/test/monsters.ts, served for data/monsters.json and
// data/categories.json by setup.ts.

/** The monster in each row of a category's table (the row's first link). */
async function monsterNames(table: string) {
  const rows = within(await screen.findByRole('table', { name: table })).getAllByRole('row');
  // Places first, a monster card per place it spawns: each monster once, by its name link
  // (not a superior's picture, which is named by aria-label).
  const names = rows
    .flatMap((row) => within(row).queryAllByRole('link'))
    .filter((link) => link.getAttribute('href')?.startsWith('/monsters/'))
    .filter((link) => !link.hasAttribute('aria-label'))
    .map((link) => link.textContent);
  return [...new Set(names)];
}
describe('flow between pages', () => {
  it('goes from the category list to a monster, remembering the category', async () => {
    const { user, router } = renderRoute('/');
    const main = screen.getByRole('main');

    // The list shows details under the name ("Slayer 85").
    await user.click(await within(main).findByRole('link', { name: /^Abyssal demons/ }));
    expect(router.state.location.pathname).toBe('/categories/abyssal-demons');

    // Its first card: the place with the most spawns.
    await user.click((await within(main).findAllByRole('link', { name: 'Abyssal demon' }))[0]);
    expect(router.state.location.pathname).toBe('/monsters/abyssal-demon');
    expect(router.state.location.search).toBe('?category=abyssal-demons');
  });

  it("lists a category's monsters and the masters who assign it", async () => {
    renderRoute('/categories/abyssal-demons');
    expect(await monsterNames('Abyssal demons locations')).toEqual([
      'Abyssal demon',
      'Abyssal Sire',
    ]);
    const main = screen.getByRole('main');
    expect(within(main).getByRole('link', { name: 'Vannaka' })).toHaveAttribute(
      'href',
      '/masters/vannaka',
    );
  });

  it('links a monster to every category it counts toward', async () => {
    renderRoute('/monsters/abyssal-sire');
    const main = screen.getByRole('main');
    expect(await within(main).findByRole('link', { name: 'Bosses' })).toHaveAttribute(
      'href',
      '/categories/bosses',
    );
    expect(within(main).getByRole('link', { name: 'Abyssal demons' })).toBeInTheDocument();
  });

  it("lists only a master's categories, with links that carry the master", async () => {
    renderRoute('/masters/duradel');
    const list = await within(screen.getByRole('main')).findByRole('table', {
      name: "Duradel's tasks",
    });
    expect(
      within(list)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Abyssal demons', 'Bosses', 'Dust devils']);
    expect(within(list).getByRole('link', { name: 'Bosses' })).toHaveAttribute(
      'href',
      '/categories/bosses?master=duradel',
    );
  });

  it('lists only the monsters that count, and categories no monster page has', async () => {
    renderRoute('/categories/bosses');
    expect(await monsterNames('Bosses locations')).toEqual(['Abyssal Sire']);

    renderRoute('/masters/krystilia');
    const list = await within(screen.getAllByRole('main').at(-1)!).findByRole('table', {
      name: "Krystilia's tasks",
    });
    expect(within(list).getByRole('link', { name: 'Wilderness bosses' })).toBeInTheDocument();
  });

  it("takes a category's masters from their tables, not from its monsters", async () => {
    // The Sire's assignedBy lists Vannaka, who assigns abyssal demons but not bosses.
    renderRoute('/categories/bosses');
    const main = screen.getByRole('main');
    expect(await within(main).findByRole('link', { name: 'Duradel' })).toBeInTheDocument();
    expect(within(main).queryByRole('link', { name: 'Vannaka' })).not.toBeInTheDocument();
  });

  it.each(['/categories/nope', '/monsters/nope', '/masters/nope'])(
    'shows not found for %s',
    async (path) => {
      renderRoute(path);
      expect(
        await screen.findByRole('heading', { level: 1, name: 'Page not found' }),
      ).toBeInTheDocument();
    },
  );
});
