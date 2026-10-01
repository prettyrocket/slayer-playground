import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderRoute } from '@/test/render';

// Data is src/test/monsters.ts (the abyssal demon and its drops), served by setup.ts.

/** A stat panel (Combat, Aggressive, Defensive, Info) as label -> value. */
function panel(name: string) {
  const section = screen.getByRole('region', { name });
  const labels = within(section)
    .getAllByRole('term')
    .map((t) => t.textContent);
  const values = within(section)
    .getAllByRole('definition')
    .map((d) => d.textContent);
  return Object.fromEntries(labels.map((label, i) => [label, values[i]]));
}

/** A table's body rows as cell text. */
async function rows(name: string) {
  const table = await within(screen.getByRole('main')).findByRole('table', { name });
  return within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) =>
      within(row)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    );
}

describe('MonsterPage', () => {
  it('leads with what matters for the fight', async () => {
    renderRoute('/monsters/abyssal-demon');
    await screen.findByRole('region', { name: 'Fight' });
    expect(panel('Fight')).toEqual({
      'Protect from': 'Melee',
      'Max hit': '8',
      'Weak to fire': '20%',
      'Slayer level': '85',
      // Only immunities that apply: thralls, not the cannon.
      Thralls: 'Immune',
    });
    // The full stats wait behind "All stats".
    expect(screen.queryByRole('region', { name: 'Combat' })).not.toBeInTheDocument();
  });

  it("shows the default version's full stats in panels, leaving out the missing ones", async () => {
    const { user } = renderRoute('/monsters/abyssal-demon');
    await user.click(await screen.findByRole('button', { name: 'All stats' }));
    const heading = await screen.findByRole('heading', { level: 1, name: /^Abyssal demon/ });
    expect(heading).toHaveTextContent('(level 124)');
    expect(panel('Combat')).toEqual({
      Hitpoints: '150',
      Attack: '97',
      Strength: '67',
      Defence: '135',
      Magic: '1',
      Ranged: '1',
      Speed: '4 ticks (2.4s)',
      Style: 'Stab',
      'Max hit': '8',
    });
    // The fixture gives no offensive bonuses, so that panel is left out.
    expect(screen.queryByRole('region', { name: 'Aggressive' })).not.toBeInTheDocument();
    expect(panel('Defensive')).toEqual({
      Stab: '+20',
      Slash: '+20',
      Crush: '+20',
      Magic: '0',
      Fire: '20%',
      Light: '+20',
      Standard: '+20',
      Heavy: '+20',
    });
    expect(panel('Info')).toEqual({
      Size: '1×1',
      'Slayer level': '85',
      'Slayer XP': '150',
      Poison: '0',
      Venom: '0',
      Cannon: 'Not immune',
      Thrall: 'Immune',
      Freeze: '33%',
    });
  });

  it('links its superior', async () => {
    renderRoute('/monsters/abyssal-demon?category=abyssal-demons');
    expect(await screen.findByRole('link', { name: 'Greater abyssal demon' })).toHaveAttribute(
      'href',
      '/monsters/greater-abyssal-demon?category=abyssal-demons',
    );
  });

  it("shows the drops of the version's drop table, with quantity and rarity", async () => {
    renderRoute('/monsters/abyssal-demon');
    expect(await rows('Abyssal demon drops')).toEqual([
      ['Pure essence', '120–180 (noted)', '1/10'],
      ['Coins', 'Varies', 'Always'],
      ['Abyssal whip', '1', '1/512'],
    ]);
    const tables = screen.getByRole('tablist', { name: 'Drop tables' });
    expect(within(tables).getByRole('tab', { name: 'Standard' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it("switches version, and with it the version's drop table", async () => {
    const { user } = renderRoute('/monsters/abyssal-demon');
    await rows('Abyssal demon drops');
    const versions = screen.getByRole('tablist', { name: 'Versions' });
    await user.click(within(versions).getByRole('tab', { name: 'Catacombs of Kourend' }));
    // This version has only hitpoints; the Slayer level is the monster's.
    expect(panel('Fight')).toEqual({ 'Slayer level': '85' });
    expect(await rows('Abyssal demon drops')).toEqual([['Ancient shard', '1', '1/233']]);
  });

  it('switches drop table on its own', async () => {
    const { user } = renderRoute('/monsters/abyssal-demon');
    await rows('Abyssal demon drops');
    const tables = screen.getByRole('tablist', { name: 'Drop tables' });
    await user.click(within(tables).getByRole('tab', { name: 'Catacombs of Kourend' }));
    expect(await rows('Abyssal demon drops')).toEqual([['Ancient shard', '1', '1/233']]);
  });

  it('lists the tasks it counts for, keeping the master', async () => {
    renderRoute('/monsters/abyssal-sire?category=bosses&master=duradel');
    const counts = await screen.findByRole('list', { name: 'Counts for' });
    const links = within(counts).getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAccessibleName('Abyssal demons');
    expect(links[1]).toHaveAccessibleName('Bosses');
    expect(within(counts).getByRole('link', { name: 'Bosses' })).toHaveAttribute(
      'href',
      '/categories/bosses?master=duradel',
    );
  });

  it('lists where it spawns, linking places to the wiki', async () => {
    renderRoute('/monsters/abyssal-demon');
    expect(await rows('Abyssal demon locations')).toEqual([
      ['Catacombs of Kourend', '13', 'Yes', 'No', 'No'],
      ['Abyssal Area', '—', '—', '—', '—'],
    ]);
    expect(screen.getByRole('link', { name: 'Catacombs of Kourend' })).toHaveAttribute(
      'href',
      'https://oldschool.runescape.wiki/w/Catacombs_of_Kourend',
    );
  });

  it('has no locations section when the wiki gives none', async () => {
    renderRoute('/monsters/cow');
    await screen.findByText('No drops.');
    expect(screen.queryByRole('heading', { name: 'Locations' })).not.toBeInTheDocument();
  });

  it('links to its wiki page', async () => {
    renderRoute('/monsters/greater-abyssal-demon');
    expect(
      await screen.findByRole('link', { name: 'Greater abyssal demon on the OSRS Wiki' }),
    ).toHaveAttribute('href', 'https://oldschool.runescape.wiki/w/Greater_abyssal_demon');
  });

  it('says when a monster has no drops', async () => {
    renderRoute('/monsters/cow');
    expect(await screen.findByText('No drops.')).toBeInTheDocument();
  });
});
