/**
 * Sérialisation et validation à la frontière du stockage.
 *
 * Tout ce qui sort d'un stockage est **non fiable** : l'utilisateur peut éditer son
 * `localStorage`, une ancienne version de l'app a pu y écrire une autre forme, une
 * réponse HTTP peut être tronquée. Ces validateurs sont écrits à la main pour ne pas
 * ajouter de dépendance à un projet qui n'en a pas besoin ; ils ne lèvent jamais.
 */

import type { Game, GameEvent, Player } from '../engine'
import type { Team } from '../teams'
import { DEFAULT_SETTINGS, SCHEMA_VERSION, type Settings } from './types'

type Envelope = { v: number; data: unknown }

export function encode(data: unknown): string {
  return JSON.stringify({ v: SCHEMA_VERSION, data } satisfies Envelope)
}

/**
 * Décode, migre si besoin, valide. Renvoie `null` sur tout ce qui n'est pas
 * exploitable — jamais d'exception.
 */
export function decode<T>(raw: string | null, validate: (value: unknown) => T | null): T | null {
  if (!raw) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isRecord(parsed) || typeof parsed.v !== 'number') return null
  const migrated = migrate(parsed.v, parsed.data)
  if (migrated === null) return null
  return validate(migrated)
}

/**
 * Amène une charge utile d'une version antérieure à la version courante.
 * Renvoie `null` si la migration est impossible (données d'une version future,
 * ou trou de migration) — mieux vaut repartir propre que corrompre une partie.
 */
function migrate(version: number, data: unknown): unknown | null {
  if (version === SCHEMA_VERSION) return data
  if (version > SCHEMA_VERSION) return null
  // Aucune migration nécessaire pour l'instant : la v1 est la première forme publiée.
  // Ajouter ici les paliers, dans l'ordre, quand la forme évoluera.
  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

export function parsePlayer(value: unknown): Player | null {
  if (!isRecord(value)) return null
  const { id, name, emoji, colorIndex } = value
  if (!isNonEmptyString(id) || !isNonEmptyString(name) || !isNonEmptyString(emoji)) return null
  if (typeof colorIndex !== 'number' || !Number.isInteger(colorIndex) || colorIndex < 0) return null
  return { id, name, emoji, colorIndex }
}

export function parsePlayers(value: unknown): Player[] | null {
  if (!Array.isArray(value)) return null
  const players: Player[] = []
  for (const item of value) {
    const player = parsePlayer(item)
    // Un joueur illisible est écarté, le reste du roster est conservé.
    if (player) players.push(player)
  }
  return players
}

export function parseTeam(value: unknown): Team | null {
  if (!isRecord(value)) return null
  const { id, name, playerIds, createdAt, lastPlayedAt } = value
  if (!isNonEmptyString(id) || !isNonEmptyString(name)) return null
  if (!Array.isArray(playerIds) || !playerIds.every(isNonEmptyString)) return null
  if (typeof createdAt !== 'number' || !Number.isFinite(createdAt)) return null
  return {
    id,
    name,
    playerIds,
    createdAt,
    lastPlayedAt:
      typeof lastPlayedAt === 'number' && Number.isFinite(lastPlayedAt) ? lastPlayedAt : null,
  }
}

export function parseTeams(value: unknown): Team[] | null {
  if (!Array.isArray(value)) return null
  const teams: Team[] = []
  for (const item of value) {
    const team = parseTeam(item)
    // Une équipe illisible est écartée, les autres sont conservées.
    if (team) teams.push(team)
  }
  return teams
}

function parseEvent(value: unknown): GameEvent | null {
  if (!isRecord(value)) return null
  switch (value.type) {
    case 'turn':
      if (!isNonEmptyString(value.playerId)) return null
      if (typeof value.raw !== 'number' || !Number.isInteger(value.raw) || value.raw < 0) return null
      if (typeof value.at !== 'number' || !Number.isFinite(value.at)) return null
      return { type: 'turn', playerId: value.playerId, raw: value.raw, at: value.at }
    case 'skip':
      return isNonEmptyString(value.playerId) ? { type: 'skip', playerId: value.playerId } : null
    case 'remove':
      return isNonEmptyString(value.playerId) ? { type: 'remove', playerId: value.playerId } : null
    case 'join': {
      const player = parsePlayer(value.player)
      return player ? { type: 'join', player } : null
    }
    default:
      return null
  }
}

export function parseGame(value: unknown): Game | null {
  if (!isRecord(value)) return null
  const { id, createdAt, firstPlayerId } = value
  if (!isNonEmptyString(id) || !isNonEmptyString(firstPlayerId)) return null
  if (typeof createdAt !== 'number' || !Number.isFinite(createdAt)) return null

  const players = parsePlayers(value.players)
  if (!players || players.length === 0) return null
  if (!players.some((p) => p.id === firstPlayerId)) return null

  if (!Array.isArray(value.events)) return null
  const events: GameEvent[] = []
  for (const item of value.events) {
    const event = parseEvent(item)
    // Un évènement illisible tronque le journal ici : la partie reste cohérente
    // jusqu'à ce point plutôt que de sauter un coup au milieu.
    if (!event) break
    events.push(event)
  }

  return { id, createdAt, players, firstPlayerId, events }
}

export function parseSettings(value: unknown): Settings {
  if (!isRecord(value)) return DEFAULT_SETTINGS
  return {
    sound: typeof value.sound === 'boolean' ? value.sound : DEFAULT_SETTINGS.sound,
    vibration:
      typeof value.vibration === 'boolean' ? value.vibration : DEFAULT_SETTINGS.vibration,
  }
}
