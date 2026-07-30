'use client'

/**
 * Filet de sécurité. Sans lui, la moindre exception au rendu donne un écran noir —
 * illisible pour qui l'utilise, et indébogable à distance. Ici le message s'affiche
 * à l'écran : c'est souvent la seule information disponible quand le problème se
 * produit sur le téléphone de quelqu'un d'autre.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-5 px-7 text-center">
      <p className="text-4xl">🎲</p>
      <h1 className="font-display text-2xl">Quelque chose a lâché</h1>
      <p className="max-w-xs text-sm text-cream-dim">
        La partie en cours est sauvegardée : elle devrait revenir si tu réessaies.
      </p>
      <pre className="max-w-full overflow-x-auto rounded-xl border border-edge bg-felt-800 px-3 py-2.5 text-left text-[11px] leading-relaxed text-brick">
        {error.message}
        {error.digest ? `\n(${error.digest})` : ''}
      </pre>
      <button
        type="button"
        onClick={reset}
        className="mt-2 flex min-h-13 w-full max-w-xs items-center justify-center rounded-2xl bg-linear-to-b from-brass-bright to-brass text-base font-black text-felt-950"
      >
        Réessayer
      </button>
    </main>
  )
}
