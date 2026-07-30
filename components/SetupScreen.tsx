'use client'

import { useState } from 'react'

import { EMOJI_CHOICES, playerColor } from '@/lib/colors'
import type { Player } from '@/lib/engine'
import { plural } from '@/lib/format'
import { GOAL, OPENING_THRESHOLD } from '@/lib/rules'
import { useStore } from '@/lib/store'

import { Sheet } from './Sheet'

export function SetupScreen() {
  const { roster, createRosterPlayer, deleteRosterPlayer, startGame, cue } = useStore()
  const [selected, setSelected] = useState<string[]>([])
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(false)

  // L'ordre de sélection **est** l'ordre de jeu (SPEC.md §4.1) : on garde donc la
  // liste des identifiants dans l'ordre des taps, pas un simple ensemble.
  const toggle = (id: string) => {
    cue('tap')
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    )
  }

  const players = selected
    .map((id) => roster.find((p) => p.id === id))
    .filter((p): p is Player => Boolean(p))

  return (
    <main className="flex flex-1 flex-col px-5 pt-safe pb-safe">
      <header className="pt-6 pb-7">
        <p className="text-[11px] font-bold tracking-[0.22em] text-cream-faint uppercase">
          Nouvelle partie
        </p>
        <h1 className="font-display text-5xl leading-none text-brass">5000</h1>
        <p className="mt-2 text-sm text-cream-dim">
          Premier à {GOAL.toLocaleString('fr-FR')} pile · ouverture à {OPENING_THRESHOLD}
        </p>
      </header>

      {roster.length > 0 && (
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-[11px] font-bold tracking-[0.16em] text-cream-faint uppercase">
            {editing ? 'Retirer du roster' : 'Qui joue ? Tape dans l’ordre de passage'}
          </h2>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="min-h-8 px-1 text-xs font-semibold text-brass/80"
          >
            {editing ? 'Terminé' : 'Modifier'}
          </button>
        </div>
      )}

      {roster.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-edge px-5 py-9 text-center">
          <p className="text-3xl">🎲</p>
          <p className="mt-3 text-sm text-cream-dim">
            Personne dans le roster. Ajoute les joueurs une fois, ils seront là aux
            prochaines parties.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-2.5">
          {roster.map((player) => {
            const rank = selected.indexOf(player.id)
            const isSelected = rank >= 0
            return (
              <li key={player.id}>
                <button
                  type="button"
                  onClick={() => (editing ? deleteRosterPlayer(player.id) : toggle(player.id))}
                  aria-pressed={isSelected}
                  className={`relative flex min-h-24 w-full flex-col items-center justify-center rounded-2xl border px-2 py-3 transition-colors ${
                    isSelected && !editing
                      ? 'border-brass bg-brass/12'
                      : 'border-edge bg-felt-800'
                  }`}
                >
                  {isSelected && !editing && (
                    <span
                      className="num absolute top-2 right-2 flex size-6 items-center justify-center rounded-full text-xs font-black text-felt-950"
                      style={{ background: playerColor(player.colorIndex) }}
                    >
                      {rank + 1}
                    </span>
                  )}
                  {editing && (
                    <span className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-brick text-sm font-black text-cream">
                      ×
                    </span>
                  )}
                  <span className="text-3xl leading-none">{player.emoji}</span>
                  <span className="mt-2 max-w-full truncate text-sm font-bold">
                    {player.name}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <button
        type="button"
        onClick={() => setAdding(true)}
        className="mt-3 flex min-h-13 items-center justify-center gap-2 rounded-2xl border border-edge bg-felt-800 text-[15px] font-bold text-cream-dim"
      >
        + Nouveau joueur
      </button>

      <div className="mt-auto pt-8">
        <button
          type="button"
          disabled={players.length < 2}
          onClick={() => startGame(players)}
          className="flex min-h-16 w-full items-center justify-center rounded-2xl bg-linear-to-b from-brass-bright to-brass text-lg font-black text-felt-950 shadow-[0_8px_24px_rgba(217,164,65,0.22)] transition-opacity disabled:opacity-30 disabled:shadow-none"
        >
          {players.length < 2
            ? 'Choisis au moins 2 joueurs'
            : `C’est parti · ${players.length} ${plural(players.length, 'joueur')}`}
        </button>
      </div>

      <AddPlayerSheet
        open={adding}
        onClose={() => setAdding(false)}
        onCreate={(name, emoji) => {
          const player = createRosterPlayer(name, emoji)
          setSelected((current) => [...current, player.id])
          setAdding(false)
        }}
        takenEmojis={roster.map((p) => p.emoji)}
      />
    </main>
  )
}

function AddPlayerSheet({
  open,
  onClose,
  onCreate,
  takenEmojis,
}: {
  open: boolean
  onClose: () => void
  onCreate: (name: string, emoji: string) => void
  takenEmojis: string[]
}) {
  const free = EMOJI_CHOICES.filter((e) => !takenEmojis.includes(e))
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState<string>(free[0] ?? EMOJI_CHOICES[0])

  const submit = () => {
    if (!name.trim()) return
    onCreate(name, emoji)
    setName('')
    setEmoji(free[1] ?? EMOJI_CHOICES[0])
  }

  return (
    <Sheet open={open} onClose={onClose} label="Nouveau joueur" height="tall">
      <h2 className="font-display text-2xl">Nouveau joueur</h2>

      <label className="mt-5 block text-[11px] font-bold tracking-[0.16em] text-cream-faint uppercase">
        Prénom
      </label>
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => event.key === 'Enter' && submit()}
        autoComplete="off"
        autoCapitalize="words"
        maxLength={20}
        placeholder="Thomas"
        className="mt-2 min-h-13 w-full rounded-2xl border border-edge bg-felt-700 px-4 text-[17px] font-semibold text-cream placeholder:font-normal placeholder:text-cream-faint focus:border-brass focus:outline-none"
      />

      <p className="mt-6 text-[11px] font-bold tracking-[0.16em] text-cream-faint uppercase">
        Son emoji
      </p>
      <ul className="mt-2 grid grid-cols-6 gap-2">
        {EMOJI_CHOICES.map((candidate) => {
          const taken = takenEmojis.includes(candidate)
          return (
            <li key={candidate}>
              <button
                type="button"
                disabled={taken}
                onClick={() => setEmoji(candidate)}
                aria-pressed={emoji === candidate}
                className={`flex size-full min-h-12 items-center justify-center rounded-xl border text-2xl transition-colors disabled:opacity-20 ${
                  emoji === candidate ? 'border-brass bg-brass/15' : 'border-edge bg-felt-700'
                }`}
              >
                {candidate}
              </button>
            </li>
          )
        })}
      </ul>

      <button
        type="button"
        disabled={!name.trim()}
        onClick={submit}
        className="mt-7 mb-2 flex min-h-14 w-full items-center justify-center rounded-2xl bg-linear-to-b from-brass-bright to-brass text-base font-black text-felt-950 disabled:opacity-30"
      >
        Ajouter {emoji}
      </button>
    </Sheet>
  )
}
