import type { Monster } from '../../src/data/types.ts';

/**
 * Copies of monsters in other game modes and minigames, and pages the wiki
 * marks unused, by the title's qualifier.
 */
const NOT_ON_TASK_TITLE = /\((deadman|pvm arena|nightmare zone|echo|unused|temple trekking)\)$/i;

/**
 * Wiki categories of minigames and raids. A monster tagged with one and with
 * no places of its own is only fought there (the Fight Cave's waves), not
 * something to pick for a task.
 */
const MINIGAMES = new Set(['TzHaar Fight Cave', 'Inferno', 'Chambers of Xeric', 'Temple Trekking']);

/** Minigame bosses that are a task of their own: a TzHaar task can be TzTok-Jad or TzKal-Zuk. */
const MINIGAME_TASKS = new Set(['TzTok-Jad', 'TzKal-Zuk']);

/**
 * Monsters the wiki's tags don't catch, with why: quest fights it doesn't tag
 * as quest monsters or that have a place, fights summoned during a quest or a
 * boss, and ones a task page says don't count.
 */
const NOT_ON_TASK: Record<string, string> = {
  Arrg: 'a quest fight; Nightmare Zone re-fights do not count',
  Dad: 'a quest fight; Nightmare Zone re-fights do not count',
  Bouncer: 'fought during The General’s Shadow',
  Elvarg: 'fought during Dragon Slayer I',
  'Black demon (The Grand Tree)': 'summoned during The Grand Tree',
  'Black demon (The Scar)': 'fought during Desert Treasure II',
  'Greater demon (The Scar)': 'fought during Desert Treasure II',
  'Basilisk (The Fremennik Exiles)': 'fought during The Fremennik Exiles',
  'Gryphon (Troubled Tortugans)': 'fought during Troubled Tortugans',
  'Judge of Yama (A Kingdom Divided)': 'summoned during A Kingdom Divided',
  'Treus Dayth': 'summoned during Haunted Mine',
  'Skeleton Hellhound': 'summoned during In Search of the Myreque',
  Skoblin: 'summoned during Land of the Goblins',
  Snailfeet: 'fought during Land of the Goblins',
  Kolodion: 'fought during the Mage Arena I miniquest',
  Porazdir: 'fought during the Mage Arena II miniquest',
  'Corrupt Lizardman': 'fought during Tale of the Righteous',
  'Drink troll': 'fought during Prying Times',
  'Dinky the drink troll': 'fought during Prying Times',
  'Large chicken': 'fought during Scrambled!',
  'Strange creature (Shadows of Custodia)': 'fought during Shadows of Custodia',
  // "They do not count towards the task, but do provide 50 Slayer experience each"
  'Respiratory system': 'the Abyssal Sire’s vents; does not count',
  // "Araxxor's minions ... part of an araxyte task without decreasing the task count"
  'Mirrorback Araxyte': 'Araxxor’s minion; does not count',
  'Ruptura Araxyte': 'Araxxor’s minion; does not count',
  // These count, but come with a boss fight rather than being one to pick.
  'Spawn of Sarachnis': 'summoned by Sarachnis',
  'Giant rat (Scurrius)': 'summoned by Scurrius',
  "Skeleton Hellhound (Vet'ion)": 'summoned by Vet’ion',
  "Skeleton Hellhound (Calvar'ion)": 'summoned by Calvar’ion',
  "Greater Skeleton Hellhound (Vet'ion)": 'summoned by Vet’ion',
  "Greater Skeleton Hellhound (Calvar'ion)": 'summoned by Calvar’ion',
  "Scorpia's guardian": 'summoned by Scorpia',
  'Dark Ankou': 'summoned by Skotizo',
};

/**
 * Why a monster can't be picked for a Slayer task, or null when it can, from
 * its title, its wiki categories and whether the wiki maps any places for it.
 */
export function notOnTask(monster: Monster, categories: string[]): string | null {
  const listed = NOT_ON_TASK[monster.page];
  if (listed) return listed;
  if (NOT_ON_TASK_TITLE.test(monster.page)) return 'another game mode or minigame';
  if (categories.includes('Discontinued content')) return 'removed from the game';
  if (categories.some((c) => / League$/.test(c))) return 'Leagues only';
  if (categories.some((c) => /^(Deadman\b|Breach monsters$)/.test(c))) return 'Deadman only';
  const minigame = categories.find((c) => MINIGAMES.has(c));
  if (minigame && monster.locations.length === 0 && !MINIGAME_TASKS.has(monster.page)) {
    return `part of ${minigame}`;
  }
  // A one-time fight: repeatable quest monsters (Vorkath) have places.
  if (categories.includes('Quest monsters') && monster.locations.length === 0) {
    return 'a one-time quest fight';
  }
  return null;
}

/** Versions only fought during a quest: "Quest", "Ranger (Quest)", Vorkath's "Dragon Slayer II". */
const QUEST_VERSION = /^(?!post-quest)(.*\bquest\b.*|dragon slayer ii)$/i;

/**
 * Empties the categories of monsters that can't be picked for a task, so they
 * count for nothing, and drops versions only fought during a quest. `categories`
 * is each page's wiki categories. Returns a line per reason, for the sync log.
 */
export function applyViability(monsters: Monster[], categories: Map<string, string[]>): string[] {
  const byReason = new Map<string, string[]>();
  for (const monster of monsters) {
    const versions = monster.versions.filter((v) => !QUEST_VERSION.test(v.version ?? ''));
    if (versions.length > 0 && versions.length < monster.versions.length) {
      monster.versions = versions;
      // The default may have been a quest version.
      versions.forEach((v, i) => (v.isDefault = i === 0));
    }
    if (monster.categories.length === 0) continue;
    const reason = notOnTask(monster, categories.get(monster.page) ?? []);
    if (!reason) continue;
    monster.categories = [];
    byReason.set(reason, [...(byReason.get(reason) ?? []), monster.page]);
  }
  return [...byReason]
    .sort(([, a], [, b]) => b.length - a.length)
    .map(([reason, pages]) => `${pages.length} not on task (${reason}): ${pages.join(', ')}`);
}
