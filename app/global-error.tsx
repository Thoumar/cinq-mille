'use client'

/** Dernier recours : une exception dans la racine, où même le layout n'existe plus. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="fr">
      <body
        style={{
          background: '#0a2317',
          color: '#f2eee2',
          fontFamily: 'system-ui, sans-serif',
          margin: 0,
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          padding: '2rem',
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: '1.4rem', margin: 0 }}>5000 n’a pas pu démarrer</h1>
        <pre
          style={{
            fontSize: '0.72rem',
            color: '#cc5c4f',
            maxWidth: '100%',
            overflowX: 'auto',
            textAlign: 'left',
          }}
        >
          {error.message}
        </pre>
        <button
          type="button"
          onClick={reset}
          style={{
            minHeight: '3rem',
            padding: '0 1.6rem',
            borderRadius: '1rem',
            border: 0,
            background: '#d9a441',
            color: '#0a2317',
            fontWeight: 800,
            fontSize: '1rem',
          }}
        >
          Réessayer
        </button>
      </body>
    </html>
  )
}
