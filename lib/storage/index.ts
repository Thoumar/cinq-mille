/**
 * Le point de bascule : **le seul endroit à modifier** pour changer de stockage.
 *
 * `NEXT_PUBLIC_STORAGE=http` suffit à faire passer toute l'application derrière une
 * API (et donc derrière Postgres) sans toucher un composant.
 */

import { createHttpRepository } from './http'
import { createLocalRepository, memoryStorage } from './local'
import type { Repository } from './types'

let cached: Repository | null = null

export function getRepository(): Repository {
  if (cached) return cached

  if (process.env.NEXT_PUBLIC_STORAGE === 'http') {
    cached = createHttpRepository()
    return cached
  }

  // Pendant le rendu serveur il n'y a pas de `localStorage` : on renvoie un stockage
  // en mémoire, jamais lu côté client puisque le vrai chargement a lieu dans un effet.
  const storage = typeof window === 'undefined' ? memoryStorage() : window.localStorage
  cached = createLocalRepository(storage)
  return cached
}

/** Réservé aux tests. */
export function setRepository(repository: Repository | null): void {
  cached = repository
}

export { createHttpRepository, createLocalRepository, memoryStorage }
export * from './types'
