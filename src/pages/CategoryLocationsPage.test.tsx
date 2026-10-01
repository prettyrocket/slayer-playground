import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderRoute } from '@/test/render';

// Data is src/test/monsters.ts, served by setup.ts: the abyssal demon spawns in
// the Catacombs (multicombat, 13 spawns, level 124) and the Abyssal Area (no
// details); the Sire has no place.

/** The location cards' names, in order. */
async function cards() {
  const main = screen.getByRole('main');
  await within(main).findAllByRole('region');
  return within(main)
    .getAllByRole('region')
    .map((card) => card.getAttribute('aria-label'));
}

const card = (name: string) => screen.getByRole('region', { name });

describe('CategoryLocationsPage', () => {
  it('gives each location a card, most spawns first, then monsters with no place', async () => {
    renderRoute('/categories/abyssal-demons/locations');
    expect(await cards()).toEqual(['Catacombs of Kourend', 'Abyssal Area', '—']);
    expect(screen.getByRole('heading', { level: 1, name: 'Abyssal demons' })).toBeInTheDocument();
    expect(screen.getByText('2 locations')).toBeInTheDocument();
    expect(within(card('—')).getByRole('link', { name: 'Abyssal Sire' })).toBeInTheDocument();
  });

  it('shows each monster as a card: its level and spawns there, Slayer level and XP', async () => {
    renderRoute('/categories/abyssal-demons/locations');
    await cards();
    expect(
      within(card('Catacombs of Kourend')).getByText('Level 124 · 13 spawns · Slayer 85 · 150 XP'),
    ).toBeInTheDocument();
    // No level or spawns given there.
    expect(within(card('Abyssal Area')).getByText('Slayer 85 · 150 XP')).toBeInTheDocument();
  });

  it("shows a place's facts as icons", async () => {
    renderRoute('/categories/abyssal-demons/locations');
    await cards();
    const catacombs = card('Catacombs of Kourend');
    expect(within(catacombs).getByRole('img', { name: 'Multicombat' })).toBeInTheDocument();
    expect(within(catacombs).queryByRole('img', { name: 'Cannon' })).not.toBeInTheDocument();
  });

  it('names the superior once, above the cards', async () => {
    renderRoute('/categories/abyssal-demons/locations?master=duradel');
    await cards();
    expect(screen.getByText(/^Superior:/)).toHaveTextContent('Superior: Greater abyssal demon');
    expect(screen.getByRole('link', { name: 'Greater abyssal demon' })).toHaveAttribute(
      'href',
      '/monsters/greater-abyssal-demon?category=abyssal-demons&master=duradel',
    );
    expect(within(card('Catacombs of Kourend')).queryByText(/Superior/)).not.toBeInTheDocument();
  });

  it('keeps only places with the chosen facts', async () => {
    const { user } = renderRoute('/categories/abyssal-demons/locations');
    await cards();
    await user.click(screen.getByRole('button', { name: 'Multicombat' }));
    expect(await cards()).toEqual(['Catacombs of Kourend']);
    await user.click(screen.getByRole('button', { name: 'Cannon' }));
    expect(within(screen.getByRole('main')).queryAllByRole('region')).toHaveLength(0);
  });

  it("shows only the master's places, with the rest folded away and faded", async () => {
    const { user } = renderRoute('/categories/abyssal-demons/locations?master=konar');
    expect(await cards()).toEqual(['Catacombs of Kourend']);
    expect(card('Catacombs of Kourend')).toHaveStyle({ opacity: '1' });
    // The Abyssal Area, and the Sire with no place.
    await user.click(screen.getByRole('button', { name: 'Other places (2)' }));
    expect(await cards()).toEqual(['Catacombs of Kourend', 'Abyssal Area', '—']);
    expect(card('Abyssal Area')).toHaveStyle({ opacity: '0.5' });
    expect(card('—')).toHaveStyle({ opacity: '0.5' });
  });

  it('folds nothing away off a master’s trail', async () => {
    renderRoute('/categories/abyssal-demons/locations?master=duradel');
    await cards();
    expect(screen.queryByRole('button', { name: /Other places/ })).not.toBeInTheDocument();
  });

  it('links places to the wiki and monsters to their page, keeping the category', async () => {
    renderRoute('/categories/abyssal-demons/locations?master=duradel');
    await cards();
    const catacombs = card('Catacombs of Kourend');
    expect(within(catacombs).getByRole('link', { name: 'Catacombs of Kourend' })).toHaveAttribute(
      'href',
      'https://oldschool.runescape.wiki/w/Catacombs_of_Kourend',
    );
    expect(within(catacombs).getByRole('link', { name: 'Abyssal demon' })).toHaveAttribute(
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
