import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderRoute } from '@/test/render';

// Data is src/test/monsters.ts, served by setup.ts.

/** The table's rows: the monster cell reads as its link's text, the rest as text. */
async function rows(name: string) {
  const table = await within(screen.getByRole('main')).findByRole('table', { name });
  return within(table)
    .getAllByRole('row')
    .map((row) =>
      within(row)
        .getAllByRole(row.closest('thead') ? 'columnheader' : 'cell')
        .map((cell, i) =>
          i === 0 && !row.closest('thead')
            ? within(cell).getAllByRole('link')[0].textContent
            : cell.textContent,
        ),
    );
}

const masterNames = (label: string) =>
  within(screen.getByRole('navigation', { name: label }))
    .getAllByRole('link')
    .map((link) => link.textContent);

describe('CategoryPage', () => {
  it('compares the monsters that count on what decides the pick', async () => {
    renderRoute('/categories/abyssal-demons');
    expect(await rows('Abyssal demons monsters')).toEqual([
      ['Monster', 'Slayer', 'Slayer XP'],
      ['Abyssal demon', '85', '150'],
      ['Abyssal Sire', '85', '478'],
    ]);
    expect(screen.getByRole('heading', { level: 1, name: 'Abyssal demons' })).toBeInTheDocument();
    expect(screen.getByText('2 monsters')).toBeInTheDocument();
  });

  it('shows a superior under its base monster, not as a row', async () => {
    renderRoute('/categories/abyssal-demons?master=duradel');
    const table = await screen.findByRole('table', { name: 'Abyssal demons monsters' });
    expect(within(table).getByRole('link', { name: 'Greater abyssal demon' })).toHaveAttribute(
      'href',
      '/monsters/greater-abyssal-demon?category=abyssal-demons&master=duradel',
    );
    expect(within(table).getAllByRole('row')).toHaveLength(3);
  });

  it('sorts by Slayer XP, most first', async () => {
    const { user } = renderRoute('/categories/abyssal-demons');
    await rows('Abyssal demons monsters');
    await user.click(screen.getByRole('button', { name: 'Slayer XP' }));
    expect((await rows('Abyssal demons monsters')).slice(1).map((r) => r[0])).toEqual([
      'Abyssal Sire',
      'Abyssal demon',
    ]);
  });

  it('shows what a monster needs, only when some monster needs something', async () => {
    renderRoute('/categories/dust-devils');
    const [header, row] = await rows('Dust devils monsters');
    expect(header.at(-1)).toBe('Needs');
    expect(row.at(-1)).toBe('Facemask');
  });

  it('leaves out the Needs column when nothing needs anything', async () => {
    renderRoute('/categories/cows');
    const [cows] = await rows('Cows monsters');
    expect(cows).not.toContain('Needs');
  });

  it('shows who assigns it', async () => {
    renderRoute('/categories/abyssal-demons');
    await rows('Abyssal demons monsters');
    expect(masterNames('Assigned by')).toEqual(['Vannaka', 'Duradel']);
  });

  it('shows only the other masters when the user came from one', async () => {
    renderRoute('/categories/abyssal-demons?master=duradel');
    await screen.findAllByRole('table');
    expect(masterNames('Also assigned by')).toEqual(['Vannaka']);
  });

  it('has no masters section when no other master assigns it', async () => {
    renderRoute('/categories/dust-devils?master=duradel');
    await rows('Dust devils monsters');
    expect(screen.queryByRole('heading', { name: /assigned by/i })).not.toBeInTheDocument();
  });

  it('links to its Slayer task page on the wiki', async () => {
    renderRoute('/categories/abyssal-demons');
    expect(
      await screen.findByRole('link', { name: 'Slayer task/Abyssal demons on the OSRS Wiki' }),
    ).toHaveAttribute('href', 'https://oldschool.runescape.wiki/w/Slayer_task/Abyssal_demons');
  });

  it("disables the wiki link when there's no Slayer task page", async () => {
    renderRoute('/categories/bosses');
    const missing = await screen.findByLabelText('No Slayer task page on the OSRS Wiki');
    expect(within(missing).getByRole('button')).toBeDisabled();
    expect(screen.queryByRole('link', { name: /OSRS Wiki/ })).not.toBeInTheDocument();
  });
});
