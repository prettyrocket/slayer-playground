import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderRoute } from '@/test/render';

// Data is src/test/monsters.ts, served for data/monsters.json by setup.ts.
describe('flow between pages', () => {
  it('goes from the category list to a monster, remembering the category', async () => {
    const { user, router } = renderRoute('/');
    const main = screen.getByRole('main');

    await user.click(await within(main).findByRole('link', { name: 'Abyssal demons' }));
    expect(router.state.location.pathname).toBe('/categories/abyssal-demons');

    await user.click(within(main).getByRole('link', { name: 'Abyssal demon' }));
    expect(router.state.location.pathname).toBe('/monsters/abyssal-demon');
    expect(router.state.location.search).toBe('?category=abyssal-demons');
  });

  it("lists a category's monsters and the masters who assign it", async () => {
    renderRoute('/categories/abyssal-demons');
    const monsters = await screen.findByRole('list', { name: 'Monsters' });
    expect(
      within(monsters)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Abyssal demon', 'Abyssal Sire']);
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
    renderRoute('/masters/vannaka');
    const list = await within(screen.getByRole('main')).findByRole('list', {
      name: 'Categories',
    });
    expect(
      within(list)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Abyssal demons', 'Bosses']);
    expect(within(list).getByRole('link', { name: 'Bosses' })).toHaveAttribute(
      'href',
      '/categories/bosses?master=vannaka',
    );
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
