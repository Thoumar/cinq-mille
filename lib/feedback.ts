/**
 * Retours physiques : vibration, sons, écran allumé.
 *
 * Tout est en dégradation silencieuse — ces API sont inégalement supportées et
 * aucune n'est essentielle au fonctionnement. Aucun fichier audio : les sons sont
 * synthétisés, ce qui garde l'application entièrement hors-ligne sans rien à mettre
 * en cache.
 */

import type { Settings } from './storage/types'

export type Cue = 'validate' | 'bounce' | 'miss' | 'win' | 'tap'

const VIBRATION: Record<Cue, number | number[]> = {
  tap: 8,
  validate: 18,
  miss: [24, 40, 24],
  bounce: [40, 60, 40],
  win: [60, 50, 60, 50, 160],
}

/** Fréquences (Hz) et durées (s) — de simples arpèges, pas de la musique. */
const TONES: Record<Cue, { notes: number[]; step: number }> = {
  tap: { notes: [880], step: 0.04 },
  validate: { notes: [660, 990], step: 0.07 },
  miss: { notes: [300, 200], step: 0.11 },
  bounce: { notes: [700, 520, 380], step: 0.1 },
  win: { notes: [523, 659, 784, 1047], step: 0.12 },
}

let audioContext: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    audioContext ??= new AudioContext()
    // Les navigateurs mobiles suspendent le contexte hors interaction.
    if (audioContext.state === 'suspended') void audioContext.resume()
    return audioContext
  } catch {
    return null
  }
}

function playTone(cue: Cue): void {
  const context = getAudioContext()
  if (!context) return
  const { notes, step } = TONES[cue]
  notes.forEach((frequency, index) => {
    const start = context.currentTime + index * step
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = 'triangle'
    oscillator.frequency.value = frequency
    // Enveloppe courte : un clic sec, pas une nappe.
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(0.18, start + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + step * 1.6)
    oscillator.connect(gain).connect(context.destination)
    oscillator.start(start)
    oscillator.stop(start + step * 1.8)
  })
}

export function feedback(cue: Cue, settings: Settings): void {
  if (settings.vibration && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(VIBRATION[cue])
    } catch {
      /* certains navigateurs déclarent l'API sans l'implémenter */
    }
  }
  if (settings.sound) playTone(cue)
}

type WakeLockSentinel = { released: boolean; release: () => Promise<void> }
type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinel> }
}

/**
 * Empêche la mise en veille pendant une partie. Le verrou est perdu quand l'onglet
 * passe en arrière-plan : il faut le redemander au retour, d'où l'écoute de
 * `visibilitychange`. Renvoie la fonction de libération.
 */
export function keepScreenAwake(): () => void {
  if (typeof navigator === 'undefined') return () => {}
  const wakeLock = (navigator as WakeLockNavigator).wakeLock
  if (!wakeLock) return () => {}

  let sentinel: WakeLockSentinel | null = null
  let cancelled = false

  const acquire = async () => {
    if (cancelled || document.visibilityState !== 'visible') return
    try {
      sentinel = await wakeLock.request('screen')
    } catch {
      // Refus courant : batterie faible, ou onglet non visible. Sans conséquence.
    }
  }

  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible' && (!sentinel || sentinel.released)) {
      void acquire()
    }
  }

  void acquire()
  document.addEventListener('visibilitychange', onVisibilityChange)

  return () => {
    cancelled = true
    document.removeEventListener('visibilitychange', onVisibilityChange)
    void sentinel?.release().catch(() => {})
    sentinel = null
  }
}
