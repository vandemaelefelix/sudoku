import type { ReactNode } from 'react'
import type { NewGame } from '@sudoku/core'
import { GameContext } from '@/game/hooks/useGame'
import { useGameSession } from '@/game/hooks/useGameSession'

type GameProviderProps = { start: NewGame; children: ReactNode }

export function GameProvider({ start, children }: GameProviderProps) {
  return <GameContext value={useGameSession(start)}>{children}</GameContext>
}
