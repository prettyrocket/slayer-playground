import { describe, expect, it } from 'vitest';

import type { Catalog, Category } from '@/data/catalog';
import { searchCategories, words } from '@/data/search';
import type { Monster } from '@/data/types';

const monster = (page: string) => ({ page, slug: page.toLowerCase() }) as Monster;

const category = (name: string, monsters: string[] = [], aliases: string[] = []): Category => ({
  slug: name.toLowerCase().replaceAll(' ', '-'),
  name,
  monsters: monsters.map(monster),
  masters: [],
  aliases,
  slayerLevel: null,
  icon: null,
  equipment: [],
});

const catalog: Catalog = {
  categories: [
    category('Abyssal demons', ['Abyssal demon', 'Abyssal Sire']),
    category('Black demons', ['Black demon', 'Demonic gorilla']),
    category('Blue dragons', ['Blue dragon', 'Vorkath']),
    category('Bosses', ['Abyssal Sire', "Kree'arra", 'Vorkath'], ['boss']),
    category('Dragons', ['Dragon']),
    category('Kalphite', ['Kalphite Queen'], ['kalphites']),
    category('Monkeys', ['Monkey', 'Demonic gorilla']),
    category('Pirates', ['Pirate']),
    category('Rats', ['Giant rat']),
  ],
  monsters: [],
};

const search = (query: string) =>
  searchCategories(catalog, query).map(({ category: c, alias, monsters }) =>
    alias
      ? `${c.name} (${alias})`
      : monsters.length
        ? `${c.name} [${monsters.map((m) => m.page)}]`
        : c.name,
  );

describe('words', () => {
  it('lowercases and drops accents and punctuation', () => {
    expect(words("Kree'arra")).toEqual(['kreearra']);
    expect(words('  Vet’ion / Calvar’ion ')).toEqual(['vetion', 'calvarion']);
    expect(words('Pokémon')).toEqual(['pokemon']);
  });
});

describe('searchCategories', () => {
  it('lists everything for an empty query', () => {
    expect(search('  ')).toHaveLength(catalog.categories.length);
  });

  it('matches words by prefix, not anywhere inside a word', () => {
    expect(search('abys dem')).toEqual(['Abyssal demons']);
    expect(search('rat')).toEqual(['Rats']); // not Pirates
  });

  it('ranks names that start with the query, then other names, aliases and monsters', () => {
    expect(search('demon')).toEqual([
      'Abyssal demons',
      'Black demons',
      'Monkeys [Demonic gorilla]',
    ]);
    // "Dragons" starts with the query, so it comes before "Blue dragons".
    expect(search('dragon')).toEqual(['Dragons', 'Blue dragons']);
  });

  it('matches aliases and says which one', () => {
    expect(search('kalphites')).toEqual(['Kalphite (kalphites)']);
    // The name wins over an alias when both match.
    expect(search('boss')).toEqual(['Bosses']);
  });

  it('finds categories through their monsters', () => {
    expect(search('vorkath')).toEqual(['Blue dragons [Vorkath]', 'Bosses [Vorkath]']);
    expect(search('kreearra')).toEqual(["Bosses [Kree'arra]"]);
    expect(search('sire')).toEqual(['Abyssal demons [Abyssal Sire]', 'Bosses [Abyssal Sire]']);
  });

  it('finds nothing for nonsense', () => {
    expect(search('zzz')).toEqual([]);
  });
});
