'use client'

import { useState } from 'react'

import { EMOJI_CHOICES, playerColor } from '@/lib/colors'
import type { Player } from '@/lib/engine'
import { plural } from '@/lib/format'
import { useStore } from '@/lib/store'
import { type Team, teamPlayers } from '@/lib/teams'

import { Die } from './icons'
import { Sheet } from './Sheet'

type Editing = { mode: 'new' } | { mode: 'edit'; team: Team } | null

export function SetupScreen() {
  const store = useStore()
  const { roster, teams, startGame, cue } = store

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Editing>(null)

  // Les équipes arrivent déjà triées, la dernière jouée en tête : sans choix
  // explicite, c'est donc elle qui est proposée.
  const current = teams.find((team) => team.id === selectedId) ?? teams[0] ?? null
  const players = current ? teamPlayers(current, roster) : []
  const canStart = players.length >= 2

  return (
    <main className="flex flex-1 flex-col overflow-hidden pt-safe pb-safe">
      <header className="shrink-0 px-5 pt-5 pb-7 text-center">
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

      <div className="flex min-h-0 flex-1 flex-col justify-center">
        <h2 className="mb-3 shrink-0 px-5 text-[11px] font-bold tracking-[0.16em] text-cream-faint uppercase">
          {teams.length === 0 ? 'Aucune équipe' : 'Avec qui joues-tu ?'}
        </h2>

        {/* Carrousel : les équipes se parcourent au pouce, à l'horizontale. Une liste
            verticale mangerait toute la hauteur pour une information courte. */}
        <div className="flex shrink-0 snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-5 pb-2">
          {teams.map((team, index) => {
            const members = teamPlayers(team, roster)
            const isCurrent = current?.id === team.id
            return (
              <button
                key={team.id}
                type="button"
                onClick={() => {
                  cue('tap')
                  setSelectedId(team.id)
                }}
                aria-pressed={isCurrent}
                className={`flex w-40 shrink-0 snap-start flex-col rounded-2xl border px-3.5 py-3 text-left transition-colors duration-200 ${
                  isCurrent ? 'border-brass bg-brass/12' : 'border-edge bg-felt-800'
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-[15px] font-bold">{team.name}</span>
                  {index === 0 && team.lastPlayedAt !== null && (
                    <span className="shrink-0 text-[9px] font-black tracking-[0.1em] text-brass uppercase">
                      dernière
                    </span>
                  )}
                </span>
                <span className="mt-2.5 flex h-7 items-center gap-0.5 overflow-hidden text-xl">
                  {members.length === 0 ? (
                    <span className="text-[12px] text-cream-faint">vide</span>
                  ) : (
                    members.slice(0, 5).map((player) => (
                      <span key={player.id} className="leading-none">
                        {player.emoji}
                      </span>
                    ))
                  )}
                  {members.length > 5 && (
                    <span className="ml-1 text-[11px] text-cream-faint">
                      +{members.length - 5}
                    </span>
                  )}
                </span>
                <span className="num mt-2 text-[11.5px] text-cream-faint">
                  {members.length} {plural(members.length, 'joueur')}
                </span>
              </button>
            )
          })}

          <button
            type="button"
            onClick={() => setEditing({ mode: 'new' })}
            className="flex w-40 shrink-0 snap-start flex-col items-center justify-center rounded-2xl border border-dashed border-edge px-3.5 py-3 text-center text-[13.5px] font-bold text-cream-dim"
          >
            <span className="text-2xl leading-none">+</span>
            <span className="mt-2">Nouvelle équipe</span>
          </button>
        </div>

        {current && (
          <div className="min-h-0 shrink px-5 pt-3">
            <ul className="flex flex-wrap justify-center gap-x-2 gap-y-1.5">
              {players.map((player, index) => (
                <li
                  key={player.id}
                  className="flex items-center gap-1.5 rounded-full border border-edge bg-felt-800 py-1 pr-3 pl-1.5"
                >
                  <span
                    className="num flex size-5 items-center justify-center rounded-full text-[10px] font-black text-felt-950"
                    style={{ background: playerColor(player.colorIndex) }}
                  >
                    {index + 1}
                  </span>
                  <span className="text-[13px] font-semibold">
                    {player.emoji} {player.name}
                  </span>
                </li>
              ))}
            </ul>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setEditing({ mode: 'edit', team: current })}
                className="mt-2 min-h-11 px-4 text-[13px] font-bold text-cream-faint"
              >
                Modifier l’équipe
              </button>
            </div>
          </div>
        )}

        {teams.length === 0 && (
          <p className="mx-5 mt-3 text-center text-[13.5px] leading-relaxed text-cream-dim">
            Crée une équipe pour ta tablée : elle sera là aux prochaines parties.
          </p>
        )}
      </div>

      <div className="shrink-0 px-5 pt-4">
        <button
          type="button"
          disabled={!canStart}
          onClick={() => current && startGame(players, current.id)}
          className={`flex min-h-16 w-full items-center justify-center rounded-2xl bg-linear-to-b from-brass-bright to-brass text-lg font-black text-felt-950 transition-all duration-300 ease-out ${
            canStart
              ? 'scale-100 opacity-100 shadow-[0_10px_30px_rgba(217,164,65,0.26)]'
              : 'scale-[0.985] opacity-35 shadow-none'
          }`}
        >
          {canStart
            ? `C’est parti · ${players.length} ${plural(players.length, 'joueur')}`
            : 'Une équipe de 2 joueurs minimum'}
        </button>
      </div>

      <TeamSheet
        editing={editing}
        onClose={() => setEditing(null)}
        onSaved={(team) => {
          setSelectedId(team.id)
          setEditing(null)
        }}
        onDeleted={() => {
          setSelectedId(null)
          setEditing(null)
        }}
      />
    </main>
  )
}

/** Création et modification d'une équipe : nom, membres, ordre de passage. */
function TeamSheet({
  editing,
  onClose,
  onSaved,
  onDeleted,
}: {
  editing: Editing
  onClose: () => void
  onSaved: (team: Team) => void
  onDeleted: () => void
}) {
  const { roster, createTeam, updateTeam, removeTeam, deleteRosterPlayer, cue } = useStore()
  const existing = editing?.mode === 'edit' ? editing.team : null

  // Remonter la feuille remet le formulaire à l'état de l'équipe visée : la clé
  // force React à repartir d'un état neuf plutôt que de conserver l'ancien.
  return (
    <Sheet
      key={existing?.id ?? (editing ? 'new' : 'closed')}
      open={editing !== null}
      onClose={onClose}
      label={existing ? 'Modifier l’équipe' : 'Nouvelle équipe'}
      height="tall"
    >
      <TeamForm
        team={existing}
        roster={roster}
        onCue={cue}
        onDeletePlayer={deleteRosterPlayer}
        onSubmit={(name, playerIds) => {
          if (existing) {
            const updated = { ...existing, name, playerIds }
            updateTeam(updated)
            onSaved(updated)
          } else {
            onSaved(createTeam(name, playerIds))
          }
        }}
        onDelete={
          existing
            ? () => {
                removeTeam(existing.id)
                onDeleted()
              }
            : undefined
        }
      />
    </Sheet>
  )
}

function TeamForm({
  team,
  roster,
  onCue,
  onSubmit,
  onDelete,
  onDeletePlayer,
}: {
  team: Team | null
  roster: Player[]
  onCue: (cue: 'tap') => void
  onSubmit: (name: string, playerIds: string[]) => void
  onDelete?: () => void
  onDeletePlayer: (id: string) => void
}) {
  const [name, setName] = useState(team?.name ?? '')
  const [picked, setPicked] = useState<string[]>(team?.playerIds ?? [])
  const [adding, setAdding] = useState(false)
  const [managing, setManaging] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const toggle = (id: string) => {
    onCue('tap')
    setPicked((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    )
  }

  const label = name.trim() || (team ? team.name : 'Sans nom')

  return (
    <div className="pb-2">
      <h2 className="font-display text-2xl">
        {team ? 'Modifier l’équipe' : 'Nouvelle équipe'}
      </h2>

      <label
        htmlFor="team-name"
        className="mt-5 block text-[11px] font-bold tracking-[0.16em] text-cream-faint uppercase"
      >
        Nom de l’équipe
      </label>
      <input
        id="team-name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        autoComplete="off"
        autoCapitalize="words"
        maxLength={24}
        placeholder="Le chalet"
        className="mt-2 min-h-13 w-full rounded-2xl border border-edge bg-felt-700 px-4 text-[17px] font-semibold text-cream placeholder:font-normal placeholder:text-cream-dim focus:border-brass focus:outline-none"
      />

      <div className="mt-6 flex items-baseline justify-between">
        <p className="text-[11px] font-bold tracking-[0.16em] text-cream-faint uppercase">
          {managing ? 'Retirer du roster' : 'Membres, dans l’ordre de passage'}
        </p>
        {roster.length > 0 && (
          <button
            type="button"
            onClick={() => setManaging((v) => !v)}
            className="min-h-11 pl-3 text-[12.5px] font-bold text-cream-faint"
          >
            {managing ? 'Terminé' : 'Gérer'}
          </button>
        )}
      </div>

      {roster.length === 0 ? (
        <p className="mt-1 rounded-2xl border border-dashed border-edge px-5 py-6 text-center text-[13px] text-cream-dim">
          Aucun joueur enregistré pour l’instant.
        </p>
      ) : (
        <ul className="mt-1 grid grid-cols-3 gap-2.5">
          {roster.map((player) => {
            const rank = picked.indexOf(player.id)
            const isPicked = rank >= 0 && !managing
            return (
              <li key={player.id}>
                <button
                  type="button"
                  onClick={() => (managing ? onDeletePlayer(player.id) : toggle(player.id))}
                  aria-pressed={managing ? undefined : rank >= 0}
                  aria-label={managing ? `Retirer ${player.name} du roster` : player.name}
                  className={`relative flex min-h-21 w-full flex-col items-center justify-center rounded-2xl border px-2 py-2.5 transition-colors duration-200 ${
                    isPicked
                      ? 'border-brass bg-brass/12'
                      : managing
                        ? 'border-brick/40 bg-brick/8'
                        : 'border-edge bg-felt-700'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`absolute top-1.5 right-1.5 flex size-5.5 items-center justify-center rounded-full text-[11px] font-black transition-opacity duration-200 ${
                      isPicked || managing ? 'opacity-100' : 'opacity-0'
                    } ${managing ? 'bg-brick text-felt-950' : 'text-felt-950'}`}
                    style={
                      isPicked ? { background: playerColor(player.colorIndex) } : undefined
                    }
                  >
                    {managing ? '×' : rank + 1}
                  </span>
                  <span className="text-2xl leading-none">{player.emoji}</span>
                  <span className="mt-1.5 max-w-full truncate text-[12.5px] font-bold">
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
        className="mt-2.5 flex min-h-13 w-full items-center justify-center rounded-2xl border border-edge bg-felt-700 text-[15px] font-bold text-cream-dim"
      >
        + Nouveau joueur
      </button>

      <button
        type="button"
        disabled={picked.length < 2 || !name.trim()}
        onClick={() => onSubmit(name, picked)}
        className="mt-7 flex min-h-14 w-full items-center justify-center rounded-2xl bg-linear-to-b from-brass-bright to-brass text-base font-black text-felt-950 transition-opacity disabled:opacity-30"
      >
        {picked.length < 2
          ? 'Choisis au moins 2 joueurs'
          : !name.trim()
            ? 'Donne un nom à l’équipe'
            : `Enregistrer ${label}`}
      </button>

      {onDelete && (
        <button
          type="button"
          onClick={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}
          className="mt-2.5 mb-2 flex min-h-13 w-full items-center justify-center rounded-2xl border border-brick/35 bg-brick/8 text-[14px] font-bold text-brick"
        >
          {confirmDelete ? '⚠ Confirmer la suppression' : 'Supprimer l’équipe'}
        </button>
      )}

      <AddPlayerSheet
        open={adding}
        onClose={() => setAdding(false)}
        onCreated={(player) => {
          setPicked((current) => [...current, player.id])
          setAdding(false)
        }}
        takenEmojis={roster.map((p) => p.emoji)}
      />
    </div>
  )
}

function AddPlayerSheet({
  open,
  onClose,
  onCreated,
  takenEmojis,
}: {
  open: boolean
  onClose: () => void
  onCreated: (player: Player) => void
  takenEmojis: string[]
}) {
  const { createRosterPlayer } = useStore()
  const free = EMOJI_CHOICES.filter((e) => !takenEmojis.includes(e))
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState<string>(free[0] ?? EMOJI_CHOICES[0])

  const submit = () => {
    if (!name.trim()) return
    onCreated(createRosterPlayer(name, emoji))
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
