import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { MASTER_PAGES, parseMasterTable } from './masters.ts';
import { buildDrops, buildMonsters } from './normalize.ts';
import { parseEquipment, parseRewards, parseSuperiors, requiredUnlocks } from './parsers.ts';
import type { RawDrop, RawMonster } from './sources.ts';

/**
 * The parsers against real wiki responses, captured by scripts/update-fixtures.ts.
 * When the wiki changes its markup, refreshing the fixtures makes these fail
 * instead of the sync quietly writing bad data.
 */

const dir = path.join(import.meta.dirname, 'fixtures');
const page = (title: string) =>
  readFileSync(path.join(dir, 'wikitext', `${title.replace(/[/:]/g, '_')}.wiki`), 'utf8');
const json = <T>(file: string) => JSON.parse(readFileSync(path.join(dir, file), 'utf8')) as T;

describe('master tables', () => {
  // Parsed inside each test, so a page that stops parsing fails that master's test.
  // An unknown column (a rename) fails too, instead of emptying a field.
  const table = (key: string) => {
    const { page: title } = MASTER_PAGES.find((m) => m.key === key)!;
    return parseMasterTable(page(title), title, (warning) => {
      throw new Error(warning);
    });
  };
  const row = (key: string, name: string) => table(key).find((r) => r.name === name);

  // Counts and totals from the #4 spike, which matched slayer-calculator's data.
  it.each([
    ['turael', 24, 172],
    ['spria', 25, 178],
    ['mazchna', 30, 219],
    // The wiki's running total says 325: Cockatrice's weight is a bare 8, not {{+=}}.
    ['vannaka', 46, 333],
    ['chaeldar', 40, 360],
    ['konar', 39, 250],
    ['nieve', 46, 294],
    ['duradel', 43, 327],
    ['krystilia', 37, 196],
    ['mortimer', 29, 276],
  ])('%s: %i tasks, total weight %i', (key, tasks, total) => {
    const rows = table(key);
    expect(rows).toHaveLength(tasks);
    expect(rows.reduce((sum, r) => sum + r.weight, 0)).toBe(total);
    // Every row has an amount, a name and a link.
    expect(rows.filter((r) => !r.amount || !r.name || !r.link)).toEqual([]);
  });

  // How many rows fill each optional field, so a column or template the parser
  // stops reading fails here instead of quietly emptying the field. Slayer
  // levels were checked against the {{SCP|Slayer}} rows in the wikitext; the
  // few extra there are levels for one alternative (Brutal black dragon 77).
  it.each([
    ['turael', { slayer: 6, extended: 0, requirements: 18, alternatives: 18, locations: 0 }],
    ['spria', { slayer: 6, extended: 0, requirements: 20, alternatives: 18, locations: 0 }],
    ['mazchna', { slayer: 13, extended: 1, requirements: 30, alternatives: 18, locations: 0 }],
    ['vannaka', { slayer: 22, extended: 11, requirements: 45, alternatives: 29, locations: 0 }],
    ['chaeldar', { slayer: 23, extended: 19, requirements: 40, alternatives: 32, locations: 0 }],
    ['konar', { slayer: 21, extended: 19, requirements: 39, alternatives: 28, locations: 38 }],
    ['nieve', { slayer: 24, extended: 28, requirements: 46, alternatives: 34, locations: 0 }],
    ['duradel', { slayer: 21, extended: 26, requirements: 43, alternatives: 32, locations: 0 }],
    ['krystilia', { slayer: 6, extended: 11, requirements: 13, alternatives: 8, locations: 37 }],
    ['mortimer', { slayer: 29, extended: 14, requirements: 29, alternatives: 0, locations: 0 }],
  ])('%s: fields filled', (key, shape) => {
    const rows = table(key);
    expect({
      slayer: rows.filter((r) => r.slayerLevel !== null).length,
      extended: rows.filter((r) => r.extended).length,
      requirements: rows.filter((r) => r.requirements).length,
      alternatives: rows.filter((r) => r.alternatives.length > 0).length,
      locations: rows.filter((r) => r.locations.length > 0).length,
    }).toEqual(shape);
  });

  it("reads Konar's locations, alternatives and fixed amounts", () => {
    expect(row('konar', 'Aberrant spectres')).toEqual({
      name: 'Aberrant spectres',
      link: 'Aberrant spectre',
      weight: 6,
      amount: [120, 170],
      extended: [200, 250],
      slayerLevel: 60,
      combatLevel: 65,
      requirements: '60 Slayer, 65 Combat',
      // "*[[Catacombs of Kourend]]: [[Deviant spectre]]": the monster, not the place.
      alternatives: ['Deviant spectre'],
      excludes: [],
      locations: ['Catacombs of Kourend', 'Slayer Tower', 'Stronghold Slayer Cave'],
      wildernessLevels: null,
    });
    expect(row('konar', 'Ankou')?.amount).toEqual([50, 50]);
    // "*[[Fossil Island]]: [[Ancient Zygomite]] (completion of [[Bone Voyage]] required)"
    expect(row('konar', 'Mutated Zygomites')?.alternatives).toEqual(['Ancient Zygomite']);
  });

  it("reads Vannaka's bare weight, missing extends and task links", () => {
    expect(row('vannaka', 'Cockatrice')).toMatchObject({
      weight: 8,
      alternatives: ['Moonlight Cockatrice'],
    });
    expect(row('vannaka', 'Blue dragons')).toMatchObject({
      extended: null,
      alternatives: ['Baby blue dragon', 'Brutal blue dragon', 'Vorkath'],
      requirements: '65 Combat, partial completion of Dragon Slayer I',
    });
    expect(row('vannaka', 'Crabs')?.link).toBe('Slayer task/Crabs');
  });

  it("reads Krystilia's footnote requirements and merges her boss rows", () => {
    expect(row('krystilia', 'Ankou')).toMatchObject({
      locations: ['The Forgotten Cemetery', 'Wilderness Slayer Cave'],
      wildernessLevels: '27-31, 34-36',
    });
    // A reused footnote (<ref name=dragon />) still gives the requirement.
    expect(row('krystilia', 'Green dragons')?.requirements).toBe(
      'Only assigned to players who have started Dragon Slayer I.',
    );
    // "Also count" notes are alternatives, "do not count" notes exclusions;
    // neither is a requirement.
    expect(row('krystilia', 'Bears')).toMatchObject({
      requirements: null,
      alternatives: expect.arrayContaining(['Callisto', 'Artio']),
    });
    expect(row('krystilia', 'Black dragons')).toMatchObject({
      requirements: 'Only assigned to players who have started Dragon Slayer I.',
      excludes: ['King Black Dragon', 'Lava dragon'],
    });
    // Asides aren't locations: "(''Bring a [[lockpick]]!'')".
    expect(
      table('krystilia')
        .flatMap((r) => r.locations)
        .filter((l) => /lockpick/i.test(l)),
    ).toEqual([]);
    expect(row('krystilia', 'Wilderness bosses / demi-bosses')).toEqual({
      name: 'Wilderness bosses / demi-bosses',
      link: 'Wilderness boss',
      weight: 8,
      amount: [3, 35],
      extended: null,
      slayerLevel: null,
      combatLevel: null,
      requirements:
        'Only assigned to players who have unlocked Like a boss via spending 200 Slayer reward points.',
      alternatives: [
        'Callisto',
        'Artio',
        'Chaos Elemental',
        'Chaos Fanatic',
        'Crazy archaeologist',
        'Scorpia',
        'Venenatis',
        'Spindel',
        "Vet'ion",
        "Calvar'ion",
      ],
      excludes: [],
      locations: [
        'Demonic Ruins',
        "Rogues' Castle",
        'Lava Maze',
        'Ruins (west)',
        'Scorpion Pit',
        'Bone Yard',
      ],
      wildernessLevels: null,
    });
  });

  it("finds columns by name in Mortimer's and Turael's tables", () => {
    // Mortimer puts Weight before the requirement, and has modifier columns after it.
    expect(row('mortimer', 'Crawling hands')).toMatchObject({
      weight: 10,
      amount: [35, 50],
      extended: null,
      slayerLevel: 5,
    });
    // Turael's "Noteworthy alternative(s)" (bosses) count too; his farming
    // locations are advice, not locations.
    expect(row('turael', 'Bears')).toMatchObject({
      link: 'Slayer task/Bears',
      amount: [10, 20],
      combatLevel: 13,
      alternatives: [
        'Callisto',
        'Artio',
        'Grizzly bear cub',
        'Bear cub',
        'Grizzly bear',
        'Reanimated bear',
      ],
      locations: [],
    });
  });
});

describe('Superior slayer monster', () => {
  const superiors = () => parseSuperiors(page('Superior slayer monster'));

  it('maps every base monster, including rowspans', () => {
    expect(superiors().size).toBe(40);
    expect(superiors().get('Abyssal demon')).toBe('Greater abyssal demon');
    expect(superiors().get('Rock slug')).toBe('Giant rockslug');
    expect(superiors().get('Cockatrice')).toBe('Cockathrice');
    expect(superiors().get('Moonlight Cockatrice')).toBe('Cockathrice');
  });
});

describe('Slayer Rewards', () => {
  const rewards = () => parseRewards(page('Slayer Rewards'));
  const find = (name: string) => rewards().find((r) => r.name === name);

  it('reads the Unlock and Extend tables', () => {
    expect(rewards().filter((r) => r.kind === 'unlock')).toHaveLength(24);
    expect(rewards().filter((r) => r.kind === 'extend')).toHaveLength(29);
    expect(find('Watch the Birdie')).toMatchObject({ kind: 'unlock', cost: 80 });
    expect(find("'Shroom Sprayer")).toMatchObject({ kind: 'unlock', cost: 110 });
    expect(find('Augment my Abbies')).toEqual({
      name: 'Augment my Abbies',
      cost: 100,
      kind: 'extend',
      notes: 'Number of abyssal demons assigned is increased to 200-250.',
      links: ['Abyssal demon'],
    });
  });

  it("matches the masters' requirement texts to unlock names", () => {
    const nieve = parseMasterTable(page('Nieve/Slayer assignments'), 'Nieve');
    const krystilia = parseMasterTable(page('Krystilia'), 'Krystilia');
    const requirements = (rows: typeof nieve, name: string) =>
      rows.find((r) => r.name === name)?.requirements ?? '';
    expect(requiredUnlocks(requirements(nieve, 'Aquanites'), rewards())).toEqual(['Lured In']);
    expect(requiredUnlocks(requirements(nieve, 'Red dragons'), rewards())).toEqual(['Seeing Red']);
    expect(requiredUnlocks(requirements(krystilia, 'Aviansie'), rewards())).toEqual([
      'Watch the Birdie',
    ]);
    // A toggle, not a requirement.
    expect(requiredUnlocks(requirements(krystilia, 'Abyssal demons'), rewards())).toEqual([]);
  });

  it('resolves every unlock any master asks for', () => {
    const names = MASTER_PAGES.flatMap(({ page: title }) =>
      parseMasterTable(page(title), title).flatMap((r) =>
        requiredUnlocks(r.requirements ?? '', rewards()),
      ),
    );
    // A new wording ("unlocked via ... the X unlock") would drop this count or
    // come back as a name the Rewards page doesn't have.
    expect(names).toHaveLength(34);
    expect(names.filter((n) => !rewards().some((u) => u.name === n))).toEqual([]);
  });
});

describe('Slayer equipment', () => {
  const equipment = () => parseEquipment(page('Slayer equipment'));
  const uses = (item: string) => equipment().filter((e) => e.item === item);

  it('keeps uses tied to a monster, named by the linked item', () => {
    expect(equipment()).toHaveLength(28);
    expect(uses('Shayzien armour').map((e) => e.links)).toEqual([['Lizardman shaman']]);
    expect(uses('Earmuffs')).toEqual([
      { item: 'Earmuffs', use: 'Protecting against Banshees', links: ['Banshee'] },
    ]);
    // Shown as the lit lantern, next to a link to the unlit one.
    expect(uses('Lit bug lantern').map((e) => e.links)).toEqual([['Harpie Bug Swarm']]);
    expect(uses('Leaf-bladed battleaxe').map((e) => e.links)).toEqual([['Turoth', 'Kurask']]);
    expect(uses('Rock hammer').map((e) => e.links)).toEqual([['Gargoyle']]);
    // No monster: crafting and the like. (Boots for the Karuulm floor are kept
    // as "Protecting from ..." uses, but link only the dungeon.)
    expect(uses('Enchanted gem')).toEqual([]);
    expect(uses('Boots of stone').map((e) => e.links)).toEqual([['Karuulm Slayer Dungeon']]);
  });
});

describe('Bucket rows', () => {
  const rows = json<RawMonster[]>('infobox_monster.json');
  const dropRows = json<RawDrop[]>('dropsline.json');
  const drops = buildDrops(dropRows, new Set(['Abyssal demon', 'Dusk', 'Dawn']));
  const monsters = buildMonsters(rows, new Set(), new Set(drops.keys()));
  const monster = (page: string) => monsters.find((m) => m.page === page)!;

  it('keeps Slayer monsters with clean, uniquely labelled versions', () => {
    expect(monsters.map((m) => m.page)).toEqual([
      'Abyssal demon',
      'Bloodthirst rockslug',
      'Blue dragon',
      'Cow',
      'Dawn',
      'Doom of Mokhaiotl',
      'Dusk',
      'Grimy Lizard',
    ]);
    // The default each page flags (the builder always puts one first, so check which).
    expect(monsters.map((m) => [m.page, m.versions[0].version])).toEqual([
      ['Abyssal demon', 'Standard'],
      ['Bloodthirst rockslug', null],
      ['Blue dragon', '1'],
      ['Cow', '1'],
      ['Dawn', null],
      ['Doom of Mokhaiotl', 'Delve 1'],
      ['Dusk', 'First form'],
      ['Grimy Lizard', null],
    ]);
    // No markup survives anywhere.
    expect(JSON.stringify(monsters)).not.toMatch(/UNIQ|\x7f|<br|<sup|\[\[|\{\{|'''|&#/);
  });

  it('reads every field of a monster and its default version', () => {
    const { versions, ...abyssal } = monster('Abyssal demon');
    expect(abyssal).toEqual({
      slug: 'abyssal-demon',
      page: 'Abyssal demon',
      slayerLevel: 85,
      categories: ['abyssal demons'],
      assignedBy: ['vannaka', 'chaeldar', 'konar', 'nieve', 'duradel', 'krystilia', 'mortimer'],
      taskOnly: false,
      members: true,
      hasDrops: true,
      superior: null,
      superiorOf: [],
    });
    expect(versions[0]).toEqual({
      version: 'Standard',
      isDefault: true,
      name: 'Abyssal demon',
      image: 'Abyssal demon.png',
      npcIds: [415, 416],
      examine: 'A denizen of the Abyss!',
      combatLevel: 124,
      hitpoints: 150,
      maxHit: ['8'],
      attackStyles: ['Stab'],
      attackSpeed: 4,
      size: 1,
      attributes: ['demon'],
      slayerLevel: 85,
      slayerXp: 150,
      levels: { attack: 97, strength: 67, defence: 135, ranged: 1, magic: 1 },
      offence: { attack: 0, strength: 0, magic: 0, magicDamage: 0, ranged: 0, rangedStrength: 0 },
      // The wiki gives no single ranged defence, only light, standard and heavy.
      defence: {
        stab: 20,
        slash: 20,
        crush: 20,
        magic: 0,
        ranged: null,
        lightRanged: 20,
        standardRanged: 20,
        heavyRanged: 20,
      },
      weakness: null,
      immunities: {
        poison: '0',
        venom: '0',
        cannon: false,
        thrall: false,
        burn: null,
        freeze: null,
      },
    });
  });

  it('handles the quirks each page was picked for', () => {
    expect(monster('Abyssal demon').versions.map((v) => v.version)).toContain(
      'Catacombs of Kourend',
    );
    expect(monster('Blue dragon').versions.map((v) => v.version)).toContain(
      'Ruins of Tapoyauik, 1',
    );
    // The wiki spells it "Bloodthirst[sic] rockslug"; the note goes, the spelling stays.
    expect(monster('Bloodthirst rockslug').versions[0].name).toBe('Bloodthirst rockslug');
    // Two forms share "Delve 1" (both flagged default); the repeat is numbered.
    const delve1 = monster('Doom of Mokhaiotl').versions.filter((v) =>
      v.version?.startsWith('Delve 1'),
    );
    expect(delve1.map((v) => v.version).sort()).toEqual(['Delve 1', 'Delve 1 (2)']);
    expect(delve1.map((v) => v.maxHit)).toContainEqual(['47', '60 (charge)']);
    expect(monster('Dusk').versions.find((v) => v.version === 'Second form')!.maxHit).toEqual([
      '26 (melee)',
      '15x2 (ranged)',
      '65 (special attack)',
    ]);
    expect(monster('Grimy Lizard').categories).toEqual(['lizards']);
  });

  it('reads drops, including ones kept on another page', () => {
    const whip = drops.get('Abyssal demon')!.find((d) => d.item === 'Abyssal whip')!;
    expect(whip).toEqual({
      item: 'Abyssal whip',
      dropVersion: 'Standard',
      quantity: [1, 1],
      noted: false,
      rarity: '1/512',
      chance: 1 / 512,
      approx: false,
      rolls: 1,
      altRarity: null,
      value: 72000,
      type: 'combat',
    });
    // Noted drops and ranges come through too.
    expect(drops.get('Abyssal demon')!.filter((d) => d.noted).length).toBeGreaterThan(0);
    expect(drops.get('Abyssal demon')!.filter((d) => d.quantity === null)).toEqual([]);
    expect(new Set(drops.get('Abyssal demon')!.map((d) => d.dropVersion)).size).toBe(3);
    expect(drops.get('Dusk')).toEqual(drops.get('Dawn'));
    // Grotesque Guardians roll their table twice.
    expect(drops.get('Dusk')!.find((d) => d.item === 'Granite maul')).toMatchObject({
      rarity: '1/250',
      rolls: 2,
    });
    expect(monster('Dusk').hasDrops).toBe(true);
  });
});
