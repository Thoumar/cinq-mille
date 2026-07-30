'use client'

import { useEffect, useRef } from 'react'

import { playerColor } from '@/lib/colors'
import type { Knock, PlayerState } from '@/lib/engine'
import { fmt } from '@/lib/format'

const COUNT_MS = 900
const AUTO_DISMISS_MS = 3000

/**
 * Mise en scène du recul : quelqu'un vient de tomber pile sur le score d'un autre.
 *
 * C'est le seul évènement du jeu qui touche un joueur qui n'a rien fait — il doit
 * donc être annoncé, et pas seulement se produire dans le tableau. Le chiffre
 * dégringole réellement de l'ancien score au nouveau : voir la chute vaut mieux que
 * lire deux nombres.
 *
 * La descente est écrite directement dans le DOM, image par image, plutôt que via
 * un état React à 60 rendus par seconde.
 */
export function KnockOverlay({
  shooter,
  knocked,
  victims,
  onDismiss,
}: {
  shooter: PlayerState
  knocked: Knock[]
  victims: PlayerState[]
  onDismiss: () => void
}) {
  const numberRefs = useRef<(HTMLSpanElement | null)[]>([])

  useEffect(() => {
    const start = performance.now()
    let frame = 0

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / COUNT_MS)
      // Chute franche puis atterrissage en douceur.
      const eased = 1 - Math.pow(1 - t, 3)
      knocked.forEach((knock, index) => {
        const node = numberRefs.current[index]
        if (!node) return
        const value = Math.round((knock.from + (knock.to - knock.from) * eased) / 50) * 50
        node.textContent = fmt(value)
      })
      if (t < 1) frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(timer)
    }
  }, [knocked, onDismiss])

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center px-6"
      role="alertdialog"
      aria-label="Un joueur recule"
      onClick={onDismiss}
    >
      <div className="animate-backdrop-in absolute inset-0 bg-felt-950/85" />

      <div className="animate-pop relative w-full max-w-sm rounded-3xl border border-edge bg-felt-800 px-6 py-7 text-center shadow-[0_24px_60px_rgba(0,0,0,0.6)]">
        <p className="text-[11px] font-bold tracking-[0.22em] text-brass uppercase">
          score déjà pris
        </p>

        <p className="mt-4 text-[15px] leading-relaxed text-cream-dim">
          <span className="text-xl">{shooter.player.emoji}</span>{' '}
          <b className="text-cream">{shooter.player.name}</b> tombe pile sur{' '}
          <b className="num text-cream">{fmt(shooter.total)}</b>
        </p>

        <ul className="mt-6 flex flex-col gap-4">
          {knocked.map((knock, index) => {
            const victim = victims.find((v) => v.player.id === knock.playerId)
            if (!victim) return null
            const color = playerColor(victim.player.colorIndex)
            return (
              <li key={knock.playerId}>
                <p className="text-[15px] font-bold" style={{ color }}>
                  {victim.player.emoji} {victim.player.name} recule
                </p>
                <p className="num mt-1.5 flex items-baseline justify-center gap-2.5">
                  <span className="text-[17px] text-cream-faint line-through">
                    {fmt(knock.from)}
                  </span>
                  <span className="text-cream-faint">↓</span>
                  <span
                    ref={(node) => {
                      numberRefs.current[index] = node
                    }}
                    className="text-[2.5rem] leading-none font-black tracking-tight text-brick"
                  >
                    {fmt(knock.from)}
                  </span>
                </p>
              </li>
            )
          })}
        </ul>

        <p className="mt-7 text-[12px] text-cream-faint">tape pour continuer</p>
      </div>
    </div>
  )
}
