'use client'

import { playerColor } from '@/lib/colors'
import { progression, stats } from '@/lib/engine'
import { fmt, formatDuration, plural } from '@/lib/format'
import { GOAL } from '@/lib/rules'
import { useStore } from '@/lib/store'

import { ProgressChart } from './ProgressChart'
import { ScoreSheet } from './ScoreSheet'

export function VictoryScreen() {
  const { game, gameView, rematch, abandonGame, undo } = useStore()
  if (!game || !gameView) return null

  const summary = stats(game)
  const winner = gameView.states.find((s) => s.player.id === gameView.winnerId)
  const nameOf = (playerId: string | undefined) =>
    gameView.states.find((s) => s.player.id === playerId)?.player

  if (!winner) return null

  return (
    /* Le bilan est le seul écran au contenu réellement long : il défile dans sa
       bande, les deux actions de sortie restent fixes en bas. */
    <main className="flex flex-1 flex-col overflow-hidden px-4 pt-safe pb-safe">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <section className="pt-8 pb-8 text-center">
        <p className="animate-trophy text-5xl">🏆</p>
        <p className="mt-4 text-6xl leading-none">{winner.player.emoji}</p>
        <h1
          className="font-display mt-3 text-4xl leading-tight"
          style={{ color: playerColor(winner.player.colorIndex) }}
        >
          {winner.player.name} gagne
        </h1>
        <p className="num mt-2 text-[13px] text-cream-dim">
          {fmt(GOAL)} pile · {summary.rounds} {plural(summary.rounds, 'tour')} ·{' '}
          {formatDuration(summary.durationMs)}
        </p>
      </section>

      <ProgressChart series={progression(game)} />

      <section className="mt-7 grid grid-cols-2 gap-2.5">
        <Stat
          label="Meilleur tour"
          value={summary.bestTurn ? fmt(summary.bestTurn.raw) : '—'}
          who={
            summary.bestTurn
              ? `${nameOf(summary.bestTurn.playerId)?.emoji ?? ''} ${
                  nameOf(summary.bestTurn.playerId)?.name ?? ''
                } · tour ${summary.bestTurn.row + 1}`
              : undefined
          }
        />
        <Stat
          label="Moyenne / tour"
          value={summary.winnerAverage !== null ? fmt(summary.winnerAverage) : '—'}
          who={`${winner.player.emoji} ${winner.player.name}`}
        />
        <Stat
          label="Tours ratés"
          value={summary.mostMisses ? String(summary.mostMisses.count) : '0'}
          who={
            summary.mostMisses
              ? `${nameOf(summary.mostMisses.playerId)?.emoji ?? ''} ${
                  nameOf(summary.mostMisses.playerId)?.name ?? ''
                }`
              : 'personne'
          }
        />
        <Stat
          label={`Rebonds > ${fmt(GOAL)}`}
          value={summary.mostBounces ? String(summary.mostBounces.count) : '0'}
          who={
            summary.mostBounces
              ? `${nameOf(summary.mostBounces.playerId)?.emoji ?? ''} ${
                  nameOf(summary.mostBounces.playerId)?.name ?? ''
                }`
              : 'personne'
          }
        />
      </section>

      <details className="mt-5">
        <summary className="min-h-11 cursor-pointer list-none text-center text-[13px] font-bold text-cream-dim">
          Revoir le carnet
        </summary>
        <div className="mt-3">
          <ScoreSheet view={gameView} />
        </div>
      </details>

      {/* Une faute de frappe peut déclencher une victoire. Sans cette porte de
          sortie, la seule issue serait d'abandonner la partie. */}
      <div className="text-center">
        <button
          type="button"
          onClick={undo}
          className="mt-5 mb-2 min-h-11 px-4 text-[13px] font-bold text-cream-faint"
        >
          ↶ Ce n’était pas ça — annuler le dernier score
        </button>
      </div>
      </div>

      <div className="flex shrink-0 flex-col gap-2.5 pt-4">
        <button
          type="button"
          onClick={rematch}
          className="flex min-h-16 w-full items-center justify-center rounded-2xl bg-linear-to-b from-brass-bright to-brass text-[17px] font-black text-felt-950"
        >
          Revanche · mêmes joueurs
        </button>
        <button
          type="button"
          onClick={abandonGame}
          className="flex min-h-13 w-full items-center justify-center rounded-2xl border border-edge text-[15px] font-bold text-cream-dim"
        >
          Nouvelle partie
        </button>
      </div>
    </main>
  )
}

function Stat({ label, value, who }: { label: string; value: string; who?: string }) {
  return (
    <div className="rounded-2xl border border-edge bg-felt-800 px-3.5 py-3">
      <p className="text-[10.5px] font-bold tracking-[0.1em] text-cream-faint uppercase">
        {label}
      </p>
      <p className="num mt-1.5 text-[21px] font-black">{value}</p>
      {who && <p className="mt-0.5 truncate text-[12px] text-cream-dim">{who}</p>}
    </div>
  )
}
