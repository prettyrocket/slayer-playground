import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderRoute } from '@/test/render';

// Data is src/test/monsters.ts, served for data/monsters.json and
// data/categories.json by setup.ts.

/** The breadcrumb, once the catalog has loaded. */
function findCrumbs() {
  return screen.findByRole('navigation', { name: 'Breadcrumb' });
}

describe('index pages', () => {
  it('opens the category and master indexes from the side nav', async () => {
    const { user } = renderRoute('/about');
    const side = screen.getByRole('navigation', { name: 'Browse' });
    await user.click(within(side).getByRole('link', { name: 'Masters' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Slayer masters' })).toBeInTheDocument();
    await user.click(within(side).getByRole('link', { name: 'Categories' }));
    expect(
      screen.getByRole('heading', { level: 1, name: 'Slayer categories' }),
    ).toBeInTheDocument();
  });
});

describe('breadcrumb', () => {
  it.each(['/', '/categories', '/masters'])('is not shown on %s', async (path) => {
    renderRoute(path);
    await screen.findAllByRole('link', { name: 'Abyssal demons' }); // catalog loaded
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).not.toBeInTheDocument();
  });

  it('shows a monster under the category it was chosen for', async () => {
    renderRoute('/monsters/abyssal-sire?category=bosses');
    expect(await findCrumbs()).toHaveTextContent('Categories/Bosses/Abyssal Sire');
  });

  it("falls back to the monster's first category", async () => {
    renderRoute('/monsters/abyssal-sire');
    expect(await findCrumbs()).toHaveTextContent('Categories/Abyssal demons/Abyssal Sire');
  });

  it('switches master', async () => {
    const { user, router } = renderRoute('/masters/mortimer');
    await user.click(within(await findCrumbs()).getByRole('button', { name: 'Mortimer' }));
    await user.click(screen.getByRole('menuitem', { name: 'Duradel' }));
    expect(router.state.location.pathname).toBe('/masters/duradel');
  });

  it('filters and switches category', async () => {
    const { user, router } = renderRoute('/categories/abyssal-demons');
    await user.click(within(await findCrumbs()).getByRole('button', { name: 'Abyssal demons' }));
    await user.type(screen.getByRole('searchbox', { name: 'Switch category' }), 'dust');
    await user.click(screen.getByRole('link', { name: 'Dust devils' }));
    expect(router.state.location.pathname).toBe('/categories/dust-devils');
  });

  it('switches monster within the category, keeping the trail', async () => {
    const { user, router } = renderRoute(
      '/monsters/abyssal-demon?category=abyssal-demons&master=vannaka',
    );
    await user.click(within(await findCrumbs()).getByRole('button', { name: 'Abyssal demon' }));
    await user.click(screen.getByRole('menuitem', { name: 'Abyssal Sire' }));
    expect(router.state.location.pathname).toBe('/monsters/abyssal-sire');
    expect(router.state.location.search).toBe('?category=abyssal-demons&master=vannaka');
  });
});

describe('master trail', () => {
  it('follows the master the user came from', async () => {
    const { user } = renderRoute('/masters/vannaka');
    const main = screen.getByRole('main');
    await user.click(await within(main).findByRole('link', { name: 'Abyssal demons' }));
    expect(await findCrumbs()).toHaveTextContent('Masters/Vannaka/Abyssal demons');

    await user.click(within(main).getByRole('link', { name: 'Abyssal demon' }));
    expect(await findCrumbs()).toHaveTextContent('Masters/Vannaka/Abyssal demons/Abyssal demon');
    const side = screen.getByRole('navigation', { name: 'Browse' });
    expect(within(side).getByRole('link', { name: 'Vannaka' })).toHaveClass('Mui-selected');
    expect(within(side).getByRole('link', { name: 'Abyssal demons' })).toHaveClass('Mui-selected');
  });

  it("ignores a master who doesn't assign the category", async () => {
    renderRoute('/categories/abyssal-demons?master=turael');
    expect(await findCrumbs()).toHaveTextContent('Categories/Abyssal demons');
  });

  it("switches to another master's page from further down the trail", async () => {
    const { user, router } = renderRoute('/monsters/abyssal-demon?master=vannaka');
    await user.click(within(await findCrumbs()).getByRole('button', { name: 'Vannaka' }));
    // Any master: the next task can come from someone who never assigns this category.
    await user.click(screen.getByRole('menuitem', { name: 'Mortimer' }));
    expect(router.state.location.pathname).toBe('/masters/mortimer');
  });

  it("offers only the master's categories in the category switcher", async () => {
    const { user } = renderRoute('/categories/abyssal-demons?master=duradel');
    await user.click(within(await findCrumbs()).getByRole('button', { name: 'Abyssal demons' }));
    const popover = screen
      .getByRole('searchbox', { name: 'Switch category' })
      .closest('.MuiPopover-paper') as HTMLElement;
    expect(
      within(popover)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Abyssal demons', 'Bosses', 'Dust devils']);
  });
});

describe('side nav', () => {
  it('marks the current master', () => {
    renderRoute('/masters/mortimer');
    const side = screen.getByRole('navigation', { name: 'Browse' });
    expect(within(side).getByRole('link', { name: 'Mortimer' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it("marks a monster's category", async () => {
    renderRoute('/monsters/abyssal-demon');
    const side = screen.getByRole('navigation', { name: 'Browse' });
    expect(await within(side).findByRole('link', { name: 'Abyssal demons' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('has no filter of its own; search is in the app bar', async () => {
    renderRoute('/about');
    const side = screen.getByRole('navigation', { name: 'Browse' });
    await within(side).findByRole('link', { name: 'Abyssal demons' });
    expect(within(side).queryByRole('searchbox')).not.toBeInTheDocument();
    expect(within(side).getByRole('link', { name: 'Categories' })).toBeInTheDocument();
  });
});

describe('app bar search', () => {
  it('searches from any page, showing results on Home', async () => {
    const { user, router } = renderRoute('/monsters/cow');
    const search = within(screen.getByRole('search')).getByRole('searchbox', {
      name: 'Search tasks',
    });
    await user.type(search, 'sire');
    expect(router.state.location.pathname).toBe('/');
    expect(router.state.location.search).toBe('?q=sire');
    expect(search).toHaveValue('sire');
    expect(
      await within(screen.getByRole('main')).findByRole('list', { name: 'Categories' }),
    ).toHaveTextContent('Abyssal demons');

    // One history entry for the whole search, so Back returns to the monster.
    router.navigate(-1);
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/monsters/cow'));
    await vi.waitFor(() => expect(search).toHaveValue(''));
  });
});
