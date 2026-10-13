import { useCallback, useEffect, useMemo, useReducer } from 'react'
import { AppState } from 'react-native'
import type { NewGame } from '@sudoku/core'
import type { GameActions } from '@/game/hooks/useGameActions'
import { useGameClock } from '@/game/hooks/useGameClock'
import type { GameState } from '@/game/hooks/useGameState'
import { useMoveHaptics } from '@/game/hooks/useMoveHaptics'
import { reduceSession, startSession } from '@/game/utils/session.utils'

/** The three parts of a game session. Each part keeps its identity until its own content changes. */
export type GameSession = { state: GameState; playedMs: number; actions: GameActions }

/**
 * One game in progress. start is read once, when the hook mounts.
 * The game pauses when the app is not active, and stays paused until the player resumes it.
 */
export function useGameSession(start: NewGame): GameSession {
  const [session, dispatch] = useReducer(reduceSession, start, startSession)
  const onElapsed = useCallback((elapsedMs: number) => dispatch({ type: 'tick', elapsedMs }), [])
  const flushClock = useGameClock(session.game.status === 'playing', onElapsed)
  useMoveHaptics(session.move, session.game.status === 'lost')
  // The flush comes first: the core ignores a tick once the game is paused.
  const pause = useCallback(() => {
    flushClock()
    dispatch({ type: 'pause' })
  }, [flushClock])
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') pause()
    })
    return () => subscription.remove()
  }, [pause])
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
      pause,
      resume: () => dispatch({ type: 'resume' }),
    }),
    [pause],
  )
  return { state, playedMs: session.game.playedMs, actions }
}
