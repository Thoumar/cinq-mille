/**
 * Le moteur de score : des fonctions pures, aucun effet de bord, aucune horloge.
 *
 * Principe central : **l'état d'une partie est entièrement dérivé du journal
 * d'évènements**. On ne stocke jamais un total cumulé, on le recalcule. Cela rend
 * l'annulation triviale (retirer le dernier évènement), la courbe de progression
 * gratuite, et le tout parfaitement testable.
 */

import { GOAL, OPENING_THRESHOLD, validateScore } from './rules'

export type Player = {
  id: string
  name: string
  emoji: string
  /** Index dans la palette (voir `lib/colors.ts`) : classement, jauge, courbe. */
  colorIndex: number
}

export type GameEvent =
  | { type: 'turn'; playerId: string; raw: number; at: number }
  | { type: 'skip'; playerId: string }
  | { type: 'remove'; playerId: string }
  | { type: 'join'; player: Player }

export type Game = {
  id: string
  createdAt: number
  /** Ordre de jeu, figé à la création. Les arrivants en cours passent par un évènement `join`. */
  players: Player[]
  /** Tiré au sort au lancement de la partie. */
  firstPlayerId: string
  /** Journal chronologique — la seule source de vérité. */
  events: GameEvent[]
}

export type TurnKind =
  /** Tour normal qui rapporte des points. */
  | 'score'
  /** Tour à zéro. */
  | 'miss'
  /** Tour non nul mais sous le seuil d'ouverture : ne rapporte rien, ne coûte rien. */
  | 'no-open'
  /** Dépassement de 5000 : le joueur redescend du surplus. */
  | 'bounce'
  /** Tombé pile sur 5000. */
  | 'win'

export type TurnOutcome = {
  total: number
  opened: boolean
  /** Delta réellement appliqué au total (négatif sur un rebond, 0 si non ouvrant). */
  applied: number
  kind: TurnKind
}

/** Un joueur renvoyé à son score précédent parce qu'un autre est tombé sur le sien. */
export type Knock = { playerId: string; from: number; to: number }

export type TurnRecord = {
  playerId: string
  /** Le n-ième tour de ce joueur (0-based) — numéro de ligne dans le carnet. */
  row: number
  raw: number
  applied: number
  totalAfter: number
  kind: TurnKind
  at: number
  /** Les joueurs que ce tour a fait reculer. Vide dans l'immense majorité des cas. */
  knocked: Knock[]
}

export type PlayerState = {
  player: Player
  total: number
  opened: boolean
  removed: boolean
  turnsPlayed: number
  /**
   * Total de ce joueur après **chaque tour de la partie**, pas seulement les siens.
   * Cette frise commune est ce qui permet à la courbe de montrer un recul à l'instant
   * exact où il se produit : indexée sur les tours du joueur, elle ne l'aurait affiché
   * qu'à son tour suivant, alors qu'il subit le coup sans rien faire.
   */
  curve: number[]
  /**
   * Suite des totaux réellement occupés, sans les répétitions. C'est elle qui définit
   * le « score précédent » auquel on retombe quand on se fait dégommer : un tour raté
   * n'y ajoute rien, sinon reculer ramènerait au même score.
   */
  trail: number[]
}

export type GameView = {
  /** Dans l'ordre de jeu. */
  states: PlayerState[]
  /** Joueurs encore en partie, triés par total décroissant. */
  standings: PlayerState[]
  records: TurnRecord[]
  /** Grille du carnet : `rows[ligne][index dans states]`. */
  rows: (TurnRecord | null)[][]
  currentPlayerId: string | null
  /** Numéro de tour affiché en en-tête (1-based). */
  currentRound: number
  winnerId: string | null
  finished: boolean
}

/**
 * Le calcul de référence : applique un score de tour à l'état d'un joueur.
 * C'est ici que vivent les trois règles qui cassent en silence — ouverture,
 * rebond, victoire exacte.
 */
export function resolveTurn(total: number, opened: boolean, raw: number): TurnOutcome {
  // Pas encore ouvert et sous le seuil : rien ne bouge, aucune pénalité.
  if (!opened && raw < OPENING_THRESHOLD) {
    return { total, opened: false, applied: 0, kind: raw === 0 ? 'miss' : 'no-open' }
  }

  const sum = total + raw

  // Dépassement : on redescend du surplus, avec un plancher à 0.
  if (sum > GOAL) {
    const bounced = Math.max(0, GOAL - (sum - GOAL))
    return { total: bounced, opened: true, applied: bounced - total, kind: 'bounce' }
  }

  return {
    total: sum,
    opened: true,
    applied: raw,
    kind: sum === GOAL ? 'win' : raw === 0 ? 'miss' : 'score',
  }
}

function blankState(player: Player): PlayerState {
  return {
    player,
    total: 0,
    opened: false,
    removed: false,
    turnsPlayed: 0,
    curve: [0],
    trail: [0],
  }
}

/**
 * Tomber pile sur le score d'un adversaire le renvoie à son score précédent.
 *
 * Deux garde-fous non négociables : le zéro ne déclenche rien — tout le monde y
 * commence, la table entière reculerait au premier tour raté — et un joueur non
 * ouvert n'est ni tireur ni cible. Pas de réaction en chaîne non plus : seul le
 * joueur qui vient de jouer fait reculer, celui qui recule ne dégomme personne.
 */
function collide(shooter: PlayerState, everyone: PlayerState[]): Knock[] {
  if (!shooter.opened || shooter.total <= 0) return []

  const knocked: Knock[] = []
  for (const victim of everyone) {
    if (victim === shooter || victim.removed || !victim.opened) continue
    if (victim.total !== shooter.total) continue

    const from = victim.total
    victim.trail.pop()
    const to = victim.trail.at(-1) ?? 0
    victim.total = to
    knocked.push({ playerId: victim.player.id, from, to })
  }
  return knocked
}

/** Rejoue le journal et renvoie tout ce dont l'interface a besoin. */
export function view(game: Game): GameView {
  const order: Player[] = [...game.players]
  const byId = new Map<string, PlayerState>()
  for (const p of order) byId.set(p.id, blankState(p))

  const records: TurnRecord[] = []
  let current: string | null = game.firstPlayerId
  let winnerId: string | null = null
  /** Position sur la frise commune : un cran par tour joué, tous joueurs confondus. */
  let step = 0

  /** Joueur actif suivant, en tournant dans l'ordre de jeu. */
  const nextFrom = (from: string): string | null => {
    const i = order.findIndex((p) => p.id === from)
    if (i < 0) return order.find((p) => !byId.get(p.id)?.removed)?.id ?? null
    for (let k = 1; k <= order.length; k++) {
      const candidate = order[(i + k) % order.length]
      if (!byId.get(candidate.id)?.removed) return candidate.id
    }
    return null
  }

  for (const event of game.events) {
    // Une partie gagnée est close : les évènements suivants sont ignorés.
    if (winnerId) break

    switch (event.type) {
      case 'turn': {
        const state = byId.get(event.playerId)
        if (!state) break
        const outcome = resolveTurn(state.total, state.opened, event.raw)
        const moved = outcome.total !== state.total
        state.total = outcome.total
        state.opened = outcome.opened
        state.turnsPlayed += 1
        // Un tour qui ne déplace pas le compteur ne laisse pas de trace : sinon
        // reculer d'un cran ramènerait exactement au même score.
        if (moved) state.trail.push(outcome.total)

        // La victoire clôt la partie : personne ne recule sur le fil.
        const knocked =
          outcome.kind === 'win' ? [] : collide(state, [...byId.values()])

        records.push({
          playerId: event.playerId,
          row: state.turnsPlayed - 1,
          raw: event.raw,
          applied: outcome.applied,
          totalAfter: outcome.total,
          kind: outcome.kind,
          at: event.at,
          knocked,
        })

        // Un cran de frise après chaque tour, une fois les reculs appliqués : la
        // courbe de la victime décroche donc au tour qui l'a fait reculer.
        step += 1
        for (const other of byId.values()) other.curve.push(other.total)

        if (outcome.kind === 'win') {
          winnerId = event.playerId
          current = event.playerId
        } else {
          current = nextFrom(event.playerId)
        }
        break
      }
      case 'skip':
        current = nextFrom(event.playerId)
        break
      case 'remove': {
        const state = byId.get(event.playerId)
        if (!state) break
        state.removed = true
        if (current === event.playerId) current = nextFrom(event.playerId)
        break
      }
      case 'join':
        if (!byId.has(event.player.id)) {
          order.push(event.player)
          const joined = blankState(event.player)
          // Aligner l'arrivant sur la frise : il était à zéro avant d'entrer.
          joined.curve = new Array(step + 1).fill(0)
          byId.set(event.player.id, joined)
        }
        break
    }
  }

  const states = order.map((p) => byId.get(p.id)!)

  // Grille du carnet, alignée sur `states`.
  const cells = new Map<string, TurnRecord>()
  for (const r of records) cells.set(`${r.playerId}:${r.row}`, r)
  const maxRows = states.reduce((m, s) => Math.max(m, s.turnsPlayed), 0)
  const rows: (TurnRecord | null)[][] = []
  for (let row = 0; row < maxRows; row++) {
    rows.push(states.map((s) => cells.get(`${s.player.id}:${row}`) ?? null))
  }

  const rank = new Map(order.map((p, i) => [p.id, i]))
  const standings = states
    .filter((s) => !s.removed)
    .sort(
      (a, b) =>
        b.total - a.total || (rank.get(a.player.id) ?? 0) - (rank.get(b.player.id) ?? 0),
    )

  const currentState = current ? byId.get(current) : undefined
  const currentPlayerId = currentState && !currentState.removed ? current : null

  return {
    states,
    standings,
    records,
    rows,
    currentPlayerId,
    currentRound: winnerId
      ? Math.max(1, maxRows)
      : (currentState?.turnsPlayed ?? 0) + 1,
    winnerId,
    finished: winnerId !== null,
  }
}

/** Ce que donnerait `raw` pour le joueur courant, sans rien modifier. */
export function previewTurn(
  game: Game,
  raw: number,
): { state: PlayerState; outcome: TurnOutcome } | null {
  const v = view(game)
  if (!v.currentPlayerId || v.finished) return null
  const state = v.states.find((s) => s.player.id === v.currentPlayerId)
  if (!state) return null
  return { state, outcome: resolveTurn(state.total, state.opened, raw) }
}

export function playTurn(game: Game, raw: number, at: number): Game {
  const v = view(game)
  if (v.finished) throw new Error('la partie est terminée')
  if (!v.currentPlayerId) throw new Error('aucun joueur actif')
  const rejection = validateScore(raw)
  if (rejection) throw new Error(`score refusé (${rejection})`)
  return {
    ...game,
    events: [...game.events, { type: 'turn', playerId: v.currentPlayerId, raw, at }],
  }
}

export function skipTurn(game: Game): Game {
  const v = view(game)
  if (v.finished || !v.currentPlayerId) return game
  return { ...game, events: [...game.events, { type: 'skip', playerId: v.currentPlayerId }] }
}

export function removePlayer(game: Game, playerId: string): Game {
  return { ...game, events: [...game.events, { type: 'remove', playerId }] }
}

export function addPlayer(game: Game, player: Player): Game {
  return { ...game, events: [...game.events, { type: 'join', player }] }
}

export function canUndo(game: Game): boolean {
  return game.events.length > 0
}

/**
 * Retire le dernier évènement du journal. Comme tout est recalculé, cela restaure
 * exactement l'état précédent : total, ouverture, joueur courant, et statut de
 * victoire si le dernier coup avait terminé la partie.
 */
export function undo(game: Game): Game {
  if (!canUndo(game)) return game
  return { ...game, events: game.events.slice(0, -1) }
}

/** Libellé du dernier évènement, pour l'intitulé du bouton d'annulation. */
export function lastEventLabel(game: Game): string | null {
  const last = game.events.at(-1)
  if (!last) return null
  switch (last.type) {
    case 'turn':
      return 'le dernier score'
    case 'skip':
      return 'le tour passé'
    case 'remove':
      return 'le retrait du joueur'
    case 'join':
      return "l'ajout du joueur"
  }
}

export type GameStats = {
  rounds: number
  durationMs: number
  bestTurn: { playerId: string; raw: number; row: number } | null
  /** Moyenne par tour du vainqueur, arrondie. */
  winnerAverage: number | null
  mostMisses: { playerId: string; count: number } | null
  mostBounces: { playerId: string; count: number } | null
}

export function stats(game: Game): GameStats {
  const v = view(game)
  const scored = v.records.filter((r) => r.kind !== 'no-open')

  let bestTurn: GameStats['bestTurn'] = null
  for (const r of scored) {
    if (r.raw > 0 && (!bestTurn || r.raw > bestTurn.raw)) {
      bestTurn = { playerId: r.playerId, raw: r.raw, row: r.row }
    }
  }

  const count = (predicate: (r: TurnRecord) => boolean) => {
    const tally = new Map<string, number>()
    for (const r of v.records) {
      if (predicate(r)) tally.set(r.playerId, (tally.get(r.playerId) ?? 0) + 1)
    }
    let top: { playerId: string; count: number } | null = null
    for (const [playerId, c] of tally) {
      if (!top || c > top.count) top = { playerId, count: c }
    }
    return top
  }

  const winner = v.winnerId ? v.states.find((s) => s.player.id === v.winnerId) : undefined
  const winnerTurns = winner?.turnsPlayed ?? 0
  const winnerRaws = v.records.filter((r) => r.playerId === v.winnerId)

  const lastAt = v.records.at(-1)?.at ?? game.createdAt

  return {
    rounds: v.rows.length,
    durationMs: Math.max(0, lastAt - game.createdAt),
    bestTurn,
    winnerAverage:
      winnerTurns > 0
        ? Math.round(winnerRaws.reduce((sum, r) => sum + r.raw, 0) / winnerTurns)
        : null,
    mostMisses: count((r) => r.kind === 'miss'),
    mostBounces: count((r) => r.kind === 'bounce'),
  }
}

/**
 * Progression par joueur sur la frise commune : un point par tour de la partie.
 * Toutes les séries ont donc la même longueur et se lisent au même instant.
 */
export function progression(game: Game): { player: Player; totals: number[] }[] {
  return view(game).states.map((s) => ({ player: s.player, totals: s.curve }))
}

export function createGame(params: {
  id: string
  players: Player[]
  firstPlayerId: string
  createdAt: number
}): Game {
  return { ...params, events: [] }
}

/** Tire au sort le joueur qui commence. Le seul endroit non déterministe du domaine. */
export function drawFirstPlayer(players: Player[], random = Math.random): Player {
  if (players.length === 0) throw new Error('aucun joueur')
  return players[Math.floor(random() * players.length)]
}

export const GOAL_SCORE = GOAL
