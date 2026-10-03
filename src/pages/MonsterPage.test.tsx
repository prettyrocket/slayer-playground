import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderRoute } from '@/test/render';

// Data is src/test/monsters.ts (the abyssal demon and its drops), served by setup.ts.

/** A stat panel (Fight, Combat, Aggressive, Defensive, Info) as label -> value. */
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

/** A location's band on the Drops tab: the button that folds it. */
function band(name: string) {
  return screen.getByRole('button', { name });
}

/** The page's Stats / Locations / Drops tabs. */
function tabs() {
  return within(screen.getByRole('tablist', { name: 'Monster' }));
}

describe('MonsterPage', () => {
  it('heads the page with its name, level and examine', async () => {
    renderRoute('/monsters/abyssal-demon');
    const heading = await screen.findByRole('heading', { level: 1, name: /^Abyssal demon/ });
    expect(heading).toHaveTextContent('(level 124)');
    expect(screen.getByText('A denizen of the Abyss!')).toBeInTheDocument();
  });

  it('opens on Stats, leading with what matters for the fight', async () => {
    renderRoute('/monsters/abyssal-demon');
    await screen.findByRole('region', { name: 'Fight' });
    expect(tabs().getByRole('tab', { name: 'Stats' })).toHaveAttribute('aria-selected', 'true');
    expect(panel('Fight')).toEqual({
      'Protect from': 'Melee',
      'Max hit': '8',
      'Weak to fire': '20%',
      'Slayer level': '85',
      // Only immunities that apply: thralls, not the cannon.
      Thralls: 'Immune',
    });
  });

  it("shows the default version's full stats in panels, leaving out the missing ones", async () => {
    renderRoute('/monsters/abyssal-demon');
    await screen.findByRole('region', { name: 'Combat' });
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

  it('keeps the tab in the URL, alongside how you got here', async () => {
    const { user, router } = renderRoute('/monsters/abyssal-demon?category=abyssal-demons');
    await screen.findByRole('region', { name: 'Fight' });
    await user.click(tabs().getByRole('tab', { name: 'Drops' }));
    expect(router.state.location.search).toBe('?category=abyssal-demons&tab=drops');
    await user.click(tabs().getByRole('tab', { name: 'Stats' }));
    expect(router.state.location.search).toBe('?category=abyssal-demons');
  });

  it("lays drops out in the wiki's tables, in its order, under a band per location", async () => {
    renderRoute('/monsters/abyssal-demon?tab=drops');
    expect(await rows('Weapons and armour drops')).toEqual([
      ['Abyssal whip', '1', '1/512'],
      ['Abyssal dagger', '1', '1/32,000'],
    ]);
    expect(await rows('Materials drops')).toEqual([['Pure essence', '120–180 (noted)', '5/128']]);
    expect(await rows('Coins drops')).toEqual([['Coins', 'Varies', '35/128']]);
    const main = band('Standard and Catacombs of Kourend');
    expect(main).toHaveAttribute('aria-expanded', 'true');
    // Sections in the wiki's order, each with how many drops it has.
    const region = screen.getByRole('region', { name: 'Standard and Catacombs of Kourend' });
    expect(
      within(region)
        .getAllByRole('heading', { level: 3 })
        .map((h) => h.textContent),
    ).toEqual(['100%1', 'Weapons and armour2', 'Materials1', 'Coins1', 'Catacombs tertiary1']);
  });

  it("starts the bands of locations it isn't picked for folded", async () => {
    const { user } = renderRoute('/monsters/abyssal-demon?tab=drops');
    await rows('Coins drops');
    const wild = band('Wilderness Slayer Cave');
    expect(wild).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('table', { name: 'Tertiary drops' })).not.toBeInTheDocument();
    await user.click(wild);
    expect(await rows('Tertiary drops')).toEqual([['Looting bag', '1', '1/3']]);
  });

  it('folds a band, and a table on its own', async () => {
    const { user } = renderRoute('/monsters/abyssal-demon?tab=drops');
    await rows('Coins drops');
    await user.click(screen.getByRole('button', { name: /^Coins/ }));
    await waitFor(() =>
      expect(screen.queryByRole('table', { name: 'Coins drops' })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('table', { name: 'Materials drops' })).toBeInTheDocument();
    await user.click(band('Standard and Catacombs of Kourend'));
    await waitFor(() =>
      expect(screen.queryByRole('table', { name: 'Materials drops' })).not.toBeInTheDocument(),
    );
  });

  it('switches version from the header, and with it the stats', async () => {
    const { user } = renderRoute('/monsters/abyssal-demon');
    await screen.findByRole('region', { name: 'Fight' });
    await user.click(screen.getByRole('combobox', { name: 'Version' }));
    await user.click(screen.getByRole('option', { name: 'Catacombs of Kourend' }));
    // This version has only hitpoints; the Slayer level is the monster's.
    expect(panel('Fight')).toEqual({ 'Slayer level': '85' });
  });

  it('has no version picker on the Drops tab, which shows every table', async () => {
    renderRoute('/monsters/abyssal-demon?tab=drops');
    await rows('Coins drops');
    expect(screen.queryByRole('combobox', { name: 'Version' })).not.toBeInTheDocument();
  });

  it('has no version picker for a single-version monster', async () => {
    renderRoute('/monsters/greater-abyssal-demon');
    await screen.findByRole('heading', { level: 1, name: /^Greater abyssal demon/ });
    expect(screen.queryByRole('combobox', { name: 'Version' })).not.toBeInTheDocument();
  });

  it('lists the tasks it counts for in the header, keeping the master', async () => {
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
    const { user } = renderRoute('/monsters/abyssal-demon');
    await user.click(await screen.findByRole('tab', { name: 'Locations' }));
    expect(await rows('Abyssal demon locations')).toEqual([
      ['Catacombs of Kourend', '13', 'Yes', 'No', 'No'],
      ['Abyssal Area', '—', '—', '—', '—'],
    ]);
    expect(screen.getByRole('link', { name: 'Catacombs of Kourend' })).toHaveAttribute(
      'href',
      'https://oldschool.runescape.wiki/w/Catacombs_of_Kourend',
    );
  });

  it('has no Locations tab when the wiki gives none, and falls back to Stats', async () => {
    renderRoute('/monsters/cow?tab=locations');
    await screen.findByRole('heading', { level: 1, name: /^Cow/ });
    expect(tabs().queryByRole('tab', { name: 'Locations' })).not.toBeInTheDocument();
    expect(tabs().getByRole('tab', { name: 'Stats' })).toHaveAttribute('aria-selected', 'true');
  });

  it('links to its wiki page', async () => {
    renderRoute('/monsters/greater-abyssal-demon');
    expect(
      await screen.findByRole('link', { name: 'Greater abyssal demon on the OSRS Wiki' }),
    ).toHaveAttribute('href', 'https://oldschool.runescape.wiki/w/Greater_abyssal_demon');
  });

  it("has no Counts for when it can't be picked for a task", async () => {
    renderRoute('/monsters/abyssal-sire-deadman');
    expect(
      await screen.findByRole('heading', { level: 1, name: /Abyssal Sire \(Deadman\)/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Counts for' })).not.toBeInTheDocument();
  });

  it('says when a monster has no drops', async () => {
    renderRoute('/monsters/cow?tab=drops');
    expect(await screen.findByText('No drops.')).toBeInTheDocument();
  });
});
