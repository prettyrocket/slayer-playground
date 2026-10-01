import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderRoute } from '@/test/render';

// Data is src/test/monsters.ts, served by setup.ts: the abyssal demon spawns in
// the Catacombs (multicombat, 13 spawns, level 124) and the Abyssal Area (no
// details); the Sire has no place.

/** The table's rows as text; a cell with a link reads as its first link (not a picture or caption). */
async function rows(name: string) {
  const table = await within(screen.getByRole('main')).findByRole('table', { name });
  return within(table)
    .getAllByRole('row')
    .map((row) =>
      within(row)
        .getAllByRole(row.closest('thead') ? 'columnheader' : 'cell')
        .map((cell) => (within(cell).queryAllByRole('link')[0] ?? cell).textContent),
    );
}

describe('CategoryLocationsPage', () => {
  it('lists places first, one row per monster there, with its spawns', async () => {
    renderRoute('/categories/abyssal-demons/locations');
    expect(await rows('Abyssal demons locations')).toEqual([
      ['Location', '', 'Monster', 'Spawns'],
      ['Catacombs of Kourend', '', 'Abyssal demon', '13'],
      ['Abyssal Area', '', 'Abyssal demon', '—'],
      // No place on the wiki: last.
      ['—', '', 'Abyssal Sire', '—'],
    ]);
    expect(screen.getByRole('heading', { level: 1, name: 'Abyssal demons' })).toBeInTheDocument();
    expect(screen.getByText('2 locations')).toBeInTheDocument();
  });

  it('shows each monster as a card: its level there, Slayer level and XP', async () => {
    renderRoute('/categories/abyssal-demons/locations');
    const table = await screen.findByRole('table', { name: 'Abyssal demons locations' });
    const [, catacombs, abyssalArea] = within(table).getAllByRole('row');
    expect(within(catacombs).getByText('Level 124 · Slayer 85 · 150 XP')).toBeInTheDocument();
    // No level given there.
    expect(within(abyssalArea).getByText('Slayer 85 · 150 XP')).toBeInTheDocument();
  });

  it('names the superior once, above the table', async () => {
    renderRoute('/categories/abyssal-demons/locations?master=duradel');
    const table = await screen.findByRole('table', { name: 'Abyssal demons locations' });
    expect(screen.getByText(/^Superior:/)).toHaveTextContent('Superior: Greater abyssal demon');
    expect(screen.getByRole('link', { name: 'Greater abyssal demon' })).toHaveAttribute(
      'href',
      '/monsters/greater-abyssal-demon?category=abyssal-demons&master=duradel',
    );
    expect(within(table).queryByText(/Superior/)).not.toBeInTheDocument();
  });

  it("shows a place's facts as icons", async () => {
    renderRoute('/categories/abyssal-demons/locations');
    const table = await screen.findByRole('table', { name: 'Abyssal demons locations' });
    const [, catacombs] = within(table).getAllByRole('row');
    expect(within(catacombs).getByRole('img', { name: 'Multicombat' })).toBeInTheDocument();
    expect(within(catacombs).queryByRole('img', { name: 'Cannon' })).not.toBeInTheDocument();
  });

  it('keeps only places with the chosen facts', async () => {
    const { user } = renderRoute('/categories/abyssal-demons/locations');
    await rows('Abyssal demons locations');
    await user.click(screen.getByRole('button', { name: 'Multicombat' }));
    expect((await rows('Abyssal demons locations')).slice(1).map((r) => r[0])).toEqual([
      'Catacombs of Kourend',
    ]);
    await user.click(screen.getByRole('button', { name: 'Cannon' }));
    expect(await rows('Abyssal demons locations')).toHaveLength(1);
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
