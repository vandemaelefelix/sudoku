import { createContext, useContext } from 'react'
import type { Digit } from '@sudoku/core'

/** The moves of the player. The object keeps its identity for the whole game. */
export type GameActions = {
  select(cell: number): void
  digit(digit: Digit): void
  erase(): void
  undo(): void
  hint(): void
  toggleNotesMode(): void
  pause(): void
  resume(): void
}

export const GameActionsContext = createContext<GameActions | null>(null)

export function useGameActions(): GameActions {
  const actions = useContext(GameActionsContext)
  if (actions === null) throw new Error('useGameActions needs a GameProvider')
  return actions
}
