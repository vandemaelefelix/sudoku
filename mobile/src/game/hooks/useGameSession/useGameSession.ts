import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { AppState } from 'react-native'
import type { GameState } from '@/game/hooks/useGameState'
import { useMoveHaptics } from '@/game/hooks/useMoveHaptics'
import { createGameSession, type GameActions, type SaveGame } from '@/game/utils/gameSession.utils'
import type { GameStart } from '@/game/utils/session.utils'

/** The play screen gives the save. Without it, the game screen saves nothing. */
export const GameSaveContext = createContext<SaveGame | null>(null)

/** The three parts of a game. Each part keeps its identity until its own content changes. */
export type GameSessionView = { state: GameState; playedMs: number; actions: GameActions }

/**
 * One game in progress. start is read once, when the hook mounts. The rules, the clock and the saves live in
 * createGameSession. This hook reads the session, runs it while mounted and gives it the one AppState listener.
 */
export function useGameSession(start: GameStart): GameSessionView {
  const [session] = useState(() => createGameSession(start))
  const save = useContext(GameSaveContext)
  const { game, board, notesMode, move } = useSyncExternalStore(session.subscribe, session.getSnapshot)
  useEffect(() => session.attach(save), [session, save])
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') session.background()
    })
    return () => subscription.remove()
  }, [session])
  useMoveHaptics(move, game.status === 'lost')
  const state = useMemo<GameState>(() => ({ board, notesMode, move }), [board, notesMode, move])
  return { state, playedMs: game.playedMs, actions: session.actions }
}
