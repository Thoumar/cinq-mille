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

  cached = createLocalRepository(safeStorage())
  return cached
}

/**
 * Récupère le `localStorage` sans jamais lever.
 *
 * L'accès à la **propriété** `window.localStorage` lève une `SecurityError` dans
 * Safari quand les cookies sont bloqués, et dans plusieurs navigateurs en navigation
 * privée verrouillée. Comme ce code s'exécute pendant le rendu du fournisseur, une
 * exception ici ne dégrade pas l'application : elle la remplace par un écran noir.
 * D'où le repli en mémoire — la partie n'est alors pas sauvegardée entre deux
 * ouvertures, mais elle est jouable.
 */
function safeStorage(): Storage {
  if (typeof window === 'undefined') return memoryStorage()
  try {
    const storage = window.localStorage
    // Certains navigateurs exposent l'objet mais refusent l'écriture : on vérifie.
    const probe = '__cinq_mille_probe__'
    storage.setItem(probe, '1')
    storage.removeItem(probe)
    return storage
  } catch {
    return memoryStorage()
  }
}

/** Réservé aux tests. */
export function setRepository(repository: Repository | null): void {
  cached = repository
}

export { createHttpRepository, createLocalRepository, memoryStorage }
export * from './types'
