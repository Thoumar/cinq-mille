'use client'

import { useState } from 'react'

import { EMOJI_CHOICES, playerColor } from '@/lib/colors'
import type { Player } from '@/lib/engine'
import { fmt, plural } from '@/lib/format'
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
  const canStart = players.length >= 2

  return (
    <main className="flex flex-1 flex-col px-5 pt-safe pb-safe">
      {/* Le bloc défile quand la tablée est nombreuse, et se centre verticalement
          quand elle ne l'est pas — `min-h-full` + `justify-center` plutôt que
          `justify-center` seul, qui rognerait le haut du contenu en cas de
          débordement. */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex min-h-full flex-col justify-center gap-9 py-8">
          <header className="text-center">
            <h1 className="font-display text-[5.25rem] leading-[0.85] tracking-[-0.03em] text-brass">
              5000
            </h1>
            <p className="mx-auto mt-4 max-w-62 text-[13.5px] leading-relaxed text-cream-dim">
              Le premier à {fmt(GOAL)} pile gagne. Il faut un tour à{' '}
              {OPENING_THRESHOLD} pour ouvrir son compteur.
            </p>
          </header>

          <section>
            <h2 className="mb-3 text-center text-[11px] font-bold tracking-[0.16em] text-cream-faint uppercase">
              {roster.length === 0
                ? 'Le roster est vide'
                : editing
                  ? 'Tape un joueur pour le retirer'
                  : 'Qui joue ? Tape dans l’ordre de passage'}
            </h2>

            {roster.length === 0 ? (
              <p className="mx-auto max-w-70 rounded-2xl border border-dashed border-edge px-6 py-7 text-center text-[13.5px] leading-relaxed text-cream-dim">
                Ajoute les joueurs une fois : ils seront là aux prochaines parties.
              </p>
            ) : (
              <ul className="grid grid-cols-2 gap-2.5">
                {roster.map((player) => {
                  const rank = selected.indexOf(player.id)
                  const isSelected = rank >= 0 && !editing
                  return (
                    <li key={player.id}>
                      <button
                        type="button"
                        onClick={() =>
                          editing ? deleteRosterPlayer(player.id) : toggle(player.id)
                        }
                        aria-pressed={editing ? undefined : rank >= 0}
                        aria-label={
                          editing ? `Retirer ${player.name} du roster` : player.name
                        }
                        className={`relative flex min-h-25 w-full flex-col items-center justify-center rounded-2xl border px-2 py-3 transition-colors duration-200 ${
                          isSelected
                            ? 'border-brass bg-brass/12'
                            : editing
                              ? 'border-brick/40 bg-brick/8'
                              : 'border-edge bg-felt-800'
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`absolute top-2 right-2 flex size-6 items-center justify-center rounded-full text-xs font-black transition-opacity duration-200 ${
                            isSelected || editing ? 'opacity-100' : 'opacity-0'
                          } ${editing ? 'bg-brick text-felt-950' : 'text-felt-950'}`}
                          style={
                            isSelected
                              ? { background: playerColor(player.colorIndex) }
                              : undefined
                          }
                        >
                          {editing ? '×' : rank + 1}
                        </span>
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
              className="mt-2.5 flex min-h-13 w-full items-center justify-center rounded-2xl border border-edge bg-felt-800 text-[15px] font-bold text-cream-dim"
            >
              + Nouveau joueur
            </button>

            {roster.length > 0 && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setEditing((v) => !v)}
                  className="mt-1 min-h-11 px-4 text-[13px] font-bold text-cream-faint"
                >
                  {editing ? 'Terminé' : 'Modifier le roster'}
                </button>
              </div>
            )}
          </section>
        </div>
      </div>

      <div className="pt-3">
        <button
          type="button"
          disabled={!canStart}
          onClick={() => startGame(players)}
          className={`flex min-h-16 w-full items-center justify-center rounded-2xl bg-linear-to-b from-brass-bright to-brass text-lg font-black text-felt-950 transition-all duration-300 ease-out ${
            canStart
              ? 'scale-100 opacity-100 shadow-[0_10px_30px_rgba(217,164,65,0.26)]'
              : 'scale-[0.985] opacity-35 shadow-none'
          }`}
        >
          {canStart
            ? `C’est parti · ${players.length} ${plural(players.length, 'joueur')}`
            : 'Choisis au moins 2 joueurs'}
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

      <label
        htmlFor="new-player-name"
        className="mt-5 block text-[11px] font-bold tracking-[0.16em] text-cream-faint uppercase"
      >
        Prénom
      </label>
      <input
        id="new-player-name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => event.key === 'Enter' && submit()}
        autoComplete="off"
        autoCapitalize="words"
        maxLength={20}
        placeholder="Thomas"
        className="mt-2 min-h-13 w-full rounded-2xl border border-edge bg-felt-700 px-4 text-[17px] font-semibold text-cream placeholder:font-normal placeholder:text-cream-dim focus:border-brass focus:outline-none"
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
                aria-label={taken ? `${candidate}, déjà pris` : candidate}
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
        className="mt-7 mb-2 flex min-h-14 w-full items-center justify-center rounded-2xl bg-linear-to-b from-brass-bright to-brass text-base font-black text-felt-950 transition-opacity disabled:opacity-30"
      >
        Ajouter {emoji}
      </button>
    </Sheet>
  )
}
