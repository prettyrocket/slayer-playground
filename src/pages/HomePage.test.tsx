import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderRoute } from '@/test/render';

describe('HomePage', () => {
  it('filters the category list by name', async () => {
    const { user } = renderRoute('/');
    const list = await within(screen.getByRole('main')).findByRole('list', {
      name: 'Categories',
    });
    expect(list).toHaveTextContent('Abyssal demons');

    await user.type(screen.getByRole('searchbox', { name: 'Search tasks' }), 'zzz');
    expect(screen.getByText(/No categories match/)).toBeInTheDocument();
  });

  it('finds categories by monster and alias, and says why', async () => {
    const { user } = renderRoute('/');
    const search = screen.getByRole('searchbox', { name: 'Search tasks' });
    const results = async () =>
      within(await within(screen.getByRole('main')).findByRole('list', { name: 'Categories' }))
        .getAllByRole('link')
        .map((link) => link.textContent);

    await user.type(search, 'sire');
    expect(await results()).toEqual([
      'Abyssal demonsIncludes Abyssal Sire · Slayer 85',
      'BossesIncludes Abyssal Sire',
    ]);

    await user.clear(search);
    await user.type(search, 'dusties');
    expect(await results()).toEqual(['Dust devilsAlso called “dusties” · Slayer 65']);
  });

  it('shows each category’s Slayer level', async () => {
    renderRoute('/');
    const list = await within(screen.getByRole('main')).findByRole('list', {
      name: 'Categories',
    });
    expect(within(list).getByRole('link', { name: /Dust devils/ })).toHaveTextContent('Slayer 65');
  });

  it('keeps the search in the URL, so it can be linked', async () => {
    const { user, router } = renderRoute('/?q=dust');
    const search = screen.getByRole('searchbox', { name: 'Search tasks' });
    expect(search).toHaveValue('dust');
    const list = await within(screen.getByRole('main')).findByRole('list', {
      name: 'Categories',
    });
    expect(
      within(list)
        .getAllByRole('link')
        .map((l) => l.textContent),
    ).toEqual(['Dust devilsSlayer 65']);

    await user.clear(search);
    await user.type(search, 'cow');
    expect(router.state.location.search).toBe('?q=cow');
    await user.clear(search);
    expect(router.state.location.search).toBe('');
  });

  it('links to every Slayer master', async () => {
    const { user, router } = renderRoute('/');
    const masters = screen.getByRole('navigation', { name: 'Slayer masters' });
    expect(within(masters).getAllByRole('link')).toHaveLength(10);

    await user.click(within(masters).getByRole('link', { name: 'Duradel' }));
    expect(router.state.location.pathname).toBe('/masters/duradel');
  });
});
