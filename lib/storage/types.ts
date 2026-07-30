import type { Game, Player } from '../engine'

export type Settings = {
  sound: boolean
  vibration: boolean
}

export const DEFAULT_SETTINGS: Settings = { sound: false, vibration: true }

/**
 * Version de la forme des données persistées.
 * À incrémenter dès qu'un champ change de nom, de type ou disparaît, et ajouter
 * la migration correspondante dans `codec.ts`.
 */
export const SCHEMA_VERSION = 1

/**
 * Le port de persistance.
 *
 * **Pourquoi cette interface est asynchrone** alors que `localStorage` est synchrone :
 * une base distante ne l'est pas. Si on partait en synchrone, passer à Postgres
 * obligerait à réécrire chaque appelant, chaque composant, et à introduire partout
 * les états de chargement qui n'existaient pas. En posant l'asynchrone dès le premier
 * jour, le remplacement d'adaptateur devient une ligne dans `index.ts`.
 *
 * **Pourquoi les opérations sont métier et non clé/valeur** : un port du genre
 * `get(key)` / `set(key, value)` forcerait l'adaptateur Postgres à stocker un blob
 * JSON, ce qui annulerait tout l'intérêt d'avoir une base. Ici chaque méthode se
 * traduit directement en une requête SQL (voir `db/schema.sql`).
 *
 * **Contrat commun à tous les adaptateurs :**
 * - Aucune méthode ne lève d'exception sur des données absentes ou corrompues :
 *   une lecture qui échoue renvoie `null` / `[]` / les réglages par défaut. Une
 *   application qui plante au démarrage à cause d'un stockage abîmé est
 *   irrécupérable pour l'utilisateur.
 * - Les écritures peuvent rejeter (quota dépassé, réseau coupé) ; l'appelant
 *   décide quoi en faire. L'état en mémoire reste la vérité pour l'affichage.
 * - Les identifiants sont générés côté client (`crypto.randomUUID`), jamais par le
 *   stockage : un `INSERT` Postgres n'a donc pas besoin d'un aller-retour pour
 *   connaître l'id.
 *
 * **Extension prévue pour le multi-écrivain** (plusieurs téléphones sur la même
 * partie) : ajouter un `revision: number` à la partie et faire de `saveGame` un
 * `UPDATE … WHERE revision = $n`, qui rejette en cas de conflit. Inutile
 * aujourd'hui — un seul appareil écrit — mais l'interface n'a pas à changer pour
 * l'accueillir.
 */
export interface Repository {
  readonly kind: 'local' | 'http' | 'memory'

  // — Roster : les joueurs habituels, indépendants des parties —
  listPlayers(): Promise<Player[]>
  upsertPlayer(player: Player): Promise<void>
  deletePlayer(id: string): Promise<void>

  // — La partie en cours (une seule à la fois, cf. SPEC.md §5) —
  loadGame(): Promise<Game | null>
  saveGame(game: Game): Promise<void>
  deleteGame(id: string): Promise<void>

  // — Préférences —
  loadSettings(): Promise<Settings>
  saveSettings(settings: Settings): Promise<void>
}
