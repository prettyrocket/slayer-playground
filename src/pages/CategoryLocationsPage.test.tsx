import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderRoute } from '@/test/render';

// Data is src/test/monsters.ts, served by setup.ts: the abyssal demon spawns in
// the Catacombs (multicombat, 13 spawns, level 124) and the Abyssal Area (no
// details); the Sire has no place.

/**
 * The table's rows as text; a cell with a link reads as its first named-by-text
 * link (the place or monster, not a superior's picture, badge or caption).
 */
async function rows(name: string) {
  const table = await within(screen.getByRole('main')).findByRole('table', { name });
  return within(table)
    .getAllByRole('row')
    .map((row) =>
      within(row)
        .getAllByRole(row.closest('thead') ? 'columnheader' : 'cell')
        .map(
          (cell) =>
            (
              within(cell)
                .queryAllByRole('link')
                .find((link) => !link.hasAttribute('aria-label')) ?? cell
            ).textContent,
        ),
    );
}

const SUPERIOR = { name: 'Superior: Greater abyssal demon' };
const SUPERIOR_PATH = '/monsters/greater-abyssal-demon?category=abyssal-demons';

describe('CategoryLocationsPage', () => {
  it('lists places first, one row per monster there', async () => {
    renderRoute('/categories/abyssal-demons/locations');
    expect(await rows('Abyssal demons locations')).toEqual([
      ['Location', '', 'Monster'],
      ['Catacombs of Kourend', '', 'Abyssal demon'],
      ['Abyssal Area', '', 'Abyssal demon'],
      // No place on the wiki: last.
      ['—', '', 'Abyssal Sire'],
    ]);
    expect(screen.getByRole('heading', { level: 1, name: 'Abyssal demons' })).toBeInTheDocument();
  });

  it('shows each monster as a card: spawns, level there, Slayer level and XP', async () => {
    renderRoute('/categories/abyssal-demons/locations');
    const table = await screen.findByRole('table', { name: 'Abyssal demons locations' });
    const [, catacombs, abyssalArea] = within(table).getAllByRole('row');
    expect(within(catacombs).getByLabelText('13 spawns')).toHaveTextContent('×13');
    expect(within(catacombs).getByText('Lvl 124')).toBeInTheDocument();
    expect(within(catacombs).getByText('Slayer 85 · 150 XP')).toBeInTheDocument();
    // No level or spawns given there.
    expect(within(abyssalArea).queryByText(/^×/)).not.toBeInTheDocument();
    expect(within(abyssalArea).queryByText(/^Lvl/)).not.toBeInTheDocument();
  });

  it("puts the superior's picture on its base monster's card by default", async () => {
    renderRoute('/categories/abyssal-demons/locations');
    const table = await screen.findByRole('table', { name: 'Abyssal demons locations' });
    const [, catacombs, , sire] = within(table).getAllByRole('row');
    expect(within(catacombs).getByRole('link', SUPERIOR)).toHaveAttribute('href', SUPERIOR_PATH);
    // The Sire has no superior.
    expect(within(sire).queryByRole('link', { name: /^Superior/ })).not.toBeInTheDocument();
  });

  it('can show the superior as a badge instead', async () => {
    renderRoute('/categories/abyssal-demons/locations?superior=badge');
    const table = await screen.findByRole('table', { name: 'Abyssal demons locations' });
    const [, catacombs] = within(table).getAllByRole('row');
    expect(within(catacombs).getByRole('link', SUPERIOR)).toHaveAttribute('href', SUPERIOR_PATH);
  });

  it('can show the superior as a line instead', async () => {
    renderRoute('/categories/abyssal-demons/locations?superior=line');
    const table = await screen.findByRole('table', { name: 'Abyssal demons locations' });
    const [, catacombs] = within(table).getAllByRole('row');
    expect(within(catacombs).getByRole('link', { name: 'Greater abyssal demon' })).toHaveAttribute(
      'href',
      SUPERIOR_PATH,
    );
    expect(within(catacombs).getByText('Superior:', { exact: false })).toBeInTheDocument();
  });

  it("shows a place's facts as icons", async () => {
    renderRoute('/categories/abyssal-demons/locations');
    const table = await screen.findByRole('table', { name: 'Abyssal demons locations' });
    const [, catacombs] = within(table).getAllByRole('row');
    expect(within(catacombs).getByRole('img', { name: 'Multicombat' })).toBeInTheDocument();
    expect(within(catacombs).queryByRole('img', { name: 'Cannon' })).not.toBeInTheDocument();
  });

  it("shows only the master's places, with the rest folded away and faded", async () => {
    const { user } = renderRoute('/categories/abyssal-demons/locations?master=konar');
    expect((await rows('Abyssal demons locations')).map((r) => r[0])).toEqual([
      'Location',
      'Catacombs of Kourend',
      // The Abyssal Area, and the Sire with no place.
      'Other places (2)',
    ]);
    await user.click(screen.getByRole('button', { name: 'Other places (2)' }));
    const table = screen.getByRole('table', { name: 'Abyssal demons locations' });
    const [, catacombs, , abyssalArea, sire] = within(table).getAllByRole('row');
    expect(catacombs).toHaveStyle({ opacity: '1' });
    expect(abyssalArea).toHaveTextContent('Abyssal Area');
    expect(abyssalArea).toHaveStyle({ opacity: '0.5' });
    expect(sire).toHaveStyle({ opacity: '0.5' });
  });

  it('folds nothing away off a master’s trail', async () => {
    renderRoute('/categories/abyssal-demons/locations?master=duradel');
    await rows('Abyssal demons locations');
    expect(screen.queryByRole('button', { name: /Other places/ })).not.toBeInTheDocument();
  });

  it('links places to the wiki and monsters to their page, keeping the category', async () => {
    renderRoute('/categories/abyssal-demons/locations?master=duradel');
    const table = await screen.findByRole('table', { name: 'Abyssal demons locations' });
    expect(within(table).getByRole('link', { name: 'Catacombs of Kourend' })).toHaveAttribute(
      'href',
      'https://oldschool.runescape.wiki/w/Catacombs_of_Kourend',
    );
    expect(within(table).getAllByRole('link', { name: 'Abyssal demon' })[0]).toHaveAttribute(
      'href',
      '/monsters/abyssal-demon?category=abyssal-demons&master=duradel',
    );
  });

  it('is not found for an unknown category', async () => {
    renderRoute('/categories/nope/locations');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Page not found' }),
    ).toBeInTheDocument();
  });
});
