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
  it('lists places first, one row per monster there, with its level and spawns', async () => {
    renderRoute('/categories/abyssal-demons/locations');
    expect(await rows('Abyssal demons locations')).toEqual([
      ['Location', 'Monster', 'Level', 'Spawns', 'Slayer', 'Slayer XP'],
      ['Catacombs of Kourend', 'Abyssal demon', '124', '13', '85', '150'],
      ['Abyssal Area', 'Abyssal demon', '—', '—', '85', '150'],
      // No place on the wiki: last.
      ['—', 'Abyssal Sire', '—', '—', '85', '478'],
    ]);
    expect(screen.getByRole('heading', { level: 1, name: 'Abyssal demons' })).toBeInTheDocument();
    expect(screen.getByText('2 locations')).toBeInTheDocument();
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

  it("puts the master's places first and fades the rest", async () => {
    renderRoute('/categories/abyssal-demons/locations?master=konar');
    const table = await screen.findByRole('table', { name: 'Abyssal demons locations' });
    const [, catacombs, abyssalArea] = within(table).getAllByRole('row');
    expect(catacombs).toHaveTextContent('Catacombs of Kourend');
    expect(catacombs).toHaveStyle({ opacity: '1' });
    expect(abyssalArea).toHaveStyle({ opacity: '0.5' });
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
