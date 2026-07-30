'use client'

import { useEffect, useState } from 'react'

import { playerColor } from '@/lib/colors'
import { useStore } from '@/lib/store'

/**
 * Tirage au sort du premier joueur.
 *
 * Le vainqueur du tirage est **déjà décidé** par le moteur au moment de la création
 * de la partie : cette animation ne fait que le révéler. Rien ici n'influe sur le
 * résultat — c'est ce qui garantit qu'un rafraîchissement en cours d'animation ne
 * change pas qui commence.
 */
export function FirstPlayerDraw() {
  const { game, finishDrawing, cue } = useStore()
  const players = game?.players ?? []
  const winnerId = game?.firstPlayerId
  const [index, setIndex] = useState(0)
  const [settled, setSettled] = useState(false)

  useEffect(() => {
    if (players.length === 0) return
    const winnerIndex = Math.max(0, players.findIndex((p) => p.id === winnerId))
    let step = 0
    // Défilement qui ralentit, puis s'arrête sur le joueur tiré au sort.
    const total = players.length * 3 + winnerIndex + 1
    let timer: ReturnType<typeof setTimeout>

    const tick = () => {
      setIndex(step % players.length)
      cue('tap')
      step += 1
      if (step >= total) {
        setIndex(winnerIndex)
        setSettled(true)
        cue('validate')
        timer = setTimeout(finishDrawing, 1100)
        return
      }
      timer = setTimeout(tick, 70 + Math.pow(step / total, 3) * 260)
    }

    timer = setTimeout(tick, 220)
    return () => clearTimeout(timer)
    // Volontairement lancé une seule fois : ce sont des effets d'affichage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const current = players[index]
  if (!current) return null

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6">
      <p className="text-[11px] font-bold tracking-[0.22em] text-cream-faint uppercase">
        {settled ? 'Commence la partie' : 'Qui commence ?'}
      </p>

      <div
        key={current.id}
        className={`mt-8 flex size-40 items-center justify-center rounded-full border-2 text-7xl ${
          settled ? 'animate-pop' : ''
        }`}
        style={{
          borderColor: playerColor(current.colorIndex),
          background: `${playerColor(current.colorIndex)}1f`,
        }}
      >
        {current.emoji}
      </div>

      <p
        className="mt-7 font-display text-4xl"
        style={{ color: settled ? playerColor(current.colorIndex) : undefined }}
      >
        {current.name}
      </p>

      {settled && (
        <button
          type="button"
          onClick={finishDrawing}
          className="mt-10 min-h-12 px-6 text-sm font-bold text-cream-dim"
        >
          Continuer
        </button>
      )}
    </main>
  )
}
