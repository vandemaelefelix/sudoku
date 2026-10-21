import { createContext, useContext } from 'react'
import type { GameActions } from '@/game/utils/gameSession.utils'

export const GameActionsContext = createContext<GameActions | null>(null)

export function useGameActions(): GameActions {
  const actions = useContext(GameActionsContext)
  if (actions === null) throw new Error('useGameActions needs a GameProvider')
  return actions
}
