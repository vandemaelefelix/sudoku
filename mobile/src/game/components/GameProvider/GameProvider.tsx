import type { ReactNode } from 'react'
import { GameActionsContext } from '@/game/hooks/useGameActions'
import { useGameSession } from '@/game/hooks/useGameSession'
import { GameStateContext } from '@/game/hooks/useGameState'
import { GameTimeContext } from '@/game/hooks/useGameTime'
import type { GameStart } from '@/game/utils/session.utils'

type GameProviderProps = { start: GameStart; children: ReactNode }

/** Three contexts. A clock tick renders only the readers of the time. The actions never change. */
export function GameProvider({ start, children }: GameProviderProps) {
  const { state, playedMs, actions } = useGameSession(start)
  return (
    <GameActionsContext value={actions}>
      <GameStateContext value={state}>
        <GameTimeContext value={playedMs}>{children}</GameTimeContext>
      </GameStateContext>
    </GameActionsContext>
  )
}
