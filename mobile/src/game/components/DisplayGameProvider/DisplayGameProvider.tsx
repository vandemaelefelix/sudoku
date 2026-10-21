import { useMemo, type ReactNode } from 'react'
import type { Game } from '@sudoku/core'
import { GameActionsContext } from '@/game/hooks/useGameActions'
import { GameStateContext, type GameState } from '@/game/hooks/useGameState'
import type { GameActions } from '@/game/utils/gameSession.utils'

const ignore = () => undefined

// A new action in GameActions fails the typecheck here, so a display grid cannot act by mistake.
const NO_ACTIONS: GameActions = {
  select: ignore,
  digit: ignore,
  erase: ignore,
  undo: ignore,
  hint: ignore,
  toggleNotesMode: ignore,
  pause: ignore,
  resume: ignore,
}

type DisplayGameProviderProps = { board: Game; children: ReactNode }

/**
 * A game context that only shows a board, for a Grid with interactive false.
 * No clock and no moves: move stays null, so no pulse and no haptic. No time context: a TimerPill throws here.
 */
export function DisplayGameProvider({ board, children }: DisplayGameProviderProps) {
  const state = useMemo<GameState>(() => ({ board, notesMode: false, move: null }), [board])
  return (
    <GameActionsContext value={NO_ACTIONS}>
      <GameStateContext value={state}>{children}</GameStateContext>
    </GameActionsContext>
  )
}
