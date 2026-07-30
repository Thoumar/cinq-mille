/**
 * Adaptateur `localStorage` — l'implémentation utilisée aujourd'hui.
 *
 * Le `Storage` est **injecté** plutôt que pris sur `window` : c'est ce qui permet de
 * tester l'adaptateur sans navigateur ni jsdom, et de fournir un repli en mémoire
 * pendant le rendu serveur.
 */

import type { Game, Player } from '../engine'
import { decode, encode, parseGame, parsePlayers, parseSettings } from './codec'
import { DEFAULT_SETTINGS, type Repository, type Settings } from './types'

const PREFIX = 'cinq-mille'
const KEYS = {
  roster: `${PREFIX}:roster`,
  game: `${PREFIX}:game`,
  settings: `${PREFIX}:settings`,
} as const

/** `Storage` en mémoire : rendu serveur, tests, navigateur en navigation privée verrouillée. */
export function memoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => void map.delete(key),
    setItem: (key, value) => void map.set(key, value),
  }
}

export function createLocalRepository(storage: Storage): Repository {
  const read = <T>(key: string, validate: (value: unknown) => T | null): T | null => {
    try {
      return decode(storage.getItem(key), validate)
    } catch {
      // Un accès refusé (Safari privé, quota, stockage désactivé) ne doit pas
      // empêcher l'application de fonctionner en mémoire.
      return null
    }
  }

  const write = (key: string, data: unknown): void => {
    // Volontairement synchrone à l'intérieur : c'est l'interface qui est asynchrone.
    storage.setItem(key, encode(data))
  }

  const readRoster = (): Player[] => read(KEYS.roster, parsePlayers) ?? []

  return {
    kind: 'local',

    async listPlayers() {
      return readRoster()
    },

    async upsertPlayer(player) {
      const roster = readRoster()
      const index = roster.findIndex((p) => p.id === player.id)
      if (index >= 0) roster[index] = player
      else roster.push(player)
      write(KEYS.roster, roster)
    },

    async deletePlayer(id) {
      write(
        KEYS.roster,
        readRoster().filter((p) => p.id !== id),
      )
    },

    async loadGame() {
      return read(KEYS.game, parseGame)
    },

    async saveGame(game: Game) {
      write(KEYS.game, game)
    },

    async deleteGame() {
      // Une seule partie en cours : l'identifiant n'est pas discriminant ici, mais
      // il l'est pour l'adaptateur HTTP, d'où sa présence dans l'interface.
      try {
        storage.removeItem(KEYS.game)
      } catch {
        /* stockage indisponible : rien à faire */
      }
    },

    async loadSettings(): Promise<Settings> {
      return read(KEYS.settings, (value) => parseSettings(value)) ?? DEFAULT_SETTINGS
    },

    async saveSettings(settings) {
      write(KEYS.settings, settings)
    },
  }
}
