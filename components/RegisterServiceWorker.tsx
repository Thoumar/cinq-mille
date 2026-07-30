'use client'

import { useEffect } from 'react'

/** Enregistre le service worker qui rend l'app installable et utilisable hors-ligne. */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return
    // Après le chargement : l'enregistrement ne doit pas concurrencer le premier rendu.
    const register = () => void navigator.serviceWorker.register('/sw.js').catch(() => {})
    if (document.readyState === 'complete') register()
    else window.addEventListener('load', register, { once: true })
  }, [])

  return null
}
