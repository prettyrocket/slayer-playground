/** "Slayer task/Abyssal demons" -> https://oldschool.runescape.wiki/w/Slayer_task/Abyssal_demons */
export function wikiUrl(page: string): string {
  const path = encodeURIComponent(page.replaceAll(' ', '_')).replaceAll('%2F', '/');
  return `https://oldschool.runescape.wiki/w/${path}`;
}
