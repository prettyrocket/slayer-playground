import { describe, expect, it } from 'vitest';

import type { Monster } from '../../src/data/types.ts';
import { addLocations, parseLocLines, parseTaskLocations } from './locations.ts';

const locLine = (location: string, coords: string, plane = '') => `{{LocLine
|name = Abyssal demon
|location = ${location}
|levels = 124
|members = Yes
${plane}${coords}
|mtype = pin
}}`;

describe('parseLocLines', () => {
  it('reads the place, its page and its spawns', () => {
    const text = [
      locLine('[[Abyssal Area]] ({{Fairycode|alr}})', '|x:3025,y:4916|x:3016,y:4891'),
      locLine('[[Slayer Tower]] ({{FloorNumber|uk=2}})', '|x:3408,y:3573', '|plane = 2\n'),
      locLine('[[Slayer Tower|Slayer Tower (basement)]]', '|x:3427,y:9965'),
    ].join('\n');
    expect(parseLocLines(text)).toEqual([
      {
        name: 'Abyssal Area',
        page: 'Abyssal Area',
        spawns: new Set(['3025,4916', '3016,4891']),
      },
      { name: 'Slayer Tower (floor 2)', page: 'Slayer Tower', spawns: new Set(['3408,3573']) },
      { name: 'Slayer Tower (basement)', page: 'Slayer Tower', spawns: new Set(['3427,9965']) },
    ]);
  });

  it('merges repeats of a place', () => {
    const text = [
      locLine('[[Taverley Dungeon]]', '|x:1,y:2'),
      locLine('[[Taverley Dungeon]]', '|x:3,y:4'),
    ].join('\n');
    expect(parseLocLines(text)).toEqual([
      { name: 'Taverley Dungeon', page: 'Taverley Dungeon', spawns: new Set(['1,2', '3,4']) },
    ]);
  });

  it('keeps a place with no link or no coordinates', () => {
    expect(parseLocLines(locLine('North of Slepe', ''))).toEqual([
      { name: 'North of Slepe', page: null, spawns: new Set() },
    ]);
  });
});

const taskPage = `==Locations==
{| class="wikitable sortable"
!Location
!Maplink
!Amount
!Multicombat
!Cannonable
!Safespottable
!Notes
|-
|[[Catacombs of Kourend]]
|{{Map|type=maplink
|location = [[Catacombs of Kourend]]
|mapID = 32
|1669,10054,title:Abyssal demon|x:1674,y:10056,title:Abyssal demon
|mtype = pin
}}
|13
|{{Yes}}
|{{No}}
|{{No}}
|
|-
|[[Slayer Tower]] ({{FloorNumber|uk=2}})
|{{Map|type=maplink
|plane = 2
|3408,3573
}}
|14
|{{No}}
|Partial
|{{Yes}}
|Far without 71 [[Agility]].
|}`;

describe('parseTaskLocations', () => {
  it('reads the table with a Cannonable column', () => {
    expect(
      parseTaskLocations(`{| class="wikitable"\n!Item\n|-\n|Facemask\n|}\n${taskPage}`),
    ).toEqual([
      {
        name: 'Catacombs of Kourend',
        spawns: new Set(['1669,10054', '1674,10056']),
        multicombat: true,
        cannon: false,
        safespot: false,
      },
      {
        name: 'Slayer Tower (floor 2)',
        spawns: new Set(['3408,3573']),
        multicombat: false,
        cannon: null,
        safespot: true,
      },
    ]);
  });

  it('is empty without a locations table', () => {
    expect(parseTaskLocations('No table here.')).toEqual([]);
  });
});

describe('addLocations', () => {
  const monster = (page: string) => ({ page, locations: [] }) as unknown as Monster;

  it('adds multi, cannon and safespot from a task row sharing a spawn, most spawns first', () => {
    const demon = monster('Abyssal demon');
    const text = [
      locLine('[[Slayer Tower]] ({{FloorNumber|uk=2}})', '|x:3408,y:3573', '|plane = 2\n'),
      locLine('[[Catacombs of Kourend]]', '|x:1669,y:10054|x:1670,y:10086'),
      locLine('[[Abyssal Area]]', ''),
    ].join('\n');
    const warnings = addLocations(
      [demon],
      new Map([['Abyssal demon', text]]),
      new Map([['Slayer task/Abyssal demons', taskPage]]),
    );
    expect(warnings).toEqual([]);
    expect(demon.locations).toEqual([
      {
        name: 'Catacombs of Kourend',
        page: 'Catacombs of Kourend',
        spawns: 2,
        multicombat: true,
        cannon: false,
        safespot: false,
      },
      {
        name: 'Slayer Tower (floor 2)',
        page: 'Slayer Tower',
        spawns: 1,
        multicombat: false,
        cannon: null,
        safespot: true,
      },
      // No coordinates, so nothing to match.
      {
        name: 'Abyssal Area',
        page: 'Abyssal Area',
        spawns: null,
        multicombat: null,
        cannon: null,
        safespot: null,
      },
    ]);
  });

  it('takes the row sharing the most spawns', () => {
    const demon = monster('Abyssal demon');
    // Another floor's row shares one tile; the Catacombs row shares both.
    const stray = `{|\n!Location\n!Map\n!Cannonable\n|-\n|Upstairs\n|{{Map|1669,10054}}\n|{{Yes}}\n|}`;
    addLocations(
      [demon],
      new Map([
        ['Abyssal demon', locLine('[[Catacombs of Kourend]]', '|x:1669,y:10054|x:1674,y:10056')],
      ]),
      new Map([
        ['Slayer task/Stray', stray],
        ['Slayer task/Abyssal demons', taskPage],
      ]),
    );
    expect(demon.locations[0].cannon).toBe(false);
  });

  it('warns when task pages disagree about a place', () => {
    const demon = monster('Abyssal demon');
    const other = taskPage.replace('|{{Yes}}\n|{{No}}\n|{{No}}', '|{{No}}\n|{{No}}\n|{{No}}');
    const warnings = addLocations(
      [demon],
      new Map([['Abyssal demon', locLine('[[Catacombs of Kourend]]', '|x:1669,y:10054')]]),
      new Map([
        ['Slayer task/Abyssal demons', taskPage],
        ['Slayer task/Other', other],
      ]),
    );
    expect(warnings).toEqual([
      'Abyssal demon, Catacombs of Kourend: task pages disagree (true/false/false vs false/false/false)',
    ]);
  });
});
