'use client'

import { useState } from 'react'

import type { Player } from '@/lib/engine'
import { resolveTurn } from '@/lib/engine'
import { fmt } from '@/lib/format'
import { GOAL, MAX_SCORE_INPUT, OPENING_THRESHOLD, rejectionMessage, validateScore } from '@/lib/rules'

const SHORTCUTS = [50, 100, 500, 1000] as const
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0'] as const

/**
 * Saisie du score du tour.
 *
 * L'information la plus utile de cet écran n'est pas le montant tapé mais **l'aperçu
 * du résultat** : le joueur voit l'effet du rebond ou la victoire avant de valider,
 * ce qui évite la discussion « attends, ça me fait combien ? » à chaque fin de tour.
 */
export function NumPad({
  player,
  total,
  opened,
  onSubmit,
  onTap,
}: {
  player: Player
  total: number
  opened: boolean
  onSubmit: (raw: number) => void
  onTap: () => void
}) {
  const [buffer, setBuffer] = useState('')

  const value = Number(buffer || '0')
  const rejection = buffer === '' ? null : validateScore(value)
  const outcome = resolveTurn(total, opened, value)
  const canSubmit = buffer !== '' && rejection === null

  const press = (key: string) => {
    onTap()
    setBuffer((current) => {
      const next = (current + key).replace(/^0+(?=\d)/, '')
      return Number(next) > MAX_SCORE_INPUT ? current : next
    })
  }

  const addShortcut = (amount: number) => {
    onTap()
    setBuffer((current) => {
      const next = Number(current || '0') + amount
      return next > MAX_SCORE_INPUT ? current : String(next)
    })
  }

  return (
    <div className="flex flex-col pb-2">
      <div className="flex items-center gap-3">
        <span className="text-3xl leading-none">{player.emoji}</span>
        <div>
          <p className="text-[10.5px] font-bold tracking-[0.18em] text-cream-faint uppercase">
            Score du tour
          </p>
          <p className="num text-[17px] font-bold">
            {player.name} · {fmt(total)} pts
          </p>
        </div>
      </div>

      <p className="num pt-5 pb-1 text-center text-[62px] leading-none font-black tracking-tighter">
        {buffer === '' ? <span className="text-cream-faint/40">0</span> : fmt(value)}
      </p>

      <Preview
        empty={buffer === ''}
        rejection={rejection}
        total={total}
        value={value}
        outcome={outcome}
      />

      <div className="mt-4 grid grid-cols-4 gap-2">
        {SHORTCUTS.map((amount) => (
          <button
            key={amount}
            type="button"
            onClick={() => addShortcut(amount)}
            className="num flex min-h-11 items-center justify-center rounded-xl border border-edge bg-felt-700/70 text-sm font-bold text-cream-dim"
          >
            +{amount}
          </button>
        ))}
      </div>

      <div className="mt-2.5 grid grid-cols-3 gap-2.5">
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => press(key)}
            className={`num flex min-h-15 items-center justify-center rounded-2xl border border-edge bg-felt-700 font-bold ${
              key === '00' ? 'text-xl text-cream-dim' : 'text-[26px]'
            }`}
          >
            {key}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            onTap()
            setBuffer((current) => current.slice(0, -1))
          }}
          aria-label="Effacer un chiffre"
          className="flex min-h-15 items-center justify-center rounded-2xl border border-edge bg-felt-700 text-xl text-cream-dim"
        >
          ⌫
        </button>
      </div>

      <div className="mt-3 flex gap-2.5">
        <button
          type="button"
          onClick={() => onSubmit(0)}
          className="flex min-h-15 flex-1 items-center justify-center rounded-2xl border border-brick/40 bg-brick/10 text-[15px] font-bold text-brick"
        >
          ✖ Raté
        </button>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => onSubmit(value)}
          className="flex min-h-15 flex-[1.6] items-center justify-center rounded-2xl bg-linear-to-b from-brass-bright to-brass text-base font-black text-felt-950 disabled:opacity-25"
        >
          Valider
        </button>
      </div>
    </div>
  )
}

function Preview({
  empty,
  rejection,
  total,
  value,
  outcome,
}: {
  empty: boolean
  rejection: ReturnType<typeof validateScore>
  total: number
  value: number
  outcome: ReturnType<typeof resolveTurn>
}) {
  if (empty) {
    return (
      <p className="text-center text-[13px] text-cream-faint">
        multiple de 50 · ou « Raté » pour un tour à zéro
      </p>
    )
  }

  if (rejection) {
    return (
      <p className="text-center text-[13px] font-bold text-brick">
        ✖ {rejectionMessage(rejection)}
      </p>
    )
  }

  const detail = () => {
    switch (outcome.kind) {
      case 'win':
        return (
          <>
            nouveau total <b className="text-brass">{fmt(GOAL)}</b>
            <span className="text-brass"> 🏆 victoire</span>
          </>
        )
      case 'bounce':
        return (
          <>
            nouveau total <b className="text-brass">{fmt(outcome.total)}</b>
            <span className="text-brass">
              {' '}
              ↰ rebond, surplus {fmt(total + value - GOAL)}
            </span>
          </>
        )
      case 'no-open':
        return (
          <span className="text-brick">
            sous les {OPENING_THRESHOLD} : le compteur reste à {fmt(total)}
          </span>
        )
      case 'miss':
        return <>tour à zéro · le total reste à <b>{fmt(total)}</b></>
      default:
        return (
          <>
            nouveau total <b>{fmt(outcome.total)}</b>
          </>
        )
    }
  }

  return <p className="num text-center text-[13px] text-cream-dim">{detail()}</p>
}
