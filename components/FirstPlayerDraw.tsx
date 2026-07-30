'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { playerColor } from '@/lib/colors'
import { useStore } from '@/lib/store'

/** Durée du balayage, puis temps de contemplation avant de passer à la partie. */
const SPIN_MS = 2200
const SETTLE_MS = 1200
/** Tours complets avant de se poser — assez pour que la décélération se voie. */
const TURNS = 3
/** Rayon du cercle de joueurs, en pourcentage du conteneur (donc sans calcul de pixels). */
const RADIUS = 41

/**
 * Tirage au sort du premier joueur.
 *
 * Le vainqueur est **déjà décidé** par le moteur à la création de la partie : cette
 * scène ne fait que le révéler. Rien ici n'influe sur le résultat, donc un
 * rafraîchissement en pleine animation ne change pas qui commence.
 *
 * Le geste vient du sujet : autour d'une table, on désigne en tournant. Les joueurs
 * sont donc disposés en cercle et une aiguille de laiton les balaie, ralentit, se
 * pose. L'angle est calculé image par image en JavaScript plutôt que confié à une
 * transition CSS : c'est ce qui permet de savoir en permanence quel joueur est sous
 * l'aiguille, et donc d'allumer les disques exactement en rythme. Une seule
 * transformation est écrite sur un seul nœud à chaque image, jamais un rendu React.
 */
export function FirstPlayerDraw() {
  const { game, finishDrawing, cue } = useStore()
  const players = game?.players ?? []
  const count = players.length
  const winnerIndex = Math.max(0, players.findIndex((p) => p.id === game?.firstPlayerId))

  const needleRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(winnerIndex)
  const [settled, setSettled] = useState(false)
  /** Passé à vrai par un tap : la boucle d'animation doit alors sauter à la fin. */
  const stopped = useRef(false)

  // `cue` change avec les réglages ; on le lit par référence pour que la scène ne
  // soit jamais relancée en cours de route.
  const cueRef = useRef(cue)
  useEffect(() => {
    cueRef.current = cue
  }, [cue])

  const land = useCallback(() => {
    stopped.current = true
    setActiveIndex(winnerIndex)
    setSettled(true)
  }, [winnerIndex])

  useEffect(() => {
    if (count === 0) return

    const finalAngle = TURNS * 360 + (winnerIndex * 360) / count
    const point = (angle: number) => {
      if (needleRef.current) {
        needleRef.current.style.transform = `translateX(-50%) rotate(${angle}deg)`
      }
    }

    // Mouvement réduit : la scène se joue en une image plutôt que d'être court-circuitée
    // par une branche séparée, ce qui évite un `setState` synchrone dans l'effet.
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const duration = reduced ? 1 : SPIN_MS

    let frame = 0
    let lastIndex = -1
    let cancelled = false
    const start = performance.now()

    const tick = (now: number) => {
      if (cancelled) return
      // Tirage interrompu au doigt : on se pose net sur le vainqueur.
      if (stopped.current) {
        point(finalAngle)
        return
      }
      const t = Math.min(1, (now - start) / duration)
      // Décélération franche : l'aiguille part vite et s'installe longuement.
      const eased = 1 - Math.pow(1 - t, 4)
      const angle = finalAngle * eased
      point(angle)

      const index = Math.round(((angle % 360) / 360) * count) % count
      if (index !== lastIndex) {
        lastIndex = index
        setActiveIndex(index)
        // Le cliquetis n'apparaît que dans la dernière portion : au début les
        // joueurs défilent trop vite pour que ce soit autre chose qu'un bourdon.
        if (!reduced && t > 0.55) cueRef.current('tap')
      }

      if (t < 1) {
        frame = requestAnimationFrame(tick)
      } else {
        point(finalAngle)
        land()
        cueRef.current('validate')
      }
    }

    frame = requestAnimationFrame(tick)
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
    }
  }, [count, winnerIndex, land])

  // Passage automatique une fois le vainqueur révélé.
  useEffect(() => {
    if (!settled) return
    const timer = setTimeout(finishDrawing, SETTLE_MS)
    return () => clearTimeout(timer)
  }, [settled, finishDrawing])

  if (count === 0) return null

  const winner = players[winnerIndex]
  const discClass = count > 8 ? 'w-[15%]' : 'w-[18.5%]'

  return (
    <main
      className="flex flex-1 flex-col items-center justify-center overflow-hidden px-6"
      // À la troisième revanche, la cérémonie devient une attente : un tap la coupe.
      onClick={settled ? finishDrawing : land}
    >
      <p className="text-[11px] font-bold tracking-[0.22em] text-cream-faint uppercase">
        {settled ? 'commence la partie' : 'qui commence ?'}
      </p>

      <div className="relative mt-8 aspect-square w-[min(78vw,320px)]">
        {/* Le plateau : un disque de feutre plus clair, cerclé de laiton. */}
        <div className="absolute inset-[9%] rounded-full border border-edge bg-felt-800/70" />

        {/* L'aiguille. Sa transformation est écrite directement dans le DOM. */}
        <div
          ref={needleRef}
          // La hauteur vient d'une constante JavaScript : elle passe par `style` et
          // non par une classe, qu'un `h-[${…}]` interpolé empêcherait Tailwind de
          // générer — un échec silencieux qui ne se verrait qu'à l'écran.
          style={{
            height: `${RADIUS}%`,
            transform: 'translateX(-50%) rotate(0deg)',
            willChange: 'transform',
          }}
          className={`absolute bottom-1/2 left-1/2 w-[3px] origin-bottom rounded-full bg-linear-to-t from-brass/0 via-brass/60 to-brass-bright transition-opacity duration-500 ${
            settled ? 'opacity-35' : 'opacity-100'
          }`}
        >
          <span className="absolute -top-1 left-1/2 size-2.5 -translate-x-1/2 rounded-full bg-brass-bright" />
        </div>

        {/* Le moyeu. */}
        <span className="absolute top-1/2 left-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-brass/60 bg-felt-900" />

        {players.map((player, index) => {
          const radians = ((index * 360) / count - 90) * (Math.PI / 180)
          const color = playerColor(player.colorIndex)
          const isActive = index === activeIndex
          const isWinner = settled && index === winnerIndex

          return (
            <div
              key={player.id}
              className={`absolute ${discClass} aspect-square`}
              style={{
                left: `${50 + RADIUS * Math.cos(radians)}%`,
                top: `${50 + RADIUS * Math.sin(radians)}%`,
                transform: `translate(-50%, -50%) scale(${isWinner ? 1.32 : isActive ? 1.1 : 1})`,
                opacity: settled && !isWinner ? 0.26 : 1,
                transition: 'transform 420ms cubic-bezier(0.16,1,0.3,1), opacity 420ms ease-out',
              }}
            >
              {isWinner && (
                <span
                  aria-hidden="true"
                  className="animate-halo absolute inset-0 rounded-full"
                  style={{ boxShadow: `0 0 0 3px ${color}` }}
                />
              )}
              <div
                className="flex size-full items-center justify-center rounded-full border-2 transition-colors duration-300"
                style={{
                  borderColor: isActive ? color : 'var(--color-edge)',
                  background: isActive ? `${color}22` : 'var(--color-felt-800)',
                  boxShadow: isWinner ? `0 0 26px ${color}66` : undefined,
                }}
              >
                <span className="text-[min(6.5vw,1.7rem)] leading-none">{player.emoji}</span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-9 flex h-24 flex-col items-center">
        {settled ? (
          <>
            <p
              className="animate-rise font-display text-[2.75rem] leading-none tracking-[-0.02em]"
              style={{ color: playerColor(winner.colorIndex) }}
            >
              {winner.name}
            </p>
            <button
              type="button"
              onClick={finishDrawing}
              className="mt-4 min-h-11 px-6 text-[13px] font-bold text-cream-faint"
            >
              Continuer
            </button>
          </>
        ) : (
          <p className="text-[13px] text-cream-faint">tape pour arrêter le tirage</p>
        )}
      </div>
    </main>
  )
}
