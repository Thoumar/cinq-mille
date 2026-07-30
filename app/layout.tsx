import type { Metadata, Viewport } from 'next'
import { Fraunces, Inter } from 'next/font/google'

import { RegisterServiceWorker } from '@/components/RegisterServiceWorker'
import { StoreProvider } from '@/lib/store'

import './globals.css'

// Auto-hébergées par next/font au moment du build : aucune requête réseau à
// l'exécution, donc rien à mettre en cache pour le fonctionnement hors-ligne.
const body = Inter({ subsets: ['latin'], variable: '--font-body', display: 'swap' })
const title = Fraunces({ subsets: ['latin'], variable: '--font-title', display: 'swap' })

export const metadata: Metadata = {
  title: '5000',
  description: 'Carnet de scores pour le jeu de dés du 5000.',
  applicationName: '5000',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: '5000' },
}

export const viewport: Viewport = {
  themeColor: '#0a2317',
  width: 'device-width',
  initialScale: 1,
  // Le pincement reste autorisé : bloquer le zoom pour « faire natif » se paie en
  // accessibilité, et `touch-action: manipulation` suffit à supprimer la latence.
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${body.variable} ${title.variable}`}>
      <body>
        <StoreProvider>
          <div className="relative z-1 mx-auto flex h-full w-full max-w-md flex-col overflow-hidden">
            {children}
          </div>
        </StoreProvider>
        <noscript>
          <div
            style={{
              padding: '2rem',
              textAlign: 'center',
              color: '#f2eee2',
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            Ce carnet a besoin de JavaScript pour fonctionner. Active-le dans les
            réglages du navigateur.
          </div>
        </noscript>
        <RegisterServiceWorker />
      </body>
    </html>
  )
}
