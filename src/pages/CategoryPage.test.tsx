import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderRoute } from '@/test/render';

// Data is src/test/monsters.ts, served by setup.ts.

/** The table's rows: a cell reads as its first link's name when it has one, else its text. */
async function rows(name: string) {
  const table = await within(screen.getByRole('main')).findByRole('table', { name });
  return within(table)
    .getAllByRole('row')
    .map((row) =>
      within(row)
        .getAllByRole(row.closest('thead') ? 'columnheader' : 'cell')
        .map((cell) => {
          const link = within(cell).queryAllByRole('link')[0];
          return link ? (link.getAttribute('aria-label') ?? link.textContent) : cell.textContent;
        }),
    );
}

describe('CategoryPage', () => {
  it('lists the monsters that count, with levels, superiors and who assigns them', async () => {
    renderRoute('/categories/abyssal-demons');
    expect(await rows('Abyssal demons monsters')).toEqual([
      ['Monster', 'Combat', 'Slayer', 'Superior', 'Vannaka', 'Duradel'],
      // The superior shows on its base monster's row, not as a row of its own.
      [
        'Abyssal demon',
        '124',
        '85',
        'Greater abyssal demon',
        'Abyssal demon for Vannaka',
        'Abyssal demon for Duradel',
      ],
      // Vannaka's table doesn't count the Sire (a test exclusion): no check.
      ['Abyssal Sire', '116–350', '85', '', '', 'Abyssal Sire for Duradel'],
    ]);
    expect(screen.getByRole('heading', { level: 1, name: 'Abyssal demons' })).toBeInTheDocument();
    expect(screen.getByText('2 monsters')).toBeInTheDocument();
  });

  it("links a check to the monster on that master's trail", async () => {
    renderRoute('/categories/abyssal-demons');
    const table = await screen.findByRole('table', { name: 'Abyssal demons monsters' });
    expect(within(table).getByRole('link', { name: 'Abyssal demon for Duradel' })).toHaveAttribute(
      'href',
      '/monsters/abyssal-demon?category=abyssal-demons&master=duradel',
    );
    expect(within(table).getByRole('link', { name: 'Duradel' })).toHaveAttribute(
      'href',
      '/masters/duradel',
    );
  });

  it('highlights the master the user came from', async () => {
    renderRoute('/categories/abyssal-demons?master=duradel');
    const table = await screen.findByRole('table', { name: 'Abyssal demons monsters' });
    const duradel = within(table).getByRole('link', { name: 'Abyssal demon for Duradel' });
    const vannaka = within(table).getByRole('link', { name: 'Abyssal demon for Vannaka' });
    expect(getComputedStyle(duradel.closest('td')!).backgroundColor).not.toBe(
      getComputedStyle(vannaka.closest('td')!).backgroundColor,
    );
    // Monster links keep the master.
    expect(within(table).getByRole('link', { name: 'Abyssal Sire' })).toHaveAttribute(
      'href',
      '/monsters/abyssal-sire?category=abyssal-demons&master=duradel',
    );
  });

  it('sorts by combat level', async () => {
    const { user } = renderRoute('/categories/abyssal-demons');
    await rows('Abyssal demons monsters');
    await user.click(screen.getByRole('button', { name: 'Combat' }));
    expect((await rows('Abyssal demons monsters')).slice(1).map((r) => r[1])).toEqual([
      '116–350',
      '124',
    ]);
  });

  it('leaves out the superior column when no monster has one', async () => {
    renderRoute('/categories/dust-devils');
    const [header] = await rows('Dust devils monsters');
    expect(header).toEqual(['Monster', 'Combat', 'Slayer', 'Duradel']);
  });
});
