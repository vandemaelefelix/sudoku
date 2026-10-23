import { useSyncExternalStore } from 'react'

/** The route is the hash without `#/`, split at `/`: `#/a/outlines` is ['a', 'outlines']. */
export function useRoute(): string[] {
  const hash = useSyncExternalStore(
    (notify) => {
      window.addEventListener('hashchange', notify)
      return () => window.removeEventListener('hashchange', notify)
    },
    () => window.location.hash,
  )
  return hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent)
}

export function go(path: string): void {
  window.location.hash = `#/${path}`
}
