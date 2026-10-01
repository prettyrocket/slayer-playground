import { describe, expect, it } from 'vitest';

import type { Monster, MonsterVersion } from '../../src/data/types.ts';
import { applyViability, notOnTask } from './viability.ts';

const place = {
  name: 'Ungael',
  page: 'Ungael',
  levels: [732],
  spawns: 1,
  multicombat: null,
  cannon: null,
  safespot: null,
};

function monster(page: string, more: Partial<Monster> = {}): Monster {
  return {
    slug: page.toLowerCase(),
    page,
    slayerLevel: null,
    categories: ['abyssal demons'],
    assignedBy: [],
    taskOnly: false,
    members: true,
    hasDrops: false,
    icon: null,
    superior: null,
    superiorOf: [],
    versions: [],
    locations: [],
    ...more,
  };
}

const version = (label: string | null, isDefault = false) =>
  ({ version: label, isDefault }) as MonsterVersion;

describe('notOnTask', () => {
  it.each([
    ['Abyssal demon (Deadman)', [], 'another game mode or minigame'],
    ['Bloodthirsty kurask', ['Discontinued content'], 'removed from the game'],
    ['Definitely Not Dusk', ['Raging Echoes League'], 'Leagues only'],
    ['Giant goblin', ['Breach monsters', 'Goblins'], 'Deadman only'],
    ['Tz-Kih', ['TzHaar Fight Cave'], 'part of TzHaar Fight Cave'],
    ['Shade (Temple Trekking)', ['Temple Trekking'], 'another game mode or minigame'],
    ['Vanstrom Klause', ['Quest monsters'], 'a one-time quest fight'],
    ['Spawn of Sarachnis', ['Spiders'], 'summoned by Sarachnis'],
    ["Skeleton Hellhound (Vet'ion)", ['Wilderness'], 'summoned by Vet’ion'],
  ])('%s: %s', (page, categories, reason) => {
    expect(notOnTask(monster(page), categories)).toBe(reason);
  });

  it('keeps a quest monster the wiki maps places for, like Vorkath', () => {
    expect(notOnTask(monster('Vorkath', { locations: [place] }), ['Quest monsters'])).toBeNull();
  });

  it('keeps a minigame boss that is a task of its own, and a minigame monster with places', () => {
    expect(notOnTask(monster('TzTok-Jad'), ['TzHaar Fight Cave'])).toBeNull();
    expect(
      notOnTask(monster('Vampyre Juvinate', { locations: [place] }), ['Temple Trekking']),
    ).toBeNull();
  });

  it('keeps an ordinary monster', () => {
    expect(notOnTask(monster('Abyssal demon'), ['Demons', 'Slayer monsters'])).toBeNull();
  });
});

describe('applyViability', () => {
  it("empties the categories of monsters that can't be picked, and says why", () => {
    const monsters = [
      monster('Abyssal demon'),
      monster('Bloodthirsty abyssal demon'),
      monster('Reanimated abyssal'),
    ];
    const log = applyViability(
      monsters,
      new Map([['Bloodthirsty abyssal demon', ['Discontinued content']]]),
    );
    expect(monsters.map((m) => m.categories)).toEqual([['abyssal demons'], [], ['abyssal demons']]);
    expect(log).toEqual(['1 not on task (removed from the game): Bloodthirsty abyssal demon']);
  });

  it('drops quest versions, keeping post-quest ones and a default', () => {
    const vorkath = monster('Vorkath', {
      locations: [place],
      versions: [version('Dragon Slayer II', true), version('Post-quest')],
    });
    const rider = monster('Locust rider', {
      versions: [version('Lancer', true), version('Lancer (Quest)'), version('Ranger (Quest)')],
    });
    applyViability([vorkath, rider], new Map());
    expect(vorkath.versions).toEqual([version('Post-quest', true)]);
    expect(rider.versions).toEqual([version('Lancer', true)]);
  });

  it('keeps a page whose only version is a quest one', () => {
    const only = monster('Quest thing', { versions: [version('Quest', true)] });
    applyViability([only], new Map());
    expect(only.versions).toEqual([version('Quest', true)]);
  });
});
