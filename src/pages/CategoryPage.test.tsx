import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderRoute } from '@/test/render';

// Data is src/test/monsters.ts, served by setup.ts.

/** The table's rows: a cell reads as its link's text when it has one (not the icon tile). */
async function rows(name: string) {
  const table = await within(screen.getByRole('main')).findByRole('table', { name });
  return within(table)
    .getAllByRole('row')
    .map((row) =>
      within(row)
        .getAllByRole(row.closest('thead') ? 'columnheader' : 'cell')
        .map((cell) => (within(cell).queryByRole('link') ?? cell).textContent),
    );
}

const masterNames = (label: string) =>
  within(screen.getByRole('navigation', { name: label }))
    .getAllByRole('link')
    .map((link) => link.textContent);

describe('CategoryPage', () => {
  it('lists the monsters that count, with levels and superiors', async () => {
    renderRoute('/categories/abyssal-demons');
    expect(await rows('Abyssal demons monsters')).toEqual([
      ['Monster', 'Combat', 'Slayer', 'Superior'],
      // The superior shows on its base monster's row, not as a row of its own.
      ['Abyssal demon', '124', '85', 'Greater abyssal demon'],
      ['Abyssal Sire', '116–350', '85', ''],
    ]);
    expect(screen.getByRole('heading', { level: 1, name: 'Abyssal demons' })).toBeInTheDocument();
    expect(screen.getByText('2 monsters')).toBeInTheDocument();
  });

  it('shows who assigns it, linking to their pages', async () => {
    renderRoute('/categories/abyssal-demons');
    await rows('Abyssal demons monsters');
    expect(masterNames('Assigned by')).toEqual(['Vannaka', 'Duradel']);
    expect(
      within(screen.getByRole('navigation', { name: 'Assigned by' })).getByRole('link', {
        name: 'Duradel',
      }),
    ).toHaveAttribute('href', '/masters/duradel');
  });

  it('shows the other masters when the user came from one, and keeps it in links', async () => {
    renderRoute('/categories/abyssal-demons?master=duradel');
    const table = await screen.findByRole('table', { name: 'Abyssal demons monsters' });
    expect(masterNames('Also assigned by')).toEqual(['Vannaka']);
    expect(screen.queryByRole('navigation', { name: 'Assigned by' })).not.toBeInTheDocument();
    expect(within(table).getByRole('link', { name: 'Abyssal Sire' })).toHaveAttribute(
      'href',
      '/monsters/abyssal-sire?category=abyssal-demons&master=duradel',
    );
  });

  it('has no masters section when no other master assigns it', async () => {
    renderRoute('/categories/dust-devils?master=duradel');
    await rows('Dust devils monsters');
    expect(screen.queryByRole('heading', { name: /assigned by/i })).not.toBeInTheDocument();
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
    expect(header).toEqual(['Monster', 'Combat', 'Slayer']);
  });
});
