'use client'

import { playerColor } from '@/lib/colors'
import type { PlayerState } from '@/lib/engine'
import { fmt } from '@/lib/format'
import { GOAL, OPENING_THRESHOLD } from '@/lib/rules'

/**
 * Le classement — la vue par défaut de la partie (option D du cadrage).
 *
 * Joueurs triés par score, joueur courant encadré quelle que soit sa position :
 * on lit « qui gagne » et « à qui le tour » d'un seul coup d'œil.
 */
export function Scoreboard({
  standings,
  currentPlayerId,
  onPick,
}: {
  standings: PlayerState[]
  currentPlayerId: string | null
  onPick: (state: PlayerState) => void
}) {
  return (
    <ul className="flex flex-col gap-2.5">
      {standings.map((state) => {
        const { player, total, opened } = state
        const isCurrent = player.id === currentPlayerId
        const color = playerColor(player.colorIndex)

        return (
          <li key={player.id}>
            <button
              type="button"
              onClick={() => onPick(state)}
              className={`flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-colors ${
                isCurrent ? 'border-brass bg-brass/10' : 'border-transparent bg-felt-800'
              }`}
            >
              <span className="w-9 shrink-0 text-center text-2xl leading-none">
                {player.emoji}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="truncate text-[17px] font-bold">{player.name}</span>
                  {isCurrent && (
                    <span className="shrink-0 text-[10px] font-black tracking-[0.14em] text-brass uppercase">
                      à toi
                    </span>
                  )}
                </span>

                <span className="mt-0.5 block text-[11.5px] text-cream-faint">
                  {!opened
                    ? `compteur non ouvert · ${OPENING_THRESHOLD} requis`
                    : `reste ${fmt(GOAL - total)}`}
                </span>

                <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-felt-950/70">
                  <span
                    className="block h-full rounded-full transition-[width] duration-500 ease-out"
                    style={{
                      width: `${Math.min(100, (total / GOAL) * 100)}%`,
                      background: color,
                    }}
                  />
                </span>
              </span>

              <span className="num shrink-0 text-[22px] font-black tracking-tight">
                {fmt(total)}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
