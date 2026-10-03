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

const masterNames = (label: string) =>
  within(screen.getByRole('navigation', { name: label }))
    .getAllByRole('link')
    .map((link) => link.textContent);

const SUPERIOR = { name: 'Superior: Greater abyssal demon' };
const SUPERIOR_PATH = '/monsters/greater-abyssal-demon?category=abyssal-demons';

describe('CategoryPage', () => {
  it('lists places first, one row per monster there', async () => {
    renderRoute('/categories/abyssal-demons');
    expect(await rows('Abyssal demons locations')).toEqual([
      ['Location', '', 'Monster'],
      ['Catacombs of Kourend', '', 'Abyssal demon'],
      ['Abyssal Area', '', 'Abyssal demon'],
      // No place on the wiki: last.
      ['—', '', 'Abyssal Sire'],
    ]);
    expect(screen.getByRole('heading', { level: 1, name: 'Abyssal demons' })).toBeInTheDocument();
    // Superiors aren't counted: they show on their base monster's card.
    expect(screen.getByText('2 monsters')).toBeInTheDocument();
  });

  it('shows each monster as a card: spawns, level there, Slayer level and XP', async () => {
    renderRoute('/categories/abyssal-demons');
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
    renderRoute('/categories/abyssal-demons');
    const table = await screen.findByRole('table', { name: 'Abyssal demons locations' });
    const [, catacombs, , sire] = within(table).getAllByRole('row');
    expect(within(catacombs).getByRole('link', SUPERIOR)).toHaveAttribute('href', SUPERIOR_PATH);
    // The Sire has no superior.
    expect(within(sire).queryByRole('link', { name: /^Superior/ })).not.toBeInTheDocument();
  });

  it('can show the superior as a badge instead', async () => {
    renderRoute('/categories/abyssal-demons?superior=badge');
    const table = await screen.findByRole('table', { name: 'Abyssal demons locations' });
    const [, catacombs] = within(table).getAllByRole('row');
    expect(within(catacombs).getByRole('link', SUPERIOR)).toHaveAttribute('href', SUPERIOR_PATH);
  });

  it('can show the superior as a line instead', async () => {
    renderRoute('/categories/abyssal-demons?superior=line');
    const table = await screen.findByRole('table', { name: 'Abyssal demons locations' });
    const [, catacombs] = within(table).getAllByRole('row');
    expect(within(catacombs).getByRole('link', { name: 'Greater abyssal demon' })).toHaveAttribute(
      'href',
      SUPERIOR_PATH,
    );
    expect(within(catacombs).getByText('Superior:', { exact: false })).toBeInTheDocument();
  });

  it("shows a place's facts as icons: bright when yes, faded when no, none when unknown", async () => {
    renderRoute('/categories/abyssal-demons');
    const table = await screen.findByRole('table', { name: 'Abyssal demons locations' });
    const [, catacombs, abyssalArea] = within(table).getAllByRole('row');
    expect(
      within(catacombs)
        .getAllByRole('img', { name: /cannon|multicombat|safespot/i })
        .map((img) => img.getAttribute('aria-label')),
    ).toEqual(['Multicombat', 'No cannon', 'No safespot']);
    // The wiki says nothing about the Abyssal Area.
    expect(
      within(abyssalArea).queryAllByRole('img', { name: /cannon|multicombat|safespot/i }),
    ).toEqual([]);
  });

  it("shows only the master's places, with the rest folded away and faded", async () => {
    const { user } = renderRoute('/categories/abyssal-demons?master=konar');
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
    renderRoute('/categories/abyssal-demons?master=duradel');
    await rows('Abyssal demons locations');
    expect(screen.queryByRole('button', { name: /Other places/ })).not.toBeInTheDocument();
  });

  it('links places to the wiki and monsters to their page, keeping the category', async () => {
    renderRoute('/categories/abyssal-demons?master=duradel');
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

  it('says on the card what a monster needs', async () => {
    renderRoute('/categories/dust-devils');
    expect(await screen.findByText('Needs Facemask')).toBeInTheDocument();
  });

  it('shows who assigns it', async () => {
    renderRoute('/categories/abyssal-demons');
    await rows('Abyssal demons locations');
    expect(masterNames('Assigned by')).toEqual(['Vannaka', 'Konar quo Maten', 'Duradel']);
  });

  it('shows only the other masters when the user came from one', async () => {
    renderRoute('/categories/abyssal-demons?master=duradel');
    await rows('Abyssal demons locations');
    expect(masterNames('Also assigned by')).toEqual(['Vannaka', 'Konar quo Maten']);
  });

  it('has no masters section when no other master assigns it', async () => {
    renderRoute('/categories/dust-devils?master=duradel');
    await rows('Dust devils locations');
    expect(screen.queryByRole('heading', { name: /assigned by/i })).not.toBeInTheDocument();
  });

  it('shows the unlock that extends it, with its cost and note', async () => {
    renderRoute('/categories/abyssal-demons');
    const unlock = await screen.findByRole('listitem', { name: 'Augment my Abbies' });
    expect(unlock).toHaveTextContent('Extends it');
    expect(await within(unlock).findByText('100 points')).toBeInTheDocument();
    expect(unlock).toHaveTextContent('increased to 200-250');
  });

  it('shows the unlock it needs, and which masters need it', async () => {
    renderRoute('/categories/bosses');
    const unlock = await screen.findByRole('listitem', { name: 'Like a Boss' });
    expect(unlock).toHaveTextContent('Needed to get it');
    expect(await within(unlock).findByText('Needed for Duradel')).toBeInTheDocument();
    expect(await within(unlock).findByText('200 points')).toBeInTheDocument();
  });

  it('has no unlocks section when nothing unlocks or extends it', async () => {
    renderRoute('/categories/cows');
    await rows('Cows locations');
    expect(screen.queryByRole('heading', { name: 'Slayer unlocks' })).not.toBeInTheDocument();
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

  it('is not found for an unknown category', async () => {
    renderRoute('/categories/nope');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Page not found' }),
    ).toBeInTheDocument();
  });
});
