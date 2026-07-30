'use client'

import { playerColor } from '@/lib/colors'
import type { Player } from '@/lib/engine'
import { GOAL } from '@/lib/rules'

const WIDTH = 320
const HEIGHT = 186
const PAD = { left: 36, right: 10, top: 12, bottom: 20 }

/**
 * Courbe de progression, en SVG écrit à la main — une bibliothèque de graphiques
 * pour quatre polylignes serait plus lourde que toute l'application.
 *
 * Les rebonds au-dessus de 5000 se lisent comme des décrochements vers le bas :
 * c'est le moment le plus drôle d'une partie, autant le rendre visible.
 */
export function ProgressChart({
  series,
}: {
  series: { player: Player; totals: number[] }[]
}) {
  const turns = Math.max(2, ...series.map((s) => s.totals.length))
  const x = (index: number) =>
    PAD.left + (index / (turns - 1)) * (WIDTH - PAD.left - PAD.right)
  const y = (total: number) =>
    HEIGHT - PAD.bottom - (Math.max(0, total) / GOAL) * (HEIGHT - PAD.top - PAD.bottom)

  const gridlines = [0, 0.25, 0.5, 0.75, 1]

  return (
    <figure>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        role="img"
        aria-label="Courbe de progression des joueurs"
      >
        {gridlines.map((ratio) => (
          <g key={ratio}>
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={y(GOAL * ratio)}
              y2={y(GOAL * ratio)}
              stroke="currentColor"
              className="text-edge"
              strokeWidth="1"
            />
            <text
              x={PAD.left - 6}
              y={y(GOAL * ratio) + 3.5}
              textAnchor="end"
              className="fill-cream-faint text-[9px]"
            >
              {GOAL * ratio}
            </text>
          </g>
        ))}

        {series.map(({ player, totals }) => {
          const color = playerColor(player.colorIndex)
          const points = totals.map((total, index) => `${x(index)},${y(total)}`).join(' ')
          const last = totals.length - 1
          return (
            <g key={player.id}>
              <polyline
                points={points}
                fill="none"
                stroke={color}
                strokeWidth="2.4"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <circle cx={x(last)} cy={y(totals[last])} r="3.4" fill={color} />
            </g>
          )
        })}
      </svg>

      <figcaption className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-cream-dim">
        {series.map(({ player }) => (
          <span key={player.id} className="flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-sm"
              style={{ background: playerColor(player.colorIndex) }}
            />
            {player.emoji} {player.name}
          </span>
        ))}
      </figcaption>
    </figure>
  )
}
