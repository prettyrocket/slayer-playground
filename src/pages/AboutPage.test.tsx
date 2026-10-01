import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderRoute } from '@/test/render';

// Data is src/test/monsters.ts (metaFixture), served by setup.ts.
describe('AboutPage', () => {
  it('credits the wiki under its licence, with the sync date and source pages', async () => {
    renderRoute('/about');
    const main = screen.getByRole('main');
    expect(within(main).getByRole('link', { name: 'CC BY-NC-SA 3.0' })).toHaveAttribute(
      'href',
      'https://creativecommons.org/licenses/by-nc-sa/3.0/',
    );
    expect(await within(main).findByText(/Last updated 29 September 2026\./)).toBeInTheDocument();

    const sources = within(main).getByRole('list', { name: 'Source pages' });
    expect(within(sources).getByRole('link', { name: 'Nieve/Slayer assignments' })).toHaveAttribute(
      'href',
      'https://oldschool.runescape.wiki/w/Nieve/Slayer_assignments',
    );
    expect(within(sources).getAllByRole('link')).toHaveLength(3);
  });

  it('says images are Jagex’s and that this is not a Jagex product', () => {
    renderRoute('/about');
    expect(screen.getByText(/Game images are © Jagex Ltd/)).toBeInTheDocument();
    expect(screen.getByText(/isn't affiliated with or endorsed by Jagex/)).toBeInTheDocument();
  });
});

describe('footer', () => {
  it('credits the wiki and links to About on every page', async () => {
    const { user, router } = renderRoute('/categories');
    const footer = screen.getByRole('contentinfo');
    expect(footer).toHaveTextContent('Data from the Old School RuneScape Wiki (CC BY-NC-SA 3.0)');
    expect(footer).toHaveTextContent('Not affiliated with Jagex');
    await user.click(within(footer).getByRole('link', { name: 'About' }));
    expect(router.state.location.pathname).toBe('/about');
  });
});
