'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Feuille remontante : le conteneur de tous les écrans secondaires (saisie, carnet,
 * menus). Fermeture au glissement vers le bas, au tap sur le fond, ou par Échap.
 *
 * L'entrée est animée en CSS pur (une animation surclasse le `style` inline, donc
 * elle cohabite avec le décalage du glissement). La sortie est animée uniquement pour
 * les fermetures **déclenchées par l'utilisateur** : `requestClose` joue l'animation
 * puis prévient le parent. Une fermeture programmée par le parent — après validation
 * d'un score, par exemple — est instantanée, ce qui est de toute façon la sensation
 * qu'on veut à ce moment-là.
 */
const EXIT_MS = 180

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
  const [drag, setDrag] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [closing, setClosing] = useState(false)
  const startY = useRef<number | null>(null)
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const requestClose = useCallback(() => {
    if (exitTimer.current) return
    setClosing(true)
    exitTimer.current = setTimeout(onClose, EXIT_MS)
  }, [onClose])

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
    // Verrouille le défilement du fond pendant que la feuille est ouverte.
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previous
    }
  }, [open, requestClose])

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
        className={`animate-sheet-in relative flex w-full max-w-md flex-col rounded-t-3xl border-t border-edge bg-felt-800 shadow-[0_-18px_50px_rgba(0,0,0,0.5)] ${
          height === 'tall' ? 'max-h-[92dvh]' : 'max-h-[88dvh]'
        }`}
        style={{
          transform: closing ? 'translateY(100%)' : `translateY(${drag}px)`,
          transition: dragging ? 'none' : `transform ${EXIT_MS}ms cubic-bezier(0.32,0.72,0,1)`,
        }}
      >
        <div
          className="flex shrink-0 cursor-grab touch-none justify-center py-3 active:cursor-grabbing"
          onPointerDown={(event) => {
            startY.current = event.clientY
            setDragging(true)
            event.currentTarget.setPointerCapture(event.pointerId)
          }}
          onPointerMove={(event) => {
            if (startY.current === null) return
            setDrag(Math.max(0, event.clientY - startY.current))
          }}
          onPointerUp={() => {
            startY.current = null
            setDragging(false)
            if (drag > 90) requestClose()
            else setDrag(0)
          }}
          onPointerCancel={() => {
            startY.current = null
            setDragging(false)
            setDrag(0)
          }}
        >
          <span className="h-1.5 w-11 rounded-full bg-cream-faint/60" />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-safe">
          {children}
        </div>
      </div>
    </div>
  )
}
