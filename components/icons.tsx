/**
 * Les deux seules icônes de l'application, dessinées à la main.
 *
 * Une bibliothèque d'icônes pour deux glyphes pèserait plus lourd que le reste de
 * l'interface. `currentColor` partout pour qu'elles suivent la couleur du bouton.
 */

/** Position des points, en fraction de la face. */
const PIPS: Record<number, readonly (readonly [number, number])[]> = {
  1: [[0.5, 0.5]],
  2: [
    [0.29, 0.29],
    [0.71, 0.71],
  ],
  3: [
    [0.27, 0.27],
    [0.5, 0.5],
    [0.73, 0.73],
  ],
  4: [
    [0.31, 0.31],
    [0.69, 0.31],
    [0.31, 0.69],
    [0.69, 0.69],
  ],
  5: [
    [0.29, 0.29],
    [0.71, 0.29],
    [0.5, 0.5],
    [0.29, 0.71],
    [0.71, 0.71],
  ],
  6: [
    [0.31, 0.27],
    [0.69, 0.27],
    [0.31, 0.5],
    [0.69, 0.5],
    [0.31, 0.73],
    [0.69, 0.73],
  ],
}

/**
 * Un dé, en géométrie pure : rectangle arrondi et disques, dans la matière du
 * carnet (papier et encre). L'application ne simule aucun dé — celui-ci est
 * l'objet du jeu, pas une commande.
 */
export function Die({ face, className }: { face: 1 | 2 | 3 | 4 | 5 | 6; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="1.2" y="1.2" width="21.6" height="21.6" rx="5.4" fill="var(--color-paper)" />
      <rect
        x="1.2"
        y="1.2"
        width="21.6"
        height="21.6"
        rx="5.4"
        fill="none"
        stroke="var(--color-ink)"
        strokeOpacity="0.18"
        strokeWidth="0.9"
      />
      {PIPS[face].map(([x, y], i) => (
        <circle key={i} cx={x * 24} cy={y * 24} r="2.15" fill="var(--color-ink)" />
      ))}
    </svg>
  )
}

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

export function ChartIcon({ className }: { className?: string }) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M3.5 20.5h17" strokeWidth={1.4} opacity={0.45} />
      <path d="M4 16.5 9.5 10.5 13.5 14 20 6.5" />
      <circle cx="20" cy="6.5" r="1.7" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function GearIcon({ className }: { className?: string }) {
  // Corps, moyeu, et huit dents réparties tous les 45°.
  const teeth = Array.from({ length: 8 }, (_, i) => {
    const angle = (i * Math.PI) / 4
    const [cos, sin] = [Math.cos(angle), Math.sin(angle)]
    return {
      x1: 12 + 5.4 * cos,
      y1: 12 + 5.4 * sin,
      x2: 12 + 7.9 * cos,
      y2: 12 + 7.9 * sin,
    }
  })

  return (
    <svg {...base} className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="4.9" />
      <circle cx="12" cy="12" r="1.9" />
      {teeth.map((t, i) => (
        <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} />
      ))}
    </svg>
  )
}
