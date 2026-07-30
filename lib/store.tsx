'use client'

/**
 * Le pont entre le stockage asynchrone et une interface qui doit rester instantanée.
 *
 * Deux principes :
 *
 * 1. **L'état en mémoire est la vérité de l'affichage.** Une action met l'état à jour
 *    immédiatement, puis l'écriture part en arrière-plan. Aucun composant n'attend
 *    une promesse : l'interface reste aussi vive avec Postgres qu'avec localStorage.
 * 2. **Les écritures sont sérialisées** dans une file. Sans cela, deux saisies
 *    rapprochées pourraient arriver dans le désordre sur un adaptateur réseau et la
 *    dernière écriture gagnante ne serait pas la dernière action.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  addPlayer as addPlayerToGame,
  canUndo,
  createGame,
  drawFirstPlayer,
  type Game,
  type GameView,
  type Knock,
  lastEventLabel,
  type Player,
  playTurn,
  removePlayer as removePlayerFromGame,
  skipTurn,
  undo as undoGame,
  view as buildView,
} from './engine'
import { type Cue, feedback, keepScreenAwake } from './feedback'
import { newId } from './id'
import { getRepository } from './storage'
import { DEFAULT_SETTINGS, type Settings } from './storage/types'
import { sortTeams, type Team } from './teams'

type Store = {
  ready: boolean
  roster: Player[]
  /** Déjà triées : la dernière tablée jouée en tête. */
  teams: Team[]
  game: Game | null
  gameView: GameView | null
  settings: Settings
  /** Une écriture a échoué (quota, réseau) — l'état affiché reste valide. */
  writeError: string | null
  /** Vrai juste après le lancement, le temps de l'animation de tirage au sort. */
  drawing: boolean
  undoLabel: string | null

  createRosterPlayer: (name: string, emoji: string) => Player
  renameRosterPlayer: (player: Player) => void
  deleteRosterPlayer: (id: string) => void

  createTeam: (name: string, playerIds: string[]) => Team
  updateTeam: (team: Team) => void
  removeTeam: (id: string) => void

  startGame: (players: Player[], teamId?: string) => void
  finishDrawing: () => void
  /** Renvoie les joueurs que ce tour a fait reculer, pour la mise en scène. */
  submitScore: (raw: number) => Knock[]
  skipCurrent: () => void
  removeFromGame: (playerId: string) => void
  addToGame: (player: Player) => void
  undo: () => void
  abandonGame: () => void
  rematch: () => void

  updateSettings: (patch: Partial<Settings>) => void
  cue: (cue: Cue) => void
}

const StoreContext = createContext<Store | null>(null)

export function useStore(): Store {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useStore doit être utilisé dans <StoreProvider>')
  return store
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const repository = useMemo(() => getRepository(), [])

  const [ready, setReady] = useState(false)
  const [roster, setRoster] = useState<Player[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [game, setGame] = useState<Game | null>(null)
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [writeError, setWriteError] = useState<string | null>(null)
  const [drawing, setDrawing] = useState(false)

  // File d'écriture : garantit l'ordre et empêche qu'un échec ne casse la chaîne.
  const queue = useRef<Promise<void>>(Promise.resolve())
  const enqueue = useCallback((operation: () => Promise<void>) => {
    queue.current = queue.current.then(operation).catch((error: unknown) => {
      setWriteError(error instanceof Error ? error.message : 'écriture impossible')
    })
  }, [])

  // Chargement initial. C'est le seul moment où l'interface attend le stockage —
  // et il existe justement pour qu'une base distante n'impose rien de nouveau.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [players, savedTeams, current, preferences] = await Promise.all([
        repository.listPlayers(),
        repository.listTeams(),
        repository.loadGame(),
        repository.loadSettings(),
      ])
      if (cancelled) return
      setRoster(players)
      setTeams(savedTeams)
      setGame(current)
      setSettings(preferences)
      setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [repository])

  const gameView = useMemo(() => (game ? buildView(game) : null), [game])

  // Écran allumé pendant une partie en cours.
  useEffect(() => {
    if (!game || gameView?.finished) return
    return keepScreenAwake()
  }, [game, gameView?.finished])

  const cue = useCallback((value: Cue) => feedback(value, settings), [settings])

  /** Applique une transformation de la partie et la persiste. */
  const mutateGame = useCallback(
    (transform: (current: Game) => Game) => {
      setGame((current) => {
        if (!current) return current
        const next = transform(current)
        if (next === current) return current
        enqueue(() => repository.saveGame(next))
        return next
      })
    },
    [enqueue, repository],
  )

  const createRosterPlayer = useCallback(
    (name: string, emoji: string): Player => {
      const player: Player = {
        id: newId(),
        name: name.trim(),
        emoji,
        colorIndex: roster.length,
      }
      setRoster((current) => [...current, player])
      enqueue(() => repository.upsertPlayer(player))
      return player
    },
    [enqueue, repository, roster.length],
  )

  const renameRosterPlayer = useCallback(
    (player: Player) => {
      setRoster((current) => current.map((p) => (p.id === player.id ? player : p)))
      enqueue(() => repository.upsertPlayer(player))
    },
    [enqueue, repository],
  )

  const deleteRosterPlayer = useCallback(
    (id: string) => {
      setRoster((current) => current.filter((p) => p.id !== id))
      enqueue(() => repository.deletePlayer(id))
    },
    [enqueue, repository],
  )

  const createTeam = useCallback(
    (name: string, playerIds: string[]): Team => {
      const team: Team = {
        id: newId(),
        name: name.trim(),
        playerIds,
        createdAt: Date.now(),
        lastPlayedAt: null,
      }
      setTeams((current) => [...current, team])
      enqueue(() => repository.upsertTeam(team))
      return team
    },
    [enqueue, repository],
  )

  const updateTeam = useCallback(
    (team: Team) => {
      setTeams((current) => current.map((t) => (t.id === team.id ? team : t)))
      enqueue(() => repository.upsertTeam(team))
    },
    [enqueue, repository],
  )

  const removeTeam = useCallback(
    (id: string) => {
      setTeams((current) => current.filter((t) => t.id !== id))
      enqueue(() => repository.deleteTeam(id))
    },
    [enqueue, repository],
  )

  const startGame = useCallback(
    (players: Player[], teamId?: string) => {
      const fresh = createGame({
        id: newId(),
        players,
        firstPlayerId: drawFirstPlayer(players).id,
        createdAt: Date.now(),
      })
      setGame(fresh)
      setDrawing(true)
      enqueue(() => repository.saveGame(fresh))

      // Horodater l'équipe la fait remonter en tête de l'accueil : c'est presque
      // toujours celle qu'on rejoue à la partie suivante.
      if (!teamId) return
      setTeams((current) =>
        current.map((team) =>
          team.id === teamId ? { ...team, lastPlayedAt: Date.now() } : team,
        ),
      )
      const played = teams.find((team) => team.id === teamId)
      if (played) {
        const stamped = { ...played, lastPlayedAt: Date.now() }
        enqueue(() => repository.upsertTeam(stamped))
      }
    },
    [enqueue, repository, teams],
  )

  const finishDrawing = useCallback(() => setDrawing(false), [])

  /**
   * Enregistre un tour et **renvoie les joueurs qu'il a fait reculer**, pour que
   * l'appelant puisse le mettre en scène. On part de `game` plutôt que de la forme
   * fonctionnelle de `setGame` : il n'y a qu'un seul écrivain, et il faut pouvoir
   * rendre le résultat immédiatement.
   */
  const submitScore = useCallback(
    (raw: number): Knock[] => {
      if (!game) return []
      let next: Game
      try {
        next = playTurn(game, raw, Date.now())
      } catch {
        // Saisie invalide : l'interface l'empêche déjà, on ne casse rien ici.
        return []
      }
      const after = buildView(next)
      const record = after.records.at(-1)
      cue(
        after.finished
          ? 'win'
          : record?.knocked.length
            ? 'bounce'
            : record?.kind === 'bounce'
              ? 'bounce'
              : record?.kind === 'miss' || record?.kind === 'no-open'
                ? 'miss'
                : 'validate',
      )
      setGame(next)
      enqueue(() => repository.saveGame(next))
      return record?.knocked ?? []
    },
    [cue, enqueue, game, repository],
  )

  const skipCurrent = useCallback(() => mutateGame(skipTurn), [mutateGame])

  const removeFromGame = useCallback(
    (playerId: string) => mutateGame((current) => removePlayerFromGame(current, playerId)),
    [mutateGame],
  )

  const addToGame = useCallback(
    (player: Player) => mutateGame((current) => addPlayerToGame(current, player)),
    [mutateGame],
  )

  const undo = useCallback(() => mutateGame(undoGame), [mutateGame])

  const abandonGame = useCallback(() => {
    const id = game?.id
    setGame(null)
    setDrawing(false)
    if (id) enqueue(() => repository.deleteGame(id))
  }, [enqueue, game?.id, repository])

  const rematch = useCallback(() => {
    if (!game) return
    // Les joueurs arrivés en cours de partie sont dans le journal, pas dans
    // `game.players` : on repart de la vue pour ne pas les oublier, et on laisse
    // de côté ceux qui ont quitté la table.
    const players = buildView(game)
      .states.filter((state) => !state.removed)
      .map((state) => state.player)
    if (players.length < 2) return
    startGame(players)
  }, [game, startGame])

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      setSettings((current) => {
        const next = { ...current, ...patch }
        enqueue(() => repository.saveSettings(next))
        return next
      })
    },
    [enqueue, repository],
  )

  const orderedTeams = useMemo(() => sortTeams(teams), [teams])

  const value = useMemo<Store>(
    () => ({
      ready,
      roster,
      teams: orderedTeams,
      game,
      gameView,
      settings,
      writeError,
      drawing,
      undoLabel: game && canUndo(game) ? lastEventLabel(game) : null,
      createRosterPlayer,
      renameRosterPlayer,
      deleteRosterPlayer,
      createTeam,
      updateTeam,
      removeTeam,
      startGame,
      finishDrawing,
      submitScore,
      skipCurrent,
      removeFromGame,
      addToGame,
      undo,
      abandonGame,
      rematch,
      updateSettings,
      cue,
    }),
    [
      ready,
      roster,
      orderedTeams,
      game,
      gameView,
      settings,
      writeError,
      drawing,
      createRosterPlayer,
      renameRosterPlayer,
      deleteRosterPlayer,
      createTeam,
      updateTeam,
      removeTeam,
      startGame,
      finishDrawing,
      submitScore,
      skipCurrent,
      removeFromGame,
      addToGame,
      undo,
      abandonGame,
      rematch,
      updateSettings,
      cue,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
