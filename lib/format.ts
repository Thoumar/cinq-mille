/** Formatage français des nombres, avec espace insécable pour les milliers. */
export function fmt(n: number): string {
  return n.toLocaleString('fr-FR')
}

/** « 3 min », « 12 min », « 1 h 04 ». */
export function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  return `${hours} h ${String(minutes % 60).padStart(2, '0')}`
}

export function plural(n: number, singular: string, plural = `${singular}s`): string {
  return n > 1 ? plural : singular
}
