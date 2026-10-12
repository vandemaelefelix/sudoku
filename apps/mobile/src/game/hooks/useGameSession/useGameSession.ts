import { useCallback, useMemo, useReducer } from 'react'
import type { NewGame } from '@sudoku/core'
import type { GameActions } from '@/game/hooks/useGameActions'
import { useGameClock } from '@/game/hooks/useGameClock'
import type { GameState } from '@/game/hooks/useGameState'
import { useMoveHaptics } from '@/game/hooks/useMoveHaptics'
import { reduceSession, startSession } from '@/game/utils/session.utils'

/** The three parts of a game session. Each part keeps its identity until its own content changes. */
export type GameSession = { state: GameState; playedMs: number; actions: GameActions }

/** One game in progress. start is read once, when the hook mounts. */
export function useGameSession(start: NewGame): GameSession {
  const [session, dispatch] = useReducer(reduceSession, start, startSession)
  const onElapsed = useCallback((elapsedMs: number) => dispatch({ type: 'tick', elapsedMs }), [])
  useGameClock(session.game.status === 'playing', onElapsed)
  useMoveHaptics(session.move)
  const { board, notesMode, move } = session
  const state = useMemo<GameState>(() => ({ board, notesMode, move }), [board, notesMode, move])
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
  return { state, playedMs: session.game.playedMs, actions }
}
