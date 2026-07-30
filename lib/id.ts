/**
 * Génération d'identifiants côté client.
 *
 * `crypto.randomUUID` n'existe que dans un **contexte sécurisé** (https ou
 * localhost) : sur le réseau local en http — exactement le cas quand on teste
 * depuis un téléphone sur `http://192.168.x.x:3000` — il est absent. D'où le repli
 * sur `crypto.getRandomValues`, qui lui est disponible partout, puis sur
 * `Math.random` en dernier recours.
 *
 * Le format reste un UUID v4 valide dans les trois cas, ce qui garde les colonnes
 * `uuid` de Postgres utilisables le jour de la bascule.
 */
export function newId(): string {
  const c = globalThis.crypto

  if (typeof c?.randomUUID === 'function') return c.randomUUID()

  const bytes = new Uint8Array(16)
  if (typeof c?.getRandomValues === 'function') {
    c.getRandomValues(bytes)
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40 // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // variante RFC 4122

  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
