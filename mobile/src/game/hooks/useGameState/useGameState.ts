import { createContext, useContext } from 'react'
import type { Session } from '@/game/utils/session.utils'

/** The game without the time. A clock tick does not change it, so its readers do not render each second. */
export type GameState = Pick<Session, 'board' | 'notesMode' | 'move'>

export const GameStateContext = createContext<GameState | null>(null)

export function useGameState(): GameState {
  const state = useContext(GameStateContext)
  if (state === null) throw new Error('useGameState needs a GameProvider')
  return state
}
