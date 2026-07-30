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
    return (
      <main className="flex flex-1 items-center justify-center">
        <span className="font-display text-4xl text-brass/40">5000</span>
      </main>
    )
  }

  if (!game) return <SetupScreen />
  if (drawing) return <FirstPlayerDraw />
  if (gameView?.finished) return <VictoryScreen />
  return <GameScreen />
}
