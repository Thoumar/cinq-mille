'use client'

import { useState } from 'react'

import { EMOJI_CHOICES, playerColor } from '@/lib/colors'
import type { Player } from '@/lib/engine'
import { plural } from '@/lib/format'
import { useStore } from '@/lib/store'

import { Die } from './icons'
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

  // Au-delà de six habitués, trois colonnes gardent la grille dans l'écran plutôt
  // que de la faire défiler.
  const dense = roster.length > 6

  return (
    /* Trois bandes : identité et lancement sont fixes, seul le roster est élastique.
       La page ne peut donc pas dépasser une hauteur d'écran, et le défilement
       n'apparaît que si la tablée est réellement trop longue pour tenir. */
    <main className="flex flex-1 flex-col overflow-hidden px-5 pt-safe pb-safe">
      <header className="shrink-0 pt-5 pb-6 text-center">
        <div className="flex items-end justify-center gap-1.5">
          {/* Un 1 et un 5 : les deux seules faces qui marquent isolément au 5000. */}
          <Die face={1} className="size-11 -rotate-12 drop-shadow-[0_7px_12px_rgba(0,0,0,0.5)]" />
          <Die
            face={5}
            className="size-11 translate-y-1 rotate-6 drop-shadow-[0_7px_12px_rgba(0,0,0,0.5)]"
          />
        </div>
        <h1 className="font-display mt-5 text-[4.75rem] leading-[0.82] tracking-[-0.03em] text-brass">
          5000
        </h1>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex min-h-full flex-col justify-center">
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
            <ul className={`grid gap-2.5 ${dense ? 'grid-cols-3' : 'grid-cols-2'}`}>
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
                      className={`relative flex w-full flex-col items-center justify-center rounded-2xl border px-2 transition-colors duration-200 ${
                        dense ? 'min-h-21 py-2.5' : 'min-h-25 py-3'
                      } ${
                        isSelected
                          ? 'border-brass bg-brass/12'
                          : editing
                            ? 'border-brick/40 bg-brick/8'
                            : 'border-edge bg-felt-800'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`absolute top-2 right-2 flex size-5.5 items-center justify-center rounded-full text-[11px] font-black transition-opacity duration-200 ${
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
                      <span className={dense ? 'text-2xl leading-none' : 'text-3xl leading-none'}>
                        {player.emoji}
                      </span>
                      <span
                        className={`mt-2 max-w-full truncate font-bold ${
                          dense ? 'text-[12.5px]' : 'text-sm'
                        }`}
                      >
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
        </div>
      </div>

      <div className="shrink-0 pt-4">
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
