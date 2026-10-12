import { useCallback, useMemo, useReducer } from 'react'
import type { Digit, NewGame } from '@sudoku/core'
import { DEFAULT_ASSISTS } from '@/game/constants/assists.constants'
import { useGameClock } from '@/game/hooks/useGameClock'
import { useMoveHaptics } from '@/game/hooks/useMoveHaptics'
import { cellViews, type CellView } from '@/game/utils/cell.utils'
import { reduceSession, startSession, type Session } from '@/game/utils/session.utils'

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

export type GameSession = Session & { views: CellView[]; actions: GameActions }

/** One game in progress. start is read once, when the hook mounts. */
export function useGameSession(start: NewGame): GameSession {
  const [session, dispatch] = useReducer(reduceSession, start, startSession)
  const views = useMemo(() => cellViews(session.game, DEFAULT_ASSISTS), [session.game])
  const onElapsed = useCallback((elapsedMs: number) => dispatch({ type: 'tick', elapsedMs }), [])
  useGameClock(session.game.status === 'playing', onElapsed)
  useMoveHaptics(session.move)
  const actions = useMemo<GameActions>(
    () => ({
      select: (cell) => dispatch({ type: 'select', cell }),
      digit: (digit) => dispatch({ type: 'digit', digit }),
      erase: () => dispatch({ type: 'erase' }),
      undo: () => dispatch({ type: 'undo' }),
      hint: () => dispatch({ type: 'hint', random: Math.random }),
      toggleNotesMode: () => dispatch({ type: 'toggleNotesMode' }),
      pause: () => dispatch({ type: 'pause' }),
      resume: () => dispatch({ type: 'resume' }),
    }),
    [],
  )
  return { ...session, views, actions }
}
