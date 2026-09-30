import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderRoute } from '@/test/render';

// Data is src/test/monsters.ts (the abyssal demon and its drops), served by setup.ts.

/** The stats grid as label -> value. */
function stats() {
  const labels = screen.getAllByRole('term').map((t) => t.textContent);
  const values = screen.getAllByRole('definition').map((d) => d.textContent);
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
  it("shows the default version's stats, leaving out the missing ones", async () => {
    renderRoute('/monsters/abyssal-demon');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Abyssal demon' }),
    ).toBeInTheDocument();
    expect(stats()).toEqual({
      'Combat level': '124',
      Hitpoints: '150',
      'Max hit': '8',
      'Attack style': 'Stab',
      'Attack speed': '4 ticks (2.4s)',
      Size: '1×1',
      'Slayer XP': '150',
      Weakness: 'Fire 20%',
      Poison: '0',
      Venom: '0',
      Cannon: 'Not immune',
      Thralls: 'Immune',
      Freeze: '33% resistance',
    });
    expect(await rows('Levels')).toEqual([['97', '67', '135', '1', '1']]);
    expect(await rows('Defence bonuses')).toEqual([['20', '20', '20', '0', '20', '20', '20']]);
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
    // This version has only a combat level and hitpoints.
    expect(stats()).toEqual({ 'Combat level': '124', Hitpoints: '150' });
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

  it('says when a monster has no drops', async () => {
    renderRoute('/monsters/cow');
    expect(await screen.findByText('No drops.')).toBeInTheDocument();
  });
});
