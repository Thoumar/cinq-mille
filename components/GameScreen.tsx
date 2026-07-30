'use client'

import { useEffect, useRef, useState } from 'react'

import { playerColor } from '@/lib/colors'
import { progression } from '@/lib/engine'
import { fmt } from '@/lib/format'
import { GOAL } from '@/lib/rules'
import { useStore } from '@/lib/store'

import { ChartIcon, GearIcon } from './icons'
import { NumPad } from './NumPad'
import { ProgressChart } from './ProgressChart'
import { Scoreboard } from './Scoreboard'
import { ScoreSheet } from './ScoreSheet'
import { Sheet } from './Sheet'

export function GameScreen() {
  const store = useStore()
  const { game, gameView, settings } = store

  const [entry, setEntry] = useState(false)
  const [carnet, setCarnet] = useState(false)
  const [menu, setMenu] = useState(false)
  const [chart, setChart] = useState(false)
  const [addPlayer, setAddPlayer] = useState(false)
  const [picked, setPicked] = useState<string | null>(null)
  const [toast, setToast] = useState(false)
  const [confirmAbandon, setConfirmAbandon] = useState(false)
  const dragStart = useRef<number | null>(null)

  // Le bandeau d'annulation reste ~5 s après une validation (SPEC.md §4.5).
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(false), 5200)
    return () => clearTimeout(timer)
  }, [toast])

  if (!game || !gameView) return null

  const current = gameView.states.find((s) => s.player.id === gameView.currentPlayerId)
  const pickedState = gameView.states.find((s) => s.player.id === picked)
  const outsiders = store.roster.filter(
    (candidate) => !gameView.states.some((s) => s.player.id === candidate.id),
  )

  const submit = (raw: number) => {
    store.submitScore(raw)
    setEntry(false)
    setToast(true)
  }

  return (
    /* Trois bandes, comme partout dans l'application : en-tête et zone de saisie
       sont fixes, seul le classement défile quand la tablée déborde. */
    <main className="flex flex-1 flex-col overflow-hidden px-4 pt-safe pb-safe">
      <header className="flex shrink-0 items-center justify-between py-3">
        <p className="num text-[13px] font-bold tracking-wide text-cream-dim">
          Tour {gameView.currentRound}
        </p>
        <div className="-mr-2 flex items-center">
          <button
            type="button"
            onClick={() => setChart(true)}
            aria-label="Voir la progression"
            className="flex size-11 items-center justify-center text-cream-dim active:text-brass"
          >
            <ChartIcon className="size-6" />
          </button>
          <button
            type="button"
            onClick={() => setMenu(true)}
            aria-label="Réglages et actions de la partie"
            className="flex size-11 items-center justify-center text-cream-dim active:text-brass"
          >
            <GearIcon className="size-6" />
          </button>
        </div>
      </header>

      {store.writeError && (
        <p className="mb-3 shrink-0 rounded-xl border border-brick/40 bg-brick/10 px-3 py-2 text-[12px] text-brick">
          Sauvegarde impossible ({store.writeError}). La partie reste jouable, mais elle
          pourrait ne pas survivre à une fermeture de l’onglet.
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <Scoreboard
          standings={gameView.standings}
          currentPlayerId={gameView.currentPlayerId}
          onPick={(state) => setPicked(state.player.id)}
        />
      </div>

      <div className="shrink-0 pt-4">
        {toast && store.undoLabel && (
          <div className="animate-rise mb-2.5 flex items-center justify-between rounded-xl border border-edge bg-felt-800 px-3.5 py-2.5">
            <span className="num text-[13px] text-cream-dim">
              {gameView.records.at(-1)?.kind === 'no-open'
                ? 'sous les 500 : compteur inchangé'
                : `${fmt(gameView.records.at(-1)?.raw ?? 0)} enregistré`}
            </span>
            <button
              type="button"
              onClick={() => {
                store.undo()
                setToast(false)
              }}
              className="min-h-9 px-2 text-[13px] font-black text-brass"
            >
              ↶ Annuler
            </button>
          </div>
        )}

        {current ? (
          <button
            type="button"
            onClick={() => {
              store.cue('tap')
              setEntry(true)
            }}
            className="flex min-h-16 w-full items-center justify-center gap-2.5 rounded-2xl bg-linear-to-b from-brass-bright to-brass text-[17px] font-black text-felt-950 shadow-[0_8px_24px_rgba(217,164,65,0.22)]"
          >
            <span className="text-2xl">{current.player.emoji}</span>
            {current.player.name} — saisir
          </button>
        ) : (
          <p className="rounded-2xl border border-edge px-4 py-5 text-center text-sm text-cream-dim">
            Plus aucun joueur en partie.
          </p>
        )}

        {/* Poignée du carnet : tap ou glissement vers le haut. */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setCarnet(true)}
          onKeyDown={(event) => event.key === 'Enter' && setCarnet(true)}
          onPointerDown={(event) => {
            dragStart.current = event.clientY
          }}
          onPointerMove={(event) => {
            if (dragStart.current !== null && dragStart.current - event.clientY > 26) {
              dragStart.current = null
              setCarnet(true)
            }
          }}
          onPointerUp={() => {
            dragStart.current = null
          }}
          className="mt-3 flex cursor-pointer flex-col items-center gap-1.5 pt-2 pb-1"
        >
          <span className="h-1.5 w-11 rounded-full bg-cream-faint/45" />
          <span className="text-[11px] font-semibold tracking-wide text-cream-faint">
            {gameView.rows.length === 0
              ? 'le carnet'
              : `le carnet · ${gameView.rows.length} ${gameView.rows.length > 1 ? 'tours' : 'tour'}`}
          </span>
        </div>
      </div>

      {/* ---------------------------------------------------------- saisie */}
      <Sheet open={entry} onClose={() => setEntry(false)} label="Saisir un score" height="tall">
        {current && (
          <NumPad
            player={current.player}
            total={current.total}
            opened={current.opened}
            onSubmit={submit}
            onTap={() => store.cue('tap')}
          />
        )}
      </Sheet>

      {/* ---------------------------------------------------------- carnet */}
      <Sheet open={carnet} onClose={() => setCarnet(false)} label="Le carnet" height="tall">
        <h2 className="font-display mb-3 text-2xl">Le carnet</h2>
        <ScoreSheet view={gameView} />
        <p className="mt-3 mb-2 text-[11.5px] leading-relaxed text-cream-faint">
          Un score barré est un tour sous les 500 avant ouverture : il ne compte pas.
          Un « ↰ » signale un rebond au-dessus de {fmt(GOAL)}.
        </p>
      </Sheet>

      {/* ------------------------------------------------------ progression */}
      <Sheet open={chart} onClose={() => setChart(false)} label="Progression">
        <h2 className="font-display mb-4 text-2xl">Progression</h2>
        <ProgressChart series={progression(game)} />
        <div className="h-4" />
      </Sheet>

      {/* ----------------------------------------------------- menu joueur */}
      <Sheet open={picked !== null} onClose={() => setPicked(null)} label="Actions du joueur">
        {pickedState && (
          <>
            <div className="flex items-center gap-3 pb-4">
              <span className="text-3xl">{pickedState.player.emoji}</span>
              <div>
                <p className="text-lg font-bold">{pickedState.player.name}</p>
                <p
                  className="num text-[13px]"
                  style={{ color: playerColor(pickedState.player.colorIndex) }}
                >
                  {fmt(pickedState.total)} pts
                  {pickedState.opened ? '' : ' · compteur non ouvert'}
                </p>
              </div>
            </div>

            {pickedState.player.id === gameView.currentPlayerId && (
              <MenuRow
                label="⏭ Passer son tour"
                hint="Il revient au tour suivant."
                onClick={() => {
                  store.skipCurrent()
                  setPicked(null)
                }}
              />
            )}
            <MenuRow
              label="✕ Le retirer de la partie"
              hint="Ses tours déjà joués restent au carnet."
              danger
              onClick={() => {
                store.removeFromGame(pickedState.player.id)
                setPicked(null)
              }}
            />
            <div className="h-2" />
          </>
        )}
      </Sheet>

      {/* ---------------------------------------------------- menu partie */}
      <Sheet
        open={menu}
        onClose={() => {
          setMenu(false)
          setConfirmAbandon(false)
        }}
        label="Menu de la partie"
        height="tall"
      >
        <h2 className="font-display mb-4 text-2xl">Réglages</h2>

        {store.undoLabel && (
          <MenuRow
            label={`↶ Annuler ${store.undoLabel}`}
            onClick={() => {
              store.undo()
              setMenu(false)
            }}
          />
        )}
        <MenuRow
          label="＋ Ajouter un joueur"
          hint="Il entre à 0, compteur non ouvert."
          onClick={() => {
            setMenu(false)
            setAddPlayer(true)
          }}
        />

        <p className="mt-6 mb-2 text-[10.5px] font-bold tracking-[0.16em] text-cream-faint uppercase">
          Réglages
        </p>
        <Toggle
          label="Vibration"
          on={settings.vibration}
          onChange={(on) => store.updateSettings({ vibration: on })}
        />
        <Toggle
          label="Sons"
          on={settings.sound}
          onChange={(on) => store.updateSettings({ sound: on })}
        />

        <div className="mt-7 mb-2">
          <MenuRow
            label={confirmAbandon ? '⚠ Confirmer l’abandon' : '🗑 Abandonner la partie'}
            hint={confirmAbandon ? 'La partie sera définitivement effacée.' : undefined}
            danger
            onClick={() => {
              if (!confirmAbandon) {
                setConfirmAbandon(true)
                return
              }
              store.abandonGame()
            }}
          />
        </div>
      </Sheet>

      {/* ------------------------------------------------ ajout en cours */}
      <Sheet
        open={addPlayer}
        onClose={() => setAddPlayer(false)}
        label="Ajouter un joueur"
        height="tall"
      >
        <h2 className="font-display mb-1 text-2xl">Ajouter un joueur</h2>
        <p className="mb-4 text-[13px] text-cream-dim">
          Il entre à 0 point, compteur non ouvert, et joue en fin de tour.
        </p>
        {outsiders.length === 0 ? (
          <p className="rounded-xl border border-dashed border-edge px-4 py-6 text-center text-[13px] text-cream-faint">
            Tout le roster est déjà dans la partie.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-2.5 pb-3">
            {outsiders.map((player) => (
              <li key={player.id}>
                <button
                  type="button"
                  onClick={() => {
                    store.addToGame(player)
                    setAddPlayer(false)
                  }}
                  className="flex min-h-22 w-full flex-col items-center justify-center rounded-2xl border border-edge bg-felt-700 py-3"
                >
                  <span className="text-3xl leading-none">{player.emoji}</span>
                  <span className="mt-2 max-w-full truncate text-sm font-bold">
                    {player.name}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </main>
  )
}

function MenuRow({
  label,
  hint,
  danger,
  onClick,
}: {
  label: string
  hint?: string
  danger?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`mb-2 flex min-h-14 w-full flex-col justify-center rounded-2xl border px-4 py-2 text-left ${
        danger ? 'border-brick/35 bg-brick/8' : 'border-edge bg-felt-700'
      }`}
    >
      <span className={`text-[15px] font-bold ${danger ? 'text-brick' : ''}`}>{label}</span>
      {hint && <span className="mt-0.5 text-[11.5px] text-cream-faint">{hint}</span>}
    </button>
  )
}

function Toggle({
  label,
  on,
  onChange,
}: {
  label: string
  on: boolean
  onChange: (on: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="mb-2 flex min-h-14 w-full items-center justify-between rounded-2xl border border-edge bg-felt-700 px-4"
    >
      <span className="text-[15px] font-bold">{label}</span>
      <span
        className={`flex h-7 w-12 items-center rounded-full px-0.5 transition-colors ${
          on ? 'bg-brass' : 'bg-felt-950'
        }`}
      >
        <span
          className={`size-6 rounded-full bg-cream transition-transform ${
            on ? 'translate-x-5' : ''
          }`}
        />
      </span>
    </button>
  )
}
