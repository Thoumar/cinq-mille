'use client'

import { FirstPlayerDraw } from '@/components/FirstPlayerDraw'
import { GameScreen } from '@/components/GameScreen'
import { SetupScreen } from '@/components/SetupScreen'
import { VictoryScreen } from '@/components/VictoryScreen'
import { useStore } from '@/lib/store'

/**
 * Aiguillage entre les quatre états de l'application. Pas de routeur : l'app n'a
 * aucune URL à partager et une navigation arrière accidentelle en pleine partie
 * serait une régression, pas une fonctionnalité.
 */
export default function Home() {
  const { ready, game, gameView, drawing } = useStore()

  if (!ready) {
    // Écran d'attente explicite : un simple logo pâle sur fond sombre se lit comme
    // « la page est cassée » plutôt que comme « ça charge ».
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3">
        <span className="font-display text-5xl text-brass">5000</span>
        <span className="text-[13px] text-cream-faint">chargement du carnet…</span>
      </main>
    )
  }

  if (!game) return <SetupScreen />
  if (drawing) return <FirstPlayerDraw />
  if (gameView?.finished) return <VictoryScreen />
  return <GameScreen />
}
