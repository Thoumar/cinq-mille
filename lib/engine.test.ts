import { describe, expect, it } from 'vitest'

import {
  addPlayer,
  createGame,
  drawFirstPlayer,
  type Game,
  type Player,
  playTurn,
  progression,
  removePlayer,
  resolveTurn,
  skipTurn,
  stats,
  undo,
  view,
} from './engine'
import { GOAL, OPENING_THRESHOLD } from './rules'

const player = (id: string, colorIndex = 0): Player => ({
  id,
  name: id,
  emoji: '🐻',
  colorIndex,
})

const [alice, bob, carol] = [player('alice', 0), player('bob', 1), player('carol', 2)]

function newGame(players: Player[] = [alice, bob], first = players[0].id): Game {
  return createGame({ id: 'g1', players, firstPlayerId: first, createdAt: 0 })
}

/** Enchaîne des tours en attribuant un horodatage croissant. */
function play(game: Game, ...raws: number[]): Game {
  return raws.reduce((acc, raw, i) => playTurn(acc, raw, (i + 1) * 60_000), game)
}

function totalOf(game: Game, id: string): number {
  return view(game).states.find((s) => s.player.id === id)!.total
}

function stateOf(game: Game, id: string) {
  return view(game).states.find((s) => s.player.id === id)!
}

// ---------------------------------------------------------------- ouverture

describe('ouverture — seuil de 500', () => {
  it('un tour sous le seuil ne rapporte rien et ne coûte rien', () => {
    expect(resolveTurn(0, false, 450)).toEqual({
      total: 0,
      opened: false,
      applied: 0,
      kind: 'no-open',
    })
  })

  it('exactement 500 ouvre la partie', () => {
    expect(resolveTurn(0, false, OPENING_THRESHOLD)).toEqual({
      total: 500,
      opened: true,
      applied: 500,
      kind: 'score',
    })
  })

  it('au-dessus du seuil, ouvre et marque', () => {
    expect(resolveTurn(0, false, 550)).toMatchObject({ total: 550, opened: true })
  })

  it('deux tours ratés d’affilée laissent le joueur à zéro et fermé', () => {
    const g = play(newGame([alice]), 400, 450)
    expect(stateOf(g, 'alice')).toMatchObject({ total: 0, opened: false, turnsPlayed: 2 })
  })

  it('un joueur ouvert n’est plus soumis au seuil', () => {
    const g = play(newGame([alice]), 500, 100)
    expect(totalOf(g, 'alice')).toBe(600)
  })

  it('un tour à zéro avant ouverture est un tour raté, pas un « non ouvrant »', () => {
    expect(resolveTurn(0, false, 0).kind).toBe('miss')
  })

  it('jamais de score négatif avant ouverture', () => {
    const g = play(newGame([alice]), 450, 450, 450)
    expect(totalOf(g, 'alice')).toBe(0)
  })
})

// ---------------------------------------------------------------- rebond

describe('rebond au-dessus de 5000', () => {
  it('4900 + 300 redescend à 4800', () => {
    expect(resolveTurn(4900, true, 300)).toEqual({
      total: 4800,
      opened: true,
      applied: -100,
      kind: 'bounce',
    })
  })

  it('4900 + 600 redescend à 4500', () => {
    expect(resolveTurn(4900, true, 600).total).toBe(4500)
  })

  it('4900 + 2000 redescend à 3100', () => {
    expect(resolveTurn(4900, true, 2000).total).toBe(3100)
  })

  it('un rebond qui passerait sous zéro est plafonné à zéro', () => {
    expect(resolveTurn(4900, true, 5200)).toMatchObject({ total: 0, kind: 'bounce' })
  })

  it('le joueur reste ouvert après un rebond, même ramené à zéro', () => {
    expect(resolveTurn(4900, true, 5200).opened).toBe(true)
  })

  it('un rebond ne peut jamais tomber sur 5000 (donc jamais gagner)', () => {
    for (let raw = 150; raw <= 6000; raw += 50) {
      const outcome = resolveTurn(4900, true, raw)
      if (outcome.kind === 'bounce') expect(outcome.total).not.toBe(GOAL)
    }
  })
})

// ---------------------------------------------------------------- victoire

describe('victoire', () => {
  it('tomber pile sur 5000 gagne', () => {
    expect(resolveTurn(4900, true, 100)).toMatchObject({ total: GOAL, kind: 'win' })
  })

  it('4950 + 50 gagne', () => {
    expect(resolveTurn(4950, true, 50).kind).toBe('win')
  })

  it('la partie est marquée terminée et le vainqueur désigné', () => {
    const g = play(newGame([alice]), 4900, 100)
    const v = view(g)
    expect(v.finished).toBe(true)
    expect(v.winnerId).toBe('alice')
  })

  it('plus aucun score n’est acceptable après la victoire', () => {
    const g = play(newGame([alice]), 4900, 100)
    expect(() => playTurn(g, 100, 1)).toThrow(/terminée/)
  })

  it('les évènements ajoutés après la victoire sont ignorés au rejeu', () => {
    const won = play(newGame([alice, bob]), 4900, 500, 100)
    const tampered: Game = {
      ...won,
      events: [...won.events, { type: 'turn', playerId: 'bob', raw: 1000, at: 9 }],
    }
    expect(totalOf(tampered, 'bob')).toBe(500)
  })
})

// ---------------------------------------------------------------- validation

describe('validation de la saisie', () => {
  it('refuse un non-multiple de 50', () => {
    expect(() => playTurn(newGame(), 130, 1)).toThrow(/not-multiple/)
  })

  it('refuse un score négatif', () => {
    expect(() => playTurn(newGame(), -50, 1)).toThrow(/negative/)
  })

  it('refuse un score non entier', () => {
    expect(() => playTurn(newGame(), 150.5, 1)).toThrow(/not-integer/)
  })

  it('accepte zéro (tour raté)', () => {
    expect(() => playTurn(newGame(), 0, 1)).not.toThrow()
  })
})

// ---------------------------------------------------------------- rotation

describe('rotation des joueurs', () => {
  it('le premier joueur est celui tiré au sort', () => {
    const g = newGame([alice, bob, carol], 'bob')
    expect(view(g).currentPlayerId).toBe('bob')
  })

  it('avance au suivant après chaque tour, en boucle', () => {
    let g = newGame([alice, bob, carol], 'bob')
    g = play(g, 500)
    expect(view(g).currentPlayerId).toBe('carol')
    g = playTurn(g, 500, 2)
    expect(view(g).currentPlayerId).toBe('alice')
    g = playTurn(g, 500, 3)
    expect(view(g).currentPlayerId).toBe('bob')
  })

  it('passer un tour avance sans créer de ligne au carnet', () => {
    const g = skipTurn(newGame([alice, bob]))
    const v = view(g)
    expect(v.currentPlayerId).toBe('bob')
    expect(v.rows).toHaveLength(0)
  })

  it('retirer le joueur courant passe la main au suivant', () => {
    const g = removePlayer(newGame([alice, bob, carol]), 'alice')
    expect(view(g).currentPlayerId).toBe('bob')
  })

  it('un joueur retiré disparaît du classement mais garde ses tours au carnet', () => {
    let g = play(newGame([alice, bob]), 500)
    g = removePlayer(g, 'alice')
    const v = view(g)
    expect(v.standings.map((s) => s.player.id)).toEqual(['bob'])
    expect(v.rows[0][0]?.raw).toBe(500)
  })

  it('la rotation saute les joueurs retirés', () => {
    let g = newGame([alice, bob, carol])
    g = removePlayer(g, 'bob')
    g = play(g, 500)
    expect(view(g).currentPlayerId).toBe('carol')
  })

  it('un joueur qui rejoint en cours entre à zéro et non ouvert', () => {
    let g = play(newGame([alice, bob]), 500, 500)
    g = addPlayer(g, carol)
    const state = stateOf(g, 'carol')
    expect(state).toMatchObject({ total: 0, opened: false, turnsPlayed: 0 })
    expect(view(g).standings).toHaveLength(3)
  })

  it('un arrivant s’insère en fin d’ordre de passage', () => {
    let g = play(newGame([alice, bob]), 500)
    g = addPlayer(g, carol)
    g = playTurn(g, 500, 2) // bob
    expect(view(g).currentPlayerId).toBe('carol')
  })

  it('avec un seul joueur restant, la main lui revient', () => {
    let g = newGame([alice, bob])
    g = removePlayer(g, 'bob')
    g = play(g, 500)
    expect(view(g).currentPlayerId).toBe('alice')
  })

  it('plus aucun joueur actif : aucun joueur courant', () => {
    let g = newGame([alice])
    g = removePlayer(g, 'alice')
    expect(view(g).currentPlayerId).toBeNull()
  })
})

// ---------------------------------------------------------------- collisions

describe('tomber sur le score d’un adversaire', () => {
  it('renvoie l’adversaire à son score précédent', () => {
    // alice 550 puis 800 ; bob 500 puis tombe pile sur 800.
    const g = play(newGame([alice, bob]), 550, 500, 250, 300)
    expect(totalOf(g, 'bob')).toBe(800)
    expect(totalOf(g, 'alice')).toBe(550)
  })

  it('consigne le recul dans le tour qui l’a provoqué', () => {
    const g = play(newGame([alice, bob]), 550, 500, 250, 300)
    expect(view(g).records.at(-1)?.knocked).toEqual([
      { playerId: 'alice', from: 800, to: 550 },
    ])
  })

  it('un tour raté ne crée pas de palier, donc le recul saute par-dessus', () => {
    // alice : 550 → 800, puis un tour à zéro. Elle doit revenir à 550, pas à 800.
    let g = play(newGame([alice, bob]), 550, 500, 250, 0)
    g = playTurn(g, 0, 5) // alice rate
    g = playTurn(g, 300, 6) // bob atteint 800
    expect(totalOf(g, 'alice')).toBe(550)
  })

  it('le zéro ne déclenche rien : tout le monde y commence', () => {
    const g = play(newGame([alice, bob]), 0, 0)
    expect(view(g).records.at(-1)?.knocked).toEqual([])
    expect(totalOf(g, 'alice')).toBe(0)
  })

  it('un joueur non ouvert n’est pas une cible', () => {
    // alice tente 400 : elle reste à 0 sans être ouverte. bob ouvre à 500.
    const g = play(newGame([alice, bob]), 400, 500)
    expect(view(g).records.at(-1)?.knocked).toEqual([])
    expect(totalOf(g, 'bob')).toBe(500)
  })

  it('le tour victorieux ne fait reculer personne', () => {
    // 5000 ne peut jamais être occupé — y arriver termine la partie — mais la
    // garde reste, sinon un futur assouplissement de la victoire ferait reculer
    // quelqu'un sur le fil.
    const g = play(newGame([alice, bob]), 4900, 500, 100)
    const v = view(g)
    expect(v.winnerId).toBe('alice')
    expect(v.records.at(-1)?.knocked).toEqual([])
    expect(totalOf(g, 'bob')).toBe(500)
  })

  it('un rebond qui retombe sur un score occupé fait reculer aussi', () => {
    // bob s'installe à 4800 ; alice à 4900 marque 300 et rebondit pile sur 4800.
    let g = play(newGame([alice, bob]), 4900, 4800)
    g = playTurn(g, 300, 5)
    expect(totalOf(g, 'alice')).toBe(4800)
    expect(totalOf(g, 'bob')).toBe(0)
  })

  it('annuler le tour ramène la victime à son score', () => {
    const g = play(newGame([alice, bob]), 550, 500, 250, 300)
    expect(totalOf(undo(g), 'alice')).toBe(800)
  })

  it('fait reculer tous les joueurs posés sur le même score, sans réaction en chaîne', () => {
    const dave = player('dave', 3)
    const eve = player('eve', 4)
    let g = newGame([alice, bob, carol, dave, eve])
    const turns = [
      550, // alice ouvre à 550
      500, // bob ouvre à 500
      400, // carol sous le seuil : reste à 0
      600, // dave ouvre à 600
      400, // eve sous le seuil : reste à 0
      250, // alice → 800, elle libère 550
      0, // bob rate
      550, // carol prend le 550 laissé vacant
      200, // dave → 800 : alice recule sur 550… déjà occupé par carol
    ]
    turns.forEach((raw, i) => {
      g = playTurn(g, raw, i + 1)
    })

    // Le recul d'alice ne dégomme pas carol : seul le joueur qui vient de jouer
    // fait reculer les autres.
    expect(totalOf(g, 'alice')).toBe(550)
    expect(totalOf(g, 'carol')).toBe(550)

    // eve ouvre pile sur 550 : les deux reculent d'un coup.
    g = playTurn(g, 550, 10)
    const knocked = view(g).records.at(-1)?.knocked ?? []
    expect(knocked.map((k) => k.playerId).sort()).toEqual(['alice', 'carol'])
    expect(totalOf(g, 'alice')).toBe(0)
    expect(totalOf(g, 'carol')).toBe(0)
    expect(totalOf(g, 'eve')).toBe(550)
  })
})

// ---------------------------------------------------------------- annulation

describe('annulation', () => {
  it('annuler un tour ouvrant referme le joueur', () => {
    const g = undo(play(newGame([alice]), 500))
    expect(stateOf(g, 'alice')).toMatchObject({ total: 0, opened: false, turnsPlayed: 0 })
  })

  it('annuler un rebond restaure le total d’avant', () => {
    const g = play(newGame([alice]), 4900, 300)
    expect(totalOf(g, 'alice')).toBe(4800)
    expect(totalOf(undo(g), 'alice')).toBe(4900)
  })

  it('annuler le tour victorieux relance la partie', () => {
    const g = play(newGame([alice, bob]), 4900, 500, 100)
    expect(view(g).finished).toBe(true)
    const back = undo(g)
    expect(view(back).finished).toBe(false)
    expect(view(back).winnerId).toBeNull()
    expect(view(back).currentPlayerId).toBe('alice')
  })

  it('annuler rend la main au joueur qui vient de jouer', () => {
    const g = undo(play(newGame([alice, bob]), 500))
    expect(view(g).currentPlayerId).toBe('alice')
  })

  it('annuler sur une partie vierge ne change rien', () => {
    const g = newGame()
    expect(undo(g)).toEqual(g)
  })

  it('annuler un retrait remet le joueur en partie', () => {
    const g = undo(removePlayer(newGame([alice, bob]), 'bob'))
    expect(view(g).standings).toHaveLength(2)
  })
})

// ---------------------------------------------------------------- carnet & stats

describe('carnet et statistiques', () => {
  it('le carnet est une grille alignée sur l’ordre de jeu', () => {
    const g = play(newGame([alice, bob]), 550, 400, 300, 600)
    const v = view(g)
    expect(v.rows).toHaveLength(2)
    expect(v.rows[0].map((c) => c?.raw)).toEqual([550, 400])
    expect(v.rows[1].map((c) => c?.raw)).toEqual([300, 600])
  })

  it('les cases manquantes sont nulles quand un joueur a joué moins de tours', () => {
    const g = play(newGame([alice, bob]), 550, 400, 300)
    expect(view(g).rows[1].map((c) => c?.raw ?? null)).toEqual([300, null])
  })

  it('le numéro de tour affiché suit le joueur courant', () => {
    let g = newGame([alice, bob])
    expect(view(g).currentRound).toBe(1)
    g = play(g, 500)
    expect(view(g).currentRound).toBe(1) // c'est au tour de bob, son 1er tour
    g = playTurn(g, 500, 2)
    expect(view(g).currentRound).toBe(2)
  })

  it('la progression part de zéro et suit les totaux', () => {
    const g = play(newGame([alice]), 550, 300)
    expect(progression(g)[0].totals).toEqual([0, 550, 850])
  })

  it('les statistiques relèvent le meilleur tour et les tours ratés', () => {
    const g = play(newGame([alice, bob]), 1200, 500, 0, 600)
    const s = stats(g)
    expect(s.bestTurn).toMatchObject({ playerId: 'alice', raw: 1200 })
    expect(s.mostMisses).toMatchObject({ playerId: 'alice', count: 1 })
    expect(s.rounds).toBe(2)
  })

  it('les statistiques comptent les rebonds', () => {
    const g = play(newGame([alice]), 4900, 300)
    expect(stats(g).mostBounces).toMatchObject({ playerId: 'alice', count: 1 })
  })

  it('la durée est calculée depuis les horodatages des tours', () => {
    const g = play(newGame([alice]), 500, 500)
    expect(stats(g).durationMs).toBe(120_000)
  })

  it('la moyenne par tour du vainqueur est arrondie', () => {
    const g = play(newGame([alice]), 4900, 100)
    expect(stats(g).winnerAverage).toBe(2500)
  })
})

// ---------------------------------------------------------------- tirage au sort

describe('tirage au sort du premier joueur', () => {
  it('respecte la source d’aléa injectée', () => {
    expect(drawFirstPlayer([alice, bob, carol], () => 0).id).toBe('alice')
    expect(drawFirstPlayer([alice, bob, carol], () => 0.99).id).toBe('carol')
  })

  it('refuse une liste vide', () => {
    expect(() => drawFirstPlayer([], () => 0)).toThrow()
  })
})
