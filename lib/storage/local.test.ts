import { beforeEach, describe, expect, it } from 'vitest'

import { createGame, type Game, type Player } from '../engine'
import { encode } from './codec'
import { createLocalRepository, memoryStorage } from './local'
import { DEFAULT_SETTINGS, type Repository } from './types'

const alice: Player = { id: 'a', name: 'Alice', emoji: '🐻', colorIndex: 0 }
const bob: Player = { id: 'b', name: 'Bob', emoji: '🦊', colorIndex: 1 }

const sample: Game = {
  ...createGame({ id: 'g1', players: [alice, bob], firstPlayerId: 'a', createdAt: 1000 }),
  events: [{ type: 'turn', playerId: 'a', raw: 550, at: 2000 }],
}

let storage: Storage
let repo: Repository

beforeEach(() => {
  storage = memoryStorage()
  repo = createLocalRepository(storage)
})

describe('aller-retour', () => {
  it('relit une partie identique à celle écrite', async () => {
    await repo.saveGame(sample)
    expect(await repo.loadGame()).toEqual(sample)
  })

  it('renvoie null quand aucune partie n’est stockée', async () => {
    expect(await repo.loadGame()).toBeNull()
  })

  it('supprime la partie en cours', async () => {
    await repo.saveGame(sample)
    await repo.deleteGame(sample.id)
    expect(await repo.loadGame()).toBeNull()
  })
})

describe('roster', () => {
  it('ajoute, met à jour et supprime un joueur', async () => {
    await repo.upsertPlayer(alice)
    await repo.upsertPlayer(bob)
    expect(await repo.listPlayers()).toHaveLength(2)

    await repo.upsertPlayer({ ...alice, name: 'Alicia' })
    const players = await repo.listPlayers()
    expect(players).toHaveLength(2)
    expect(players.find((p) => p.id === 'a')?.name).toBe('Alicia')

    await repo.deletePlayer('a')
    expect((await repo.listPlayers()).map((p) => p.id)).toEqual(['b'])
  })

  it('renvoie un roster vide quand rien n’est stocké', async () => {
    expect(await repo.listPlayers()).toEqual([])
  })

  it('écarte les joueurs illisibles sans perdre les autres', async () => {
    storage.setItem('cinq-mille:roster', encode([alice, { id: 'x' }, bob]))
    expect((await repo.listPlayers()).map((p) => p.id)).toEqual(['a', 'b'])
  })
})

describe('équipes', () => {
  const maison = {
    id: 't1',
    name: 'Maison',
    playerIds: ['a', 'b'],
    createdAt: 10,
    lastPlayedAt: null,
  }

  it('ajoute, met à jour et supprime une équipe', async () => {
    await repo.upsertTeam(maison)
    expect(await repo.listTeams()).toEqual([maison])

    await repo.upsertTeam({ ...maison, name: 'Chalet', lastPlayedAt: 42 })
    const teams = await repo.listTeams()
    expect(teams).toHaveLength(1)
    expect(teams[0]).toMatchObject({ name: 'Chalet', lastPlayedAt: 42 })

    await repo.deleteTeam('t1')
    expect(await repo.listTeams()).toEqual([])
  })

  it('conserve l’ordre des joueurs, qui est l’ordre de jeu', async () => {
    await repo.upsertTeam({ ...maison, playerIds: ['b', 'a', 'c'] })
    expect((await repo.listTeams())[0].playerIds).toEqual(['b', 'a', 'c'])
  })

  it('renvoie une liste vide quand rien n’est stocké', async () => {
    expect(await repo.listTeams()).toEqual([])
  })

  it('écarte les équipes illisibles sans perdre les autres', async () => {
    storage.setItem('cinq-mille:teams', encode([maison, { id: 'x' }, { ...maison, id: 't2' }]))
    expect((await repo.listTeams()).map((t) => t.id)).toEqual(['t1', 't2'])
  })

  it('ramène un horodatage absent ou aberrant à null', async () => {
    storage.setItem('cinq-mille:teams', encode([{ ...maison, lastPlayedAt: 'hier' }]))
    expect((await repo.listTeams())[0].lastPlayedAt).toBeNull()
  })
})

describe('réglages', () => {
  it('renvoie les valeurs par défaut si rien n’est stocké', async () => {
    expect(await repo.loadSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('conserve les réglages écrits', async () => {
    await repo.saveSettings({ sound: true, vibration: false })
    expect(await repo.loadSettings()).toEqual({ sound: true, vibration: false })
  })

  it('complète un réglage partiel avec les valeurs par défaut', async () => {
    storage.setItem('cinq-mille:settings', encode({ sound: true }))
    expect(await repo.loadSettings()).toEqual({ sound: true, vibration: true })
  })
})

// Le stockage est modifiable par l'utilisateur : aucun de ces cas ne doit lever.
describe('robustesse face à un stockage abîmé', () => {
  it('ignore un JSON invalide', async () => {
    storage.setItem('cinq-mille:game', '{ pas du json')
    expect(await repo.loadGame()).toBeNull()
  })

  it('ignore une charge sans enveloppe de version', async () => {
    storage.setItem('cinq-mille:game', JSON.stringify(sample))
    expect(await repo.loadGame()).toBeNull()
  })

  it('ignore une version de schéma future', async () => {
    storage.setItem('cinq-mille:game', JSON.stringify({ v: 99, data: sample }))
    expect(await repo.loadGame()).toBeNull()
  })

  it('ignore une partie sans joueurs', async () => {
    storage.setItem('cinq-mille:game', encode({ ...sample, players: [] }))
    expect(await repo.loadGame()).toBeNull()
  })

  it('ignore une partie dont le premier joueur n’existe pas', async () => {
    storage.setItem('cinq-mille:game', encode({ ...sample, firstPlayerId: 'fantome' }))
    expect(await repo.loadGame()).toBeNull()
  })

  it('tronque le journal au premier évènement illisible', async () => {
    storage.setItem(
      'cinq-mille:game',
      encode({
        ...sample,
        events: [
          { type: 'turn', playerId: 'a', raw: 550, at: 1 },
          { type: 'nawak' },
          { type: 'turn', playerId: 'b', raw: 500, at: 2 },
        ],
      }),
    )
    const game = await repo.loadGame()
    expect(game?.events).toHaveLength(1)
  })

  it('ne lève pas quand le stockage refuse la lecture', async () => {
    const hostile = createLocalRepository({
      ...memoryStorage(),
      getItem: () => {
        throw new Error('accès refusé')
      },
    })
    expect(await hostile.loadGame()).toBeNull()
    expect(await hostile.listPlayers()).toEqual([])
    expect(await hostile.loadSettings()).toEqual(DEFAULT_SETTINGS)
  })
})
