import { createContext, useContext } from 'react'
import type { GameStorage } from '@/storage'

export const GameStorageContext = createContext<GameStorage | null>(null)

export function useGameStorage(): GameStorage {
  const storage = useContext(GameStorageContext)
  if (storage === null) throw new Error('useGameStorage needs a GameStorageProvider')
  return storage
}
