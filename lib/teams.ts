import type { Player } from './engine'

/**
 * Une équipe : une tablée nommée et mémorisée.
 *
 * Les joueurs restent un roster global partagé — quelqu'un peut appartenir à
 * plusieurs équipes sans être dupliqué, et le renommer le renomme partout. Une
 * équipe ne stocke donc que des identifiants, et **leur ordre est l'ordre de jeu**
 * qui sera figé au lancement de la partie.
 */
export type Team = {
  id: string
  name: string
  playerIds: string[]
  createdAt: number
  /** Dernière partie lancée avec cette équipe. `null` si jamais jouée. */
  lastPlayedAt: number | null
}

/**
 * La dernière équipe jouée en tête : c'est presque toujours celle qu'on rejoue,
 * et ça évite d'avoir à la retrouver dans la liste à chaque soirée.
 */
export function sortTeams(teams: Team[]): Team[] {
  return [...teams].sort(
    (a, b) => (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0) || b.createdAt - a.createdAt,
  )
}

/** Résout les identifiants d'une équipe, en ignorant les joueurs supprimés du roster. */
export function teamPlayers(team: Team, roster: Player[]): Player[] {
  return team.playerIds
    .map((id) => roster.find((player) => player.id === id))
    .filter((player): player is Player => Boolean(player))
}
