'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

import { ScoreSheet } from '@/components/ScoreSheet'
import { fmt, plural } from '@/lib/format'
import { GOAL } from '@/lib/rules'
import { useStore } from '@/lib/store'

/**
 * Le carnet, en page à part entière.
 *
 * Il était auparavant dans une feuille remontante : mauvais contenant pour un
 * tableau qu'on vient consulter et parcourir dans les deux axes. Une feuille se
 * ferme au moindre glissement vers le bas, ce qui entre directement en conflit
 * avec le geste de lecture.
 */
export default function CarnetPage() {
  const { ready, game, gameView } = useStore()
  const router = useRouter()

  // Arrivée directe sur l'URL sans partie en cours : on repart de l'accueil.
  useEffect(() => {
    if (ready && !game) router.replace('/')
  }, [ready, game, router])

  if (!ready || !gameView) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <span className="font-display text-4xl text-brass/40">5000</span>
      </main>
    )
  }

  const turns = gameView.rows.length

  return (
    <main className="flex flex-1 flex-col overflow-hidden px-4 pt-safe pb-safe">
      <header className="flex shrink-0 items-center justify-between gap-3 py-3">
        <Link
          href="/"
          className="-ml-2 flex min-h-11 items-center gap-1 px-2 text-[15px] font-bold text-cream-dim"
        >
          <span className="text-xl leading-none">‹</span> Partie
        </Link>
        <div className="text-right">
          <p className="font-display text-xl leading-none">Le carnet</p>
          <p className="num mt-1 text-[11.5px] text-cream-faint">
            {turns} {plural(turns, 'tour')} · objectif {fmt(GOAL)}
          </p>
        </div>
      </header>

      <ScoreSheet view={gameView} className="min-h-0 flex-1" />

      <p className="shrink-0 pt-3 text-[11.5px] leading-relaxed text-cream-faint">
        Un score <span className="line-through decoration-brick">barré</span> est un tour
        sous les 500 avant ouverture : il ne compte pas. Un « ↰ » signale un rebond
        au-dessus de {fmt(GOAL)}.
      </p>
    </main>
  )
}
