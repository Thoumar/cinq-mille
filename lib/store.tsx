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

type Store = {
  ready: boolean
  roster: Player[]
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

  startGame: (players: Player[]) => void
  finishDrawing: () => void
  submitScore: (raw: number) => void
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
      const [players, current, preferences] = await Promise.all([
        repository.listPlayers(),
        repository.loadGame(),
        repository.loadSettings(),
      ])
      if (cancelled) return
      setRoster(players)
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

  const startGame = useCallback(
    (players: Player[]) => {
      const fresh = createGame({
        id: newId(),
        players,
        firstPlayerId: drawFirstPlayer(players).id,
        createdAt: Date.now(),
      })
      setGame(fresh)
      setDrawing(true)
      enqueue(() => repository.saveGame(fresh))
    },
    [enqueue, repository],
  )

  const finishDrawing = useCallback(() => setDrawing(false), [])

  const submitScore = useCallback(
    (raw: number) => {
      setGame((current) => {
        if (!current) return current
        let next: Game
        try {
          next = playTurn(current, raw, Date.now())
        } catch {
          // Saisie invalide : l'interface l'empêche déjà, on ne casse rien ici.
          return current
        }
        const after = buildView(next)
        const record = after.records.at(-1)
        cue(
          after.finished
            ? 'win'
            : record?.kind === 'bounce'
              ? 'bounce'
              : record?.kind === 'miss' || record?.kind === 'no-open'
                ? 'miss'
                : 'validate',
        )
        enqueue(() => repository.saveGame(next))
        return next
      })
    },
    [cue, enqueue, repository],
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
    const players = game?.players
    if (!players || players.length === 0) return
    startGame(players)
  }, [game?.players, startGame])

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

  const value = useMemo<Store>(
    () => ({
      ready,
      roster,
      game,
      gameView,
      settings,
      writeError,
      drawing,
      undoLabel: game && canUndo(game) ? lastEventLabel(game) : null,
      createRosterPlayer,
      renameRosterPlayer,
      deleteRosterPlayer,
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
      game,
      gameView,
      settings,
      writeError,
      drawing,
      createRosterPlayer,
      renameRosterPlayer,
      deleteRosterPlayer,
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
