import { createContext, useContext } from 'react'
import type { GameSession } from '@/game/hooks/useGameSession'

export const GameContext = createContext<GameSession | null>(null)

/** The game session of the screen. Each part reads it here, so a new part needs no new props. */
export function useGame(): GameSession {
  const session = useContext(GameContext)
  if (session === null) throw new Error('useGame needs a GameProvider')
  return session
}
