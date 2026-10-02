import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import type { Drop } from '../../src/data/types.ts';
import { addDropSections, parseDropSections } from './drop-sections.ts';
import { buildDrops } from './normalize.ts';
import type { RawDrop } from './sources.ts';

const drop = (item: string, dropVersion: string | null = null, rarity = '1/128'): Drop => ({
  item,
  dropVersion,
  quantity: [1, 1],
  noted: false,
  rarity,
  chance: null,
  approx: false,
  rolls: 1,
  altRarity: null,
  value: null,
  type: 'combat',
  group: null,
  section: null,
});

const where = (drops: Drop[]) => drops.map((d) => [d.group, d.section, d.item]);

describe('parseDropSections', () => {
  it('reads a === heading with no ==== under it as a section', () => {
    const sections = parseDropSections(`==Locations==
{{LocLine|location=Kourend|mapID=1}}
==Drops==
===100%===
{{DropsTableHead}}
{{DropsLine|name=Bones|quantity=1|rarity=Always}}
{{DropsTableBottom}}
===Tertiary===
{{DropsTableHead}}
{{DropsLineClue|type=hard|rarity=1/128}}
{{DropsLine|name=Ensouled head|quantity=1|rarity=1/25|raritynotes={{NamedRef|x}}}}
{{DropsTableBottom}}
==Trivia==`);
    expect(sections).toEqual([
      { group: null, section: '100%', lines: [{ item: 'Bones', version: null }], tables: [] },
      {
        group: null,
        section: 'Tertiary',
        lines: [
          { item: 'Clue scroll (hard)', version: null },
          { item: 'Ensouled head', version: null },
        ],
        tables: [],
      },
    ]);
  });

  it('reads a === heading with ==== under it as a group, and table templates', () => {
    const sections = parseDropSections(`==Drops==
===Wilderness Slayer Cave===
{{DropLogProject|kills=1}}
====Herbs====
{{HerbDropTableInfo|19/68}}
{{DropsTableHead|dropversion=Wild}}
{{HerbDropLines|19/68}}
{{DropsTableBottom}}
====Rare and Gem drop table====
{{RareDropTable|2/128|dropversion=Wild}}`);
    expect(sections).toEqual([
      {
        group: 'Wilderness Slayer Cave',
        section: 'Herbs',
        lines: [],
        tables: [{ template: 'HerbDropLines', version: 'Wild' }],
      },
      {
        group: 'Wilderness Slayer Cave',
        section: 'Rare and Gem drop table',
        lines: [],
        tables: [{ template: 'RareDropTable', version: 'Wild' }],
      },
    ]);
  });

  it('reads a "Level N drops" heading as a group', () => {
    const sections = parseDropSections(`==Level 99 drops==
===100%===
{{DropsLine|name=Big bones|quantity=1|rarity=Always}}`);
    expect(sections.map((s) => [s.group, s.section])).toEqual([['Level 99 drops', '100%']]);
  });

  it('reads any == section with drops in it, and drops above the first heading', () => {
    expect(
      parseDropSections(`{{DeadmanBreachDropTable}}
==Levels 81–100==
{{DropsTableHead|dropversion=High}}
{{DropsLine|name=Bones|quantity=1|rarity=Always}}
==Rewards==
===Weaponry===
{{DropsLineReward|name=Staff of air|quantity=1|rarity=1/256}}
==Trivia==`).map((s) => [s.group, s.section, s.lines, s.tables]),
    ).toEqual([
      [null, 'Drops', [], [{ template: 'DeadmanBreachDropTable', version: null }]],
      // The version a table head sets holds for the lines after it.
      ['Levels 81–100', 'Drops', [{ item: 'Bones', version: 'High' }], []],
      ['Rewards', 'Weaponry', [{ item: 'Staff of air', version: null }], []],
    ]);
  });

  it('is empty for a page without drops', () => {
    expect(parseDropSections('==Strategy==\nHit it.')).toEqual([]);
  });
});

describe('addDropSections', () => {
  const sections = parseDropSections(`==Drops==
===100%===
{{DropsLine|name=Bones|quantity=1|rarity=Always}}
===Herbs===
{{HerbDropLines|1/10}}
===Tertiary===
{{DropsLine|name=Ensouled head|quantity=1|rarity=1/25}}`);

  it('files rows under their lines, and rows between lines under the table template there', () => {
    const drops = [
      drop('Bones'),
      drop('Grimy guam leaf'),
      drop('Grimy ranarr weed'),
      drop('Ensouled head'),
    ];
    expect(where(addDropSections(drops, sections))).toEqual([
      [null, '100%', 'Bones'],
      [null, 'Herbs', 'Grimy guam leaf'],
      [null, 'Herbs', 'Grimy ranarr weed'],
      [null, 'Tertiary', 'Ensouled head'],
    ]);
  });

  it('walks past lines Bucket has no row for, like "Nothing"', () => {
    const withNothing = parseDropSections(`==Drops==
===Other===
{{DropsLine|name=Coins|quantity=5|rarity=7/100}}
{{DropsLine|name=Nothing|quantity=N/A|rarity=1/10}}
===Herbs===
{{HerbDropLines|35/100}}`);
    expect(where(addDropSections([drop('Coins'), drop('Grimy guam leaf')], withNothing))).toEqual([
      [null, 'Other', 'Coins'],
      [null, 'Herbs', 'Grimy guam leaf'],
    ]);
  });

  it("puts what it can't place last, by version then chance", () => {
    const placed = addDropSections(
      [drop('Bones'), drop('Mystery', 'Other'), drop('Ensouled head')],
      parseDropSections(`==Drops==
===100%===
{{DropsLine|name=Bones|quantity=1|rarity=Always}}
===Tertiary===
{{DropsLine|name=Ensouled head|quantity=1|rarity=1/25}}`),
    );
    expect(where(placed)).toEqual([
      [null, '100%', 'Bones'],
      [null, 'Tertiary', 'Ensouled head'],
      [null, null, 'Mystery'],
    ]);
  });

  it('without sections, orders by version then most common first', () => {
    const drops = [drop('Whip', null, '1/512'), drop('Bones', null, 'Always')];
    drops[1].chance = 1;
    drops[0].chance = 1 / 512;
    expect(addDropSections(drops, []).map((d) => d.item)).toEqual(['Bones', 'Whip']);
  });
});

describe('against the Abyssal demon page', () => {
  const dir = path.join(import.meta.dirname, 'fixtures');
  const rows = JSON.parse(readFileSync(path.join(dir, 'dropsline.json'), 'utf8')) as RawDrop[];
  const text = readFileSync(path.join(dir, 'wikitext', 'Abyssal demon.wiki'), 'utf8');
  const drops = addDropSections(
    buildDrops(rows, new Set(['Abyssal demon'])).get('Abyssal demon')!,
    parseDropSections(text),
  );
  const tables = [...new Set(drops.map((d) => `${d.group} / ${d.section}`))];

  it('places every drop', () => {
    expect(drops.filter((d) => d.section === null)).toEqual([]);
  });

  it('keeps the wiki page order of groups and tables', () => {
    expect(tables).toEqual([
      'Standard and Catacombs of Kourend / 100%',
      'Standard and Catacombs of Kourend / Weapons and armour',
      'Standard and Catacombs of Kourend / Runes',
      'Standard and Catacombs of Kourend / Herbs',
      'Standard and Catacombs of Kourend / Materials',
      'Standard and Catacombs of Kourend / Coins',
      'Standard and Catacombs of Kourend / Other',
      'Standard and Catacombs of Kourend / Rare and Gem drop table',
      'Standard and Catacombs of Kourend / Tertiary',
      'Standard and Catacombs of Kourend / Catacombs tertiary',
      'Wilderness Slayer Cave / 100%',
      'Wilderness Slayer Cave / Weapons and armour',
      'Wilderness Slayer Cave / Runes',
      'Wilderness Slayer Cave / Herbs',
      'Wilderness Slayer Cave / Materials',
      'Wilderness Slayer Cave / Other',
      'Wilderness Slayer Cave / Rare and Gem drop table',
      'Wilderness Slayer Cave / Tertiary',
      'Wilderness Slayer Cave / Wilderness Slayer tertiary',
    ]);
  });

  it('files expanded tables and clue lines where the page puts them', () => {
    const inSection = (group: string, section: string) =>
      drops.filter((d) => d.group === group && d.section === section).map((d) => d.item);
    const standard = 'Standard and Catacombs of Kourend';
    expect(inSection(standard, 'Herbs')).toHaveLength(11);
    expect(inSection(standard, 'Rare and Gem drop table')).toContain('Dragon spear');
    expect(inSection(standard, 'Tertiary')).toEqual([
      'Ensouled abyssal head',
      'Brimstone key',
      'Clue scroll (hard)',
      'Clue scroll (elite)',
      'Abyssal head',
    ]);
    expect(inSection(standard, 'Catacombs tertiary')).toEqual([
      'Ancient shard',
      'Dark totem base',
      'Dark totem middle',
      'Dark totem top',
    ]);
  });
});
