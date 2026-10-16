import { randomUUID } from 'expo-crypto'
import { useEffect, useState, type ReactNode } from 'react'
import { createMemoryStorage, openStorage, type GameStorage } from '@/storage'
import { GameStorageContext } from '@/storage/hooks/useGameStorage'
import { devWarn, errorMessage } from '@/utils/log.utils'

type GameStorageProviderProps = { open?: () => Promise<GameStorage>; children: ReactNode }

/**
 * Renders the children after the storage opens, a few milliseconds after start. When the database does
 * not open, for example a file from a newer app version, the games live in memory and do not survive a kill.
 */
export function GameStorageProvider({ open = openStorage, children }: GameStorageProviderProps) {
  const [storage, setStorage] = useState<GameStorage | null>(null)
  useEffect(() => {
    let live = true
    open()
      .catch((error: unknown) => {
        devWarn('storage', `The game storage does not open, so games are not saved: ${errorMessage(error)}`)
        // The real clock and ids: the stats count days, and the default fake clock stays on 1 January 2026.
        return createMemoryStorage({ newId: randomUUID, now: () => new Date().toISOString() })
      })
      .then((opened) => {
        if (live) setStorage(opened)
      })
    return () => {
      live = false
    }
  }, [open])
  if (storage === null) return null
  return <GameStorageContext value={storage}>{children}</GameStorageContext>
}
