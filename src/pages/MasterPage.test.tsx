import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderRoute } from '@/test/render';

// Data is src/test/monsters.ts (mastersFixture), served by setup.ts.

/** The table's rows as cell text, header first; a task cell reads as its link (not the icon tile). */
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

describe('MasterPage', () => {
  it("shows the master's table with chance, amounts and extended amounts", async () => {
    renderRoute('/masters/duradel');
    expect(screen.getByRole('heading', { level: 1, name: 'Duradel' })).toBeInTheDocument();
    expect(await rows("Duradel's tasks")).toEqual([
      ['Task', 'Weight', 'Chance', 'Amount', 'Extended'],
      // Highest chance first; ties by name.
      ['Abyssal demons', '12', '40.0%', '130–200', '200–250'],
      ['Bosses', '12', '40.0%', '3–35', '—'],
      ['Dust devils', '6', '20.0%', '50', '—'],
    ]);
    expect(screen.getByText('3 tasks')).toBeInTheDocument();
  });

  it('sorts by task name', async () => {
    const { user } = renderRoute('/masters/duradel');
    await rows("Duradel's tasks");
    await user.click(screen.getByRole('button', { name: 'Task' }));
    expect((await rows("Duradel's tasks")).slice(1).map((r) => r[0])).toEqual([
      'Abyssal demons',
      'Bosses',
      'Dust devils',
    ]);
    await user.click(screen.getByRole('button', { name: /Chance/ }));
    expect((await rows("Duradel's tasks")).slice(1).map((r) => r[2])).toEqual([
      '40.0%',
      '40.0%',
      '20.0%',
    ]);
  });

  it("shows Konar's locations, without the wiki's disambiguators", async () => {
    renderRoute('/masters/konar');
    const [header, row] = await rows("Konar quo Maten's tasks");
    expect(header.at(-1)).toBe('Location');
    expect(row.at(-1)).toBe('Catacombs of Kourend, Troll Stronghold');
  });

  it("leaves out Mortimer's chances (he offers a choice of tasks)", async () => {
    renderRoute('/masters/mortimer');
    const [header] = await rows("Mortimer's tasks");
    expect(header).toEqual(['Task', 'Weight', 'Amount', 'Extended']);
  });

  it('links each task with the master as context', async () => {
    renderRoute('/masters/duradel');
    const table = await within(screen.getByRole('main')).findByRole('table');
    expect(within(table).getByRole('link', { name: 'Dust devils' })).toHaveAttribute(
      'href',
      '/categories/dust-devils?master=duradel',
    );
  });

  it('is not found for an unknown master', async () => {
    renderRoute('/masters/steve');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Page not found' }),
    ).toBeInTheDocument();
  });
});
