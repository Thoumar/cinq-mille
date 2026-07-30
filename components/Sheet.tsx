'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const EXIT_MS = 200
/** Distance au-delà de laquelle on lâche la feuille. */
const DISMISS_PX = 96
/** Vitesse (px/ms) qui congédie la feuille même sur une courte distance. */
const DISMISS_VELOCITY = 0.45

/**
 * Feuille remontante : le conteneur de tous les écrans secondaires (saisie, carnet,
 * progression, réglages).
 *
 * Le geste tactile est écouté sur **toute la feuille**, pas seulement sur la poignée :
 * au doigt, on tire la feuille, pas un trait de 44 px. La règle d'arbitrage est celle
 * qu'on attend d'une feuille native :
 *
 * - le contenu est défilé vers le bas → le geste appartient au défilement ;
 * - le contenu est en haut et on tire vers le bas → la feuille suit le doigt ;
 * - on tire vers le haut → toujours le défilement.
 *
 * L'écouteur `touchmove` est **non passif** : c'est la seule façon d'appeler
 * `preventDefault` et donc de reprendre au navigateur un geste qu'il aurait interprété
 * comme un défilement de page. La position est écrite directement dans le DOM pendant
 * le glissement — un rendu React par image serait du gâchis et introduirait du retard
 * entre le doigt et la feuille.
 */
export function Sheet({
  open,
  onClose,
  label,
  children,
  height = 'auto',
}: {
  open: boolean
  onClose: () => void
  label: string
  children: React.ReactNode
  /** `auto` s'adapte au contenu, `tall` occupe presque tout l'écran. */
  height?: 'auto' | 'tall'
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [closing, setClosing] = useState(false)

  const moveTo = useCallback((position: number | 'out' | 'home', animate: boolean) => {
    const panel = panelRef.current
    if (!panel) return
    panel.style.transition = animate
      ? `transform ${EXIT_MS}ms cubic-bezier(0.32, 0.72, 0, 1)`
      : 'none'
    panel.style.transform =
      position === 'out'
        ? 'translateY(100%)'
        : position === 'home'
          ? 'translateY(0px)'
          : `translateY(${position}px)`
  }, [])

  const requestClose = useCallback(() => {
    if (exitTimer.current) return
    setClosing(true)
    moveTo('out', true)
    exitTimer.current = setTimeout(onClose, EXIT_MS)
  }, [moveTo, onClose])

  useEffect(
    () => () => {
      if (exitTimer.current) clearTimeout(exitTimer.current)
    },
    [],
  )

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') requestClose()
    }
    document.addEventListener('keydown', onKeyDown)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previous
    }
  }, [open, requestClose])

  // Glissement au doigt.
  useEffect(() => {
    const panel = panelRef.current
    const scroller = scrollRef.current
    if (!open || !panel || !scroller) return

    let startY = 0
    let lastY = 0
    let lastTime = 0
    let velocity = 0
    let offset = 0
    let mode: 'idle' | 'deciding' | 'dragging' = 'idle'

    const onStart = (event: TouchEvent) => {
      if (event.touches.length !== 1 || exitTimer.current) return
      startY = lastY = event.touches[0].clientY
      lastTime = event.timeStamp
      velocity = 0
      offset = 0
      mode = 'deciding'
    }

    const onMove = (event: TouchEvent) => {
      if (mode === 'idle' || event.touches.length !== 1) return
      const y = event.touches[0].clientY

      if (mode === 'deciding') {
        const delta = y - startY
        // On laisse 5 px d'ambiguïté avant de trancher entre défiler et tirer.
        if (Math.abs(delta) < 5) return
        if (delta > 0 && scroller.scrollTop <= 0) {
          mode = 'dragging'
          // On repart du point de bascule, sinon la feuille saute de 5 px.
          startY = y
        } else {
          mode = 'idle'
        }
        return
      }

      const elapsed = event.timeStamp - lastTime || 16
      velocity = (y - lastY) / elapsed
      lastY = y
      lastTime = event.timeStamp
      offset = Math.max(0, y - startY)

      event.preventDefault()
      moveTo(offset, false)
    }

    const onEnd = () => {
      if (mode !== 'dragging') {
        mode = 'idle'
        return
      }
      mode = 'idle'
      if (offset > DISMISS_PX || velocity > DISMISS_VELOCITY) requestClose()
      else moveTo('home', true)
    }

    panel.addEventListener('touchstart', onStart, { passive: true })
    // Non passif : indispensable pour pouvoir appeler `preventDefault`.
    panel.addEventListener('touchmove', onMove, { passive: false })
    panel.addEventListener('touchend', onEnd, { passive: true })
    panel.addEventListener('touchcancel', onEnd, { passive: true })

    return () => {
      panel.removeEventListener('touchstart', onStart)
      panel.removeEventListener('touchmove', onMove)
      panel.removeEventListener('touchend', onEnd)
      panel.removeEventListener('touchcancel', onEnd)
    }
  }, [open, moveTo, requestClose])

  // Glissement à la souris, sur la poignée uniquement : au clavier et au pointeur,
  // la croix du fond et Échap font déjà le travail.
  const mouseStart = useRef<number | null>(null)
  const mouseOffset = useRef(0)

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <button
        type="button"
        aria-label="Fermer"
        onClick={requestClose}
        className="animate-backdrop-in absolute inset-0 bg-felt-950/70 transition-opacity duration-150"
        style={{ opacity: closing ? 0 : 1 }}
      />

      <div
        ref={panelRef}
        className={`animate-sheet-in relative flex w-full max-w-md touch-pan-y flex-col rounded-t-3xl border-t border-edge bg-felt-800 shadow-[0_-18px_50px_rgba(0,0,0,0.5)] ${
          height === 'tall' ? 'max-h-[92dvh]' : 'max-h-[88dvh]'
        }`}
      >
        <div
          className="flex shrink-0 cursor-grab justify-center py-3 active:cursor-grabbing"
          onPointerDown={(event) => {
            if (event.pointerType === 'touch') return
            mouseStart.current = event.clientY
            mouseOffset.current = 0
            event.currentTarget.setPointerCapture(event.pointerId)
          }}
          onPointerMove={(event) => {
            if (mouseStart.current === null) return
            mouseOffset.current = Math.max(0, event.clientY - mouseStart.current)
            moveTo(mouseOffset.current, false)
          }}
          onPointerUp={() => {
            if (mouseStart.current === null) return
            mouseStart.current = null
            if (mouseOffset.current > DISMISS_PX) requestClose()
            else moveTo('home', true)
          }}
        >
          <span className="h-1.5 w-11 rounded-full bg-cream-faint/60" />
        </div>

        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-safe"
        >
          {children}
        </div>
      </div>
    </div>
  )
}
