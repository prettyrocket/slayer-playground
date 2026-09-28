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

  it('links to every Slayer master', async () => {
    const { user, router } = renderRoute('/');
    const masters = screen.getByRole('navigation', { name: 'Slayer masters' });
    expect(within(masters).getAllByRole('link')).toHaveLength(10);

    await user.click(within(masters).getByRole('link', { name: 'Duradel' }));
    expect(router.state.location.pathname).toBe('/masters/duradel');
  });
});
