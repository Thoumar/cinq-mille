/**
 * Les règles du 5000, verrouillées en dur (SPEC.md §3).
 *
 * Aucune de ces valeurs n'est configurable par l'utilisateur : c'est une décision
 * produit assumée, pas un oubli. Les changer ici change le jeu.
 */

/** Total à atteindre **exactement** pour gagner. */
export const GOAL = 5000

/**
 * Score minimum d'un tour pour ouvrir son compteur.
 * 500 **inclus** ouvre la partie (confirmé pendant le cadrage).
 */
export const OPENING_THRESHOLD = 500

/** Tout score de tour est un multiple de ce pas. Garde-fou contre les fautes de frappe. */
export const SCORE_STEP = 50

/** Le pavé accepte 5 chiffres. */
export const MAX_SCORE_INPUT = 99999

export type ScoreRejection = 'not-integer' | 'negative' | 'not-multiple' | 'too-large'

/** `null` si le score est saisissable, sinon la raison du refus. */
export function validateScore(raw: number): ScoreRejection | null {
  if (!Number.isFinite(raw) || !Number.isInteger(raw)) return 'not-integer'
  if (raw < 0) return 'negative'
  if (raw > MAX_SCORE_INPUT) return 'too-large'
  if (raw % SCORE_STEP !== 0) return 'not-multiple'
  return null
}

export function rejectionMessage(reason: ScoreRejection): string {
  switch (reason) {
    case 'not-multiple':
      return `doit être un multiple de ${SCORE_STEP}`
    case 'too-large':
      return 'score trop grand'
    case 'negative':
      return 'score négatif impossible'
    case 'not-integer':
      return 'score invalide'
  }
}
