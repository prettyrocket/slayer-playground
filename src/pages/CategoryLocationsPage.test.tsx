import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderRoute } from '@/test/render';

// Data is src/test/monsters.ts, served by setup.ts.

/** The table's rows as text; a monster cell reads as its link's text (not its picture's). */
async function rows(name: string) {
  const table = await within(screen.getByRole('main')).findByRole('table', { name });
  return within(table)
    .getAllByRole('row')
    .map((row) =>
      within(row)
        .getAllByRole(row.closest('thead') ? 'columnheader' : 'cell')
        .map((cell, i) =>
          i === 0 ? (within(cell).queryAllByRole('link')[0] ?? cell).textContent : cell.textContent,
        ),
    );
}

describe('CategoryLocationsPage', () => {
  it('lists places first, with the monsters there and their level', async () => {
    renderRoute('/categories/abyssal-demons/locations');
    expect(await rows('Abyssal demons locations')).toEqual([
      ['Location', 'Level', 'Spawns', 'Multi', 'Cannon', 'Safespot', 'Slayer', 'Slayer XP'],
      ['Catacombs of Kourend', '', '13', 'Yes', 'No', 'No', ''],
      ['Abyssal demon', '124', '13', '', '85', '150'],
      ['Abyssal Area', '', '—', '—', '—', '—', ''],
      ['Abyssal demon', '—', '—', '', '85', '150'],
      // The Sire has no place on the wiki.
      ['Unknown location'],
      ['Abyssal Sire', '—', '—', '', '85', '478'],
    ]);
    expect(screen.getByRole('heading', { level: 1, name: 'Abyssal demons' })).toBeInTheDocument();
    expect(screen.getByText('2 locations')).toBeInTheDocument();
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
