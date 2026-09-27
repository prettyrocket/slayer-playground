import { describe, expect, it } from 'vitest';

import {
  buildDrops,
  buildMonsters,
  masterKey,
  normalizeDrop,
  parseRarity,
  slayerCategory,
  slugify,
  uniqueSlugs,
} from './normalize.ts';
import type { RawDrop, RawMonster } from './sources.ts';

describe('slugify / uniqueSlugs', () => {
  it('makes URL-safe slugs', () => {
    expect(slugify('Kalphite Queen')).toBe('kalphite-queen');
    expect(slugify("Kree'arra")).toBe('kreearra');
    expect(slugify('Zombie (Tarn’s Lair)')).toBe('zombie-tarns-lair');
    expect(slugify('Jal-AkRek-Ket')).toBe('jal-akrek-ket');
  });

  it('resolves collisions without depending on which other pages exist', () => {
    const both = uniqueSlugs(['Skeleton (mage)', 'Skeleton Mage']);
    expect(both.get('Skeleton Mage')).toBe('skeleton-mage');
    expect(both.get('Skeleton (mage)')).toMatch(/^skeleton-mage-[0-9a-f]{4}$/);
    // The suffixed slug is a function of its own title only.
    expect(uniqueSlugs(['Skeleton Mage', 'Skeleton (mage)']).get('Skeleton (mage)')).toBe(
      both.get('Skeleton (mage)'),
    );
    expect(uniqueSlugs(['Skeleton (mage)']).get('Skeleton (mage)')).toBe('skeleton-mage');
  });
});

describe('masterKey / slayerCategory', () => {
  it('maps spellings and alternate masters to a master key', () => {
    expect(masterKey('Vannaka')).toBe('vannaka');
    expect(masterKey(' mortimer ')).toBe('mortimer');
    expect(masterKey('Konar quo Maten')).toBe('konar');
    expect(masterKey('Steve')).toBe('nieve');
    expect(masterKey('kuradal')).toBe('duradel');
    expect(masterKey('None')).toBeNull();
    expect(masterKey('No')).toBeNull();
  });

  it('lowercases categories and drops placeholders and corrupted values', () => {
    expect(slayerCategory('Abyssal Demons')).toBe('abyssal demons');
    expect(slayerCategory('none')).toBeNull();
    expect(slayerCategory('No')).toBeNull();
    expect(slayerCategory('vampyres\'"`UNIQ--ref-00000064-QINU`"\'')).toBeNull();
  });
});

const row = (overrides: RawMonster): RawMonster => ({
  page_name: 'Abyssal demon',
  name: 'Abyssal demon',
  default_version: true,
  is_members_only: true,
  combat_level: 124,
  hitpoints: 150,
  slayer_level: 85,
  slayer_experience: 150,
  slayer_category: ['Abyssal Demons'],
  assigned_by: ['vannaka', 'Mortimer', 'None'],
  id: ['415', '416'],
  max_hit: ['8'],
  attack_style: ['Stab'],
  cannon_immune: 'Not immune',
  thrall_immune: 'Immune',
  elemental_weakness: 'fire',
  elemental_weakness_percent: 20,
  freeze_resistance: '33% resistance',
  ...overrides,
});

describe('buildMonsters', () => {
  it('groups versions per page, default first, and normalizes fields', () => {
    const [monster] = buildMonsters(
      [
        row({ default_version: false, version_anchor: 'Wilderness Slayer Cave', id: ['7410'] }),
        row({ version_anchor: 'Standard', assigned_by: ['Krystilia'] }),
      ],
      new Set(['Abyssal demon']),
      new Set(),
    );
    expect(monster).toMatchObject({
      slug: 'abyssal-demon',
      page: 'Abyssal demon',
      slayerLevel: 85,
      categories: ['abyssal demons'],
      // Master order, not input order; "None" dropped.
      assignedBy: ['vannaka', 'krystilia', 'mortimer'],
      taskOnly: true,
      members: true,
      hasDrops: false,
    });
    expect(monster.versions.map((v) => v.version)).toEqual(['Standard', 'Wilderness Slayer Cave']);
    expect(monster.versions[0]).toMatchObject({
      isDefault: true,
      npcIds: [415, 416],
      weakness: { element: 'Fire', percent: 20 },
      immunities: { cannon: false, thrall: true, freeze: 33, burn: null },
    });
  });

  it('skips pages without a real Slayer category and sorts by slug', () => {
    const monsters = buildMonsters(
      [
        row({ page_name: 'Zombie', slayer_category: ['Zombies'] }),
        row({ page_name: 'Duck', slayer_category: ['None'] }),
        row({ page_name: 'Bat', slayer_category: ['Bats'] }),
        row({ page_name: 'Cow', slayer_category: undefined }),
      ],
      new Set(),
      new Set(['Bat']),
    );
    expect(monsters.map((m) => [m.slug, m.hasDrops])).toEqual([
      ['bat', true],
      ['zombie', false],
    ]);
  });

  it('treats "None" weaknesses as no weakness', () => {
    const [monster] = buildMonsters([row({ elemental_weakness: 'None' })], new Set(), new Set());
    expect(monster.versions[0].weakness).toBeNull();
  });
});

describe('parseRarity', () => {
  it.each([
    ['1/512', 1 / 512],
    ['4/128', 1 / 32],
    ['1/8,192', 1 / 8192],
    ['1/2,730.67', 1 / 2730.67],
    ['~1/300', 1 / 300],
    ['Always', 1],
    ['Rare', null],
    ['Varies', null],
    ['Unknown', null],
  ])('%s', (rarity, expected) => {
    const result = parseRarity(rarity);
    if (expected === null) expect(result).toBeNull();
    else expect(result).toBeCloseTo(expected, 12);
  });
});

const dropRow = (json: Record<string, unknown>, page = 'Abyssal demon'): RawDrop => ({
  page_name: page,
  item_name: String(json['Dropped item'] ?? ''),
  drop_json: JSON.stringify({
    'Dropped from': page,
    Rarity: '1/128',
    'Quantity Low': 1,
    'Quantity High': 1,
    'Drop Quantity': '1',
    Rolls: 1,
    Approx: false,
    'Alt Rarity': '',
    'Drop type': 'combat',
    ...json,
  }),
});

describe('normalizeDrop', () => {
  it('reads version, quantity, noted and value', () => {
    expect(
      normalizeDrop(
        dropRow({
          'Dropped item': 'Pure essence',
          'Dropped from': 'Abyssal demon#Standard',
          'Drop Quantity': '120, 180 (noted)',
          'Quantity Low': 120,
          'Quantity High': 180,
          'Drop Value': 2,
          Rolls: 3,
        }),
      ),
    ).toEqual({
      item: 'Pure essence',
      dropVersion: 'Standard',
      quantity: [120, 180],
      noted: true,
      rarity: '1/128',
      chance: 1 / 128,
      approx: false,
      rolls: 3,
      altRarity: null,
      value: 2,
      type: 'combat',
    });
  });

  it('returns null for unparseable rows', () => {
    expect(normalizeDrop({ page_name: 'X', drop_json: '{not json' })).toBeNull();
    expect(normalizeDrop({ page_name: 'X', drop_json: '{}' })).toBeNull();
  });
});

describe('buildDrops', () => {
  it('filters to the given pages, dedupes, and orders by version then chance', () => {
    const drops = buildDrops(
      [
        dropRow({ 'Dropped item': 'Bones', Rarity: 'Always' }),
        dropRow({ 'Dropped item': 'Abyssal whip', Rarity: '1/512' }),
        dropRow({ 'Dropped item': 'Abyssal whip', Rarity: '1/512' }),
        dropRow({ 'Dropped item': 'Coins', Rarity: '1/8', 'Dropped from': 'Abyssal demon#Wild' }),
        dropRow({ 'Dropped item': 'Raw beef', Rarity: 'Always' }, 'Cow'),
      ],
      new Set(['Abyssal demon']),
    );
    expect([...drops.keys()]).toEqual(['Abyssal demon']);
    expect(drops.get('Abyssal demon')!.map((d) => [d.dropVersion, d.item])).toEqual([
      [null, 'Bones'],
      [null, 'Abyssal whip'],
      ['Wild', 'Coins'],
    ]);
  });
});
