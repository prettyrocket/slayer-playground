import { describe, expect, it } from 'vitest';

import {
  amountRange,
  findTables,
  linkTargets,
  parseTable,
  skillRequirement,
  wikiPlain,
} from './wikitext.ts';

describe('wikiPlain', () => {
  it.each([
    ['{{SCP|Slayer|85}}, {{SCP|Combat|85}}', '85 Slayer, 85 Combat'],
    ['[[Aberrant spectre]]s', 'Aberrant spectres'],
    ['[[Slayer task/Crabs|Crabs]]', 'Crabs'],
    ['{{NA}}', ''],
    ['{{NA|None}}', ''],
    ['[[Priest in Peril]]{{CiteTwitter|author=Mod Ash|quote=(...) {{nested}}}}', 'Priest in Peril'],
    ['Held<ref group="n">A note.</ref> here<ref name="x" />', 'Held here'],
    ["Unlocked the ''Lured In'' ability", 'Unlocked the Lured In ability'],
    ['[[File:Gargoyle icon.png|link=]]Gargoyle Smasher', 'Gargoyle Smasher'],
    ['{{Yes|Permanent}} / {{No}}', 'Permanent / No'],
    ['[[Slayer Tower]] ({{FloorNumber|uk=2}})', 'Slayer Tower (floor 2)'],
    ['<!-- hidden -->Shown', 'Shown'],
    ['a {{!}} b', 'a | b'],
    ['{{Yes|[[Foo|bar]]}}', 'bar'],
  ])('%j', (input, expected) => {
    expect(wikiPlain(input)).toBe(expected);
  });
});

describe('linkTargets / skillRequirement / amountRange', () => {
  it('lists link targets without anchors, files or repeats', () => {
    expect(
      linkTargets(
        '[[Abyssal demon#Catacombs|x]], [[abyssal demon]], [[File:A.png]], [[Slayer task/Crabs|Crabs]]',
      ),
    ).toEqual(['Abyssal demon', 'Slayer task/Crabs']);
    expect(linkTargets('[[A]]<ref>[[B]]</ref>')).toEqual(['A']);
    expect(linkTargets('[[:Category:Bosses]] [[:Kurask]]')).toEqual(['Kurask']);
  });

  it('reads skill requirements', () => {
    const text = '{{SCP|Slayer|60}}, {{SCP|Combat|65}}';
    expect(skillRequirement(text, 'Slayer')).toBe(60);
    expect(skillRequirement(text, 'Combat')).toBe(65);
    expect(skillRequirement(text, 'Defence')).toBeNull();
  });

  it.each([
    ['40-90', [40, 90]],
    [' 1,000-1,500 ', [1000, 1500]],
    ['50', [50, 50]],
    ['120–170', [120, 170]],
    ['{{NA}}', null],
    ['', null],
    ['Varies', null],
  ])('amountRange(%j)', (input, expected) => {
    expect(amountRange(input)).toEqual(expected);
  });
});

describe('findTables / parseTable', () => {
  it('finds outer tables only', () => {
    const page = 'x\n{|\n|a\n{|\n|inner\n|}\n|}\ny\n{| class="wikitable"\n|b\n|}';
    expect(findTables(page)).toEqual([
      '{|\n|a\n{|\n|inner\n|}\n|}',
      '{| class="wikitable"\n|b\n|}',
    ]);
  });

  it('reads headers, strips cell attributes and skips a totals footer', () => {
    const table = parseTable(
      [
        '{| class="wikitable"',
        '!Monster',
        '![[Task weight|Weight]]',
        '|-',
        '|[[Bat]]s',
        '|data-sort-value="7"|{{+=|weight|7|echo=2}}',
        '|-',
        '|Cows || 8',
        '|-',
        '!Total',
        '!{{#var:weight}}',
        '|}',
      ].join('\n'),
    );
    expect(table.headers).toEqual(['monster', 'weight']);
    expect(table.rows).toEqual([
      ['[[Bat]]s', '{{+=|weight|7|echo=2}}'],
      ['Cows', '8'],
    ]);
  });

  it('keeps continuation lines and multi-line templates in their cell', () => {
    const table = parseTable(
      ['{|', '!A', '!B', '|-', '|', '*one', '*two', '|{{Map|x=1', '|y=2}}', '|}'].join('\n'),
    );
    expect(table.rows).toEqual([['\n*one\n*two', '{{Map|x=1\n|y=2}}']]);
  });

  it('fills in rowspans and colspans, and marks spanned cells', () => {
    const table = parseTable(
      [
        '{|',
        '!A!!B!!C',
        '|-',
        '|rowspan="2"|x',
        '|{{NA|rowspan=2}}',
        '|1',
        '|-',
        '|2',
        '|-',
        '|colspan="2"|wide',
        '|3',
        '|}',
      ].join('\n'),
    );
    expect(table.rows).toEqual([
      ['x', '{{NA|rowspan=2}}', '1'],
      ['x', '{{NA|rowspan=2}}', '2'],
      ['wide', 'wide', '3'],
    ]);
    expect(table.spanned[1]).toEqual([true, true, false]);
  });

  it('carries a rowspan in a later column past a short row', () => {
    const table = parseTable(
      ['{|', '!A!!B!!W', '|-', '|a', '|b', '|rowspan="2"|w', '|-', '|c', '|}'].join('\n'),
    );
    expect(table.rows[1]).toEqual(['c', '', 'w']);
    expect(table.spanned[1][2]).toBe(true);
  });

  it("doesn't count braces in comments or nowiki, and throws on an unclosed template", () => {
    const lines = ['{|', '!A', '|-', '|[[Foo]] <!-- see {{ -->', '|-', '|<nowiki>{{</nowiki>'];
    const table = parseTable([...lines, '|-', '|c', '|}'].join('\n'));
    expect(table.rows.map((r) => r[0])).toEqual([
      '[[Foo]] <!-- see {{ -->',
      '<nowiki>{{</nowiki>',
      'c',
    ]);
    expect(() => parseTable(['{|', '!A', '|-', '|{{Oops', '|-', '|b', '|}'].join('\n'))).toThrow(
      /unclosed/,
    );
  });

  it('keeps row-header cells as data and drops header-only rows after the data', () => {
    const table = parseTable(
      [
        '{|',
        '!Name !! Amount',
        '|-',
        '! scope="row" | Foo',
        '|10-20',
        '|-',
        '!Total || 5',
        '|}',
      ].join('\n'),
    );
    expect(table.headers).toEqual(['name', 'amount']);
    expect(table.rows).toEqual([['Foo', '10-20']]);
  });

  it('joins multi-row headers per column', () => {
    const table = parseTable(
      [
        '{|',
        '!rowspan="2"|Monster !! colspan="2"|Amount',
        '|-',
        '!Base !! Extended',
        '|-',
        '|Bat || 10 || 20',
        '|}',
      ].join('\n'),
    );
    expect(table.headers).toEqual(['monster', 'amount base', 'amount extended']);
    expect(table.rows).toEqual([['Bat', '10', '20']]);
  });

  it('only lets {{NA}} carry a span, and keeps nested tables in their cell', () => {
    // A nested table starts on its own line, inside the previous cell.
    const lines = ['{|', '!A!!B', '|-', '|{{Note|colspan=2}}', '|x', '|-', '|', '{|', '|inner'];
    const table = parseTable([...lines, '|}', '|y', '|}'].join('\n'));
    expect(table.rows).toEqual([
      ['{{Note|colspan=2}}', 'x'],
      ['\n{|\n|inner\n|}', 'y'],
    ]);
  });
});
