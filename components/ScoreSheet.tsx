'use client'

import type { GameView, TurnRecord } from '@/lib/engine'
import { fmt } from '@/lib/format'

/**
 * Le carnet : une colonne par joueur, une ligne par tour.
 *
 * C'est la seule surface « papier » de l'application. Le contraste avec le feutre
 * porte l'identité visuelle, et rend au passage l'historique nettement plus lisible
 * qu'un tableau sombre de plus.
 */
export function ScoreSheet({ view }: { view: GameView }) {
  const { states, rows } = view

  return (
    <div className="paper overflow-hidden rounded-2xl">
      <div className="overflow-x-auto">
        <table className="num w-full min-w-max border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 z-1 bg-paper px-3 py-3 text-left text-[10px] font-bold tracking-[0.12em] text-ink-soft uppercase">
                Tour
              </th>
              {states.map((state) => (
                <th
                  key={state.player.id}
                  className={`px-3 py-2 text-right ${state.removed ? 'opacity-35' : ''}`}
                >
                  <span className="block text-xl leading-none">{state.player.emoji}</span>
                  <span className="mt-1 block max-w-16 truncate text-[10px] font-semibold text-ink-soft">
                    {state.removed ? 'parti' : state.player.name}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={states.length + 1}
                  className="px-3 py-8 text-center text-[13px] text-ink-soft"
                >
                  Aucun tour joué pour l’instant.
                </td>
              </tr>
            )}
            {rows.map((row, index) => (
              <tr key={index} className="border-t border-paper-line">
                <td className="sticky left-0 z-1 bg-paper px-3 py-2.5 text-left text-[12px] font-bold text-ink-soft">
                  {index + 1}
                </td>
                {row.map((cell, column) => (
                  <td key={states[column].player.id} className="px-3 py-2.5 text-right text-[15px]">
                    <Cell record={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>

          <tfoot>
            <tr className="border-t-2 border-ink/25">
              <td className="sticky left-0 z-1 bg-paper px-3 py-3 text-left text-[10px] font-bold tracking-[0.12em] text-ink-soft uppercase">
                Total
              </td>
              {states.map((state) => (
                <td
                  key={state.player.id}
                  className={`px-3 py-3 text-right text-[18px] font-black ${
                    state.removed ? 'opacity-35' : ''
                  }`}
                >
                  {fmt(state.total)}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

function Cell({ record }: { record: TurnRecord | null }) {
  if (!record) return <span className="text-ink-soft/40">·</span>

  switch (record.kind) {
    // Tour non nul mais sous le seuil d'ouverture : on garde la trace de la
    // tentative, barrée, plutôt que d'afficher un zéro qui ne dit rien.
    case 'no-open':
      return (
        <span className="text-ink-soft line-through decoration-brick/70">{fmt(record.raw)}</span>
      )
    case 'miss':
      return <span className="text-ink-soft">—</span>
    case 'bounce':
      return (
        <span className="text-brick">
          {fmt(record.raw)} <span className="text-[11px]">↰</span>
        </span>
      )
    case 'win':
      return <span className="font-black">{fmt(record.raw)} 🏆</span>
    default:
      return <span>{fmt(record.raw)}</span>
  }
}
