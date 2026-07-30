/**
 * Adaptateur HTTP — **prêt mais non branché**.
 *
 * C'est le chemin de bascule vers Postgres. Le jour où on veut une base :
 *
 *  1. créer les tables (`db/schema.sql`) ;
 *  2. écrire les routes listées ci-dessous dans `app/api/…/route.ts`, chacune étant
 *     une requête SQL de trois lignes ;
 *  3. poser `NEXT_PUBLIC_STORAGE=http` dans l'environnement.
 *
 * Aucun composant, aucun hook, aucun appel métier ne change : c'est tout l'intérêt
 * d'avoir posé le port en asynchrone dès le départ.
 *
 * Contrat des routes attendues :
 *
 * | Méthode | Route                | Corps        | Réponse        |
 * | ------- | -------------------- | ------------ | -------------- |
 * | GET     | `/api/players`       | —            | `Player[]`     |
 * | PUT     | `/api/players/:id`   | `Player`     | 204            |
 * | DELETE  | `/api/players/:id`   | —            | 204            |
 * | GET     | `/api/teams`         | —            | `Team[]`       |
 * | PUT     | `/api/teams/:id`     | `Team`       | 204            |
 * | DELETE  | `/api/teams/:id`     | —            | 204            |
 * | GET     | `/api/game`          | —            | `Game \| null` |
 * | PUT     | `/api/game`          | `Game`       | 204            |
 * | DELETE  | `/api/game/:id`      | —            | 204            |
 * | GET     | `/api/settings`      | —            | `Settings`     |
 * | PUT     | `/api/settings`      | `Settings`   | 204            |
 *
 * Note pour le multi-appareil : c'est ici qu'un `revision` viendrait se greffer,
 * `PUT /api/game` renvoyant 409 si la partie a été modifiée entre-temps.
 */

import { parseGame, parsePlayers, parseSettings, parseTeams } from './codec'
import { DEFAULT_SETTINGS, type Repository, type Settings } from './types'

export function createHttpRepository(baseUrl = '/api'): Repository {
  const url = (path: string) => `${baseUrl}${path}`

  /** Une lecture qui échoue renvoie le repli : l'app reste utilisable hors-ligne. */
  const get = async <T>(path: string, validate: (value: unknown) => T | null): Promise<T | null> => {
    try {
      const response = await fetch(url(path), { headers: { accept: 'application/json' } })
      if (!response.ok) return null
      return validate(await response.json())
    } catch {
      return null
    }
  }

  /** Une écriture qui échoue rejette : l'appelant décide d'alerter ou de réessayer. */
  const send = async (method: 'PUT' | 'DELETE', path: string, body?: unknown): Promise<void> => {
    const response = await fetch(url(path), {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (!response.ok) throw new Error(`${method} ${path} → ${response.status}`)
  }

  return {
    kind: 'http',

    async listPlayers() {
      return (await get('/players', parsePlayers)) ?? []
    },

    async upsertPlayer(player) {
      await send('PUT', `/players/${encodeURIComponent(player.id)}`, player)
    },

    async deletePlayer(id) {
      await send('DELETE', `/players/${encodeURIComponent(id)}`)
    },

    async listTeams() {
      return (await get('/teams', parseTeams)) ?? []
    },

    async upsertTeam(team) {
      await send('PUT', `/teams/${encodeURIComponent(team.id)}`, team)
    },

    async deleteTeam(id) {
      await send('DELETE', `/teams/${encodeURIComponent(id)}`)
    },

    async loadGame() {
      return get('/game', parseGame)
    },

    async saveGame(game) {
      await send('PUT', '/game', game)
    },

    async deleteGame(id) {
      await send('DELETE', `/game/${encodeURIComponent(id)}`)
    },

    async loadSettings(): Promise<Settings> {
      return (await get('/settings', (value) => parseSettings(value))) ?? DEFAULT_SETTINGS
    },

    async saveSettings(settings) {
      await send('PUT', '/settings', settings)
    },
  }
}
