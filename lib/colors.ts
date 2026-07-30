/**
 * Palette des joueurs — source unique, utilisée à la fois par les classes Tailwind
 * (via `style`) et par le SVG de la courbe. Éviter de la dupliquer en CSS, sinon
 * les deux dérivent.
 *
 * Toutes ces teintes sont choisies pour rester lisibles sur le feutre vert sombre.
 */
export const PLAYER_COLORS = [
  '#e8b44a', // laiton
  '#6fc3e8', // ciel
  '#74d69a', // menthe
  '#f08a7a', // corail
  '#b39ae0', // lilas
  '#f2d06b', // soleil
  '#ea8fb4', // rose
  '#4fbfae', // turquoise
] as const

export function playerColor(colorIndex: number): string {
  return PLAYER_COLORS[colorIndex % PLAYER_COLORS.length]
}

/** Emojis proposés à la création d'un joueur. */
export const EMOJI_CHOICES = [
  '🐻', '🦊', '🐸', '🦉', '🦁', '🐧', '🐙', '🦄',
  '🐳', '🦖', '🐝', '🦩', '🐺', '🦔', '🐨', '🐼',
  '🦝', '🐢', '🦑', '🦒', '🐡', '🦋', '🐌', '🦜',
] as const
